import {
  ENTRY_POINT_ADDRESS,
  getChainAddresses,
  getEntryPoint,
  isChainSupported,
} from '@stablenet/contracts'
import type { SponsorPolicy, SupportedToken } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { sendMessageWithTimeout, TX_TIMEOUT_MS } from '../../../../shared/utils/messaging'
import { useSelectedNetwork } from '../../../hooks'

/**
 * Poll eth_getUserOperationReceipt until the UserOp is mined or timeout.
 * Returns true if receipt found (success or revert), false on timeout.
 */
async function waitForUserOpConfirmation(
  userOpHash: string,
  timeoutMs: number,
  pollIntervalMs = 2000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `receipt-poll-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        },
      })

      // Receipt exists → UserOp was mined (success or revert)
      if (response?.payload?.result) {
        return true
      }
    } catch {
      // Network error — keep polling
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  return false
}

interface ERC20Estimate {
  tokenAddress: Address
  estimatedAmount: bigint
  exchangeRate: bigint
}

/** Token allowance status for ERC-20 paymaster */
export interface TokenAllowanceStatus {
  /** Current on-chain allowance */
  allowance: bigint
  /** Whether allowance is sufficient for paymaster use */
  isSufficient: boolean
  /** Spender address (ERC20 paymaster) */
  spender: Address
}

/** Minimum allowance to consider sufficient (1M USDC with 6 decimals) */
const MIN_ALLOWANCE_THRESHOLD = BigInt(1e12)

/**
 * Hook for interacting with the Paymaster client
 *
 * Provides supported tokens, sponsor policies, ERC20 gas estimation,
 * token allowance checking, and approve transaction sending.
 */
export function usePaymasterClient(accountAddress?: Address) {
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [sponsorPolicy, setSponsorPolicy] = useState<SponsorPolicy | null>(null)
  const [erc20Estimate, setErc20Estimate] = useState<ERC20Estimate | null>(null)
  const [tokenAllowance, setTokenAllowance] = useState<TokenAllowanceStatus | null>(null)

  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false)
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false)
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false)
  const [isSendingApprove, setIsSendingApprove] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const currentNetwork = useSelectedNetwork()

  // Fetch supported tokens
  useEffect(() => {
    if (!currentNetwork) return

    setIsLoadingTokens(true)

    chrome.runtime
      .sendMessage({
        type: 'RPC_REQUEST',
        id: `paymaster-tokens-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_supportedTokens',
          params: [currentNetwork.chainId],
        },
      })
      .then((response) => {
        if (response?.payload?.result?.tokens) {
          setSupportedTokens(response.payload.result.tokens)
        }
      })
      .catch(() => {
        // Silently fail - paymaster may not be available
      })
      .finally(() => setIsLoadingTokens(false))
  }, [currentNetwork])

  // Fetch sponsor policy
  useEffect(() => {
    if (!currentNetwork || !accountAddress) return

    setIsLoadingPolicy(true)

    chrome.runtime
      .sendMessage({
        type: 'RPC_REQUEST',
        id: `paymaster-policy-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_sponsorPolicy',
          params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
        },
      })
      .then((response) => {
        if (response?.payload?.result) {
          setSponsorPolicy(response.payload.result)
        } else {
          setSponsorPolicy({
            isAvailable: false,
            reason: 'Sponsorship not available for this network',
          })
        }
      })
      .catch(() => {
        setSponsorPolicy({
          isAvailable: false,
          reason: 'Could not check sponsorship availability',
        })
      })
      .finally(() => setIsLoadingPolicy(false))
  }, [currentNetwork, accountAddress])

  // Fetch ERC20 estimate
  const fetchERC20Estimate = useCallback(
    async (tokenAddress: Address) => {
      if (!currentNetwork) return

      setIsLoadingEstimate(true)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `paymaster-estimate-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_estimateERC20',
            params: [{ tokenAddress, chainId: currentNetwork.chainId }],
          },
        })

        if (response?.payload?.result) {
          setErc20Estimate({
            tokenAddress,
            estimatedAmount: BigInt(response.payload.result.estimatedAmount || '0'),
            exchangeRate: BigInt(response.payload.result.exchangeRate || '0'),
          })
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingEstimate(false)
      }
    },
    [currentNetwork]
  )

  /**
   * Check on-chain ERC-20 allowance for the ERC20 paymaster.
   * Uses eth_call to read allowance(owner, spender) on the token contract.
   */
  const checkTokenAllowance = useCallback(
    async (tokenAddress: Address) => {
      if (!currentNetwork || !accountAddress) return

      setIsCheckingAllowance(true)
      setTokenAllowance(null)

      try {
        const chainAddresses = isChainSupported(currentNetwork.chainId)
          ? getChainAddresses(currentNetwork.chainId)
          : null
        const spender = chainAddresses?.paymasters?.erc20Paymaster as Address | undefined

        if (!spender) {
          setTokenAllowance(null)
          return
        }

        // allowance(address owner, address spender) selector: 0xdd62ed3e
        const ownerPadded = accountAddress.toLowerCase().replace('0x', '').padStart(64, '0')
        const spenderPadded = spender.toLowerCase().replace('0x', '').padStart(64, '0')

        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `allowance-check-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [
              { to: tokenAddress, data: `0xdd62ed3e${ownerPadded}${spenderPadded}` },
              'latest',
            ],
          },
        })

        const allowance =
          response?.payload?.result && response.payload.result !== '0x'
            ? BigInt(response.payload.result)
            : 0n

        setTokenAllowance({
          allowance,
          isSufficient: allowance >= MIN_ALLOWANCE_THRESHOLD,
          spender,
        })
      } catch {
        setTokenAllowance(null)
      } finally {
        setIsCheckingAllowance(false)
      }
    },
    [currentNetwork, accountAddress]
  )

  /**
   * Send an approve(spender, maxUint256) UserOp using the sponsored paymaster.
   * This is a separate UserOp that grants the ERC20 paymaster unlimited allowance.
   * After confirmation, the user can send ERC-20 gas payment UserOps.
   */
  const sendApproveTransaction = useCallback(
    async (tokenAddress: Address): Promise<boolean> => {
      if (!currentNetwork || !accountAddress) return false

      const chainAddresses = isChainSupported(currentNetwork.chainId)
        ? getChainAddresses(currentNetwork.chainId)
        : null
      const spender = chainAddresses?.paymasters?.erc20Paymaster as Address | undefined

      if (!spender) {
        setApproveError('ERC-20 paymaster not configured')
        return false
      }

      setIsSendingApprove(true)
      setApproveError(null)

      try {
        const entryPoint = isChainSupported(currentNetwork.chainId)
          ? getEntryPoint(currentNetwork.chainId)
          : ENTRY_POINT_ADDRESS

        // Send approve UserOp via sponsored paymaster (free gas)
        // approve(address spender, uint256 amount) selector: 0x095ea7b3
        // maxUint256 = 0xfff...fff (32 bytes)
        const spenderPadded = spender.toLowerCase().replace('0x', '').padStart(64, '0')
        const maxUint256Hex = 'f'.repeat(64)
        const approveCalldata = `0x095ea7b3${spenderPadded}${maxUint256Hex}`

        const response = await sendMessageWithTimeout<{
          payload?: { error?: { code?: number; message?: string }; result?: unknown }
        }>(
          {
            type: 'RPC_REQUEST',
            id: `approve-userop-${Date.now()}`,
            payload: {
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_sendUserOperation',
              params: [
                {
                  sender: accountAddress,
                  target: tokenAddress,
                  value: '0x0',
                  data: approveCalldata,
                  // Use sponsored (free) gas for the approve tx
                  gasPayment: { type: 'sponsor' },
                },
                entryPoint,
              ],
            },
          },
          TX_TIMEOUT_MS
        )

        if (response?.payload?.error) {
          setApproveError(response.payload.error.message ?? 'Approve failed')
          return false
        }

        // Approval UserOp submitted — poll for on-chain confirmation before returning.
        // The UserOp hash is returned; we poll the receipt until mined or timeout.
        const userOpHash = response?.payload?.result as string | undefined

        if (userOpHash) {
          const confirmed = await waitForUserOpConfirmation(userOpHash, 30_000)
          if (!confirmed) {
            setApproveError('Approve submitted but not yet confirmed. Please wait and try again.')
            return false
          }
        } else {
          // No hash returned — wait a reasonable time for mining
          await new Promise((r) => setTimeout(r, 8000))
        }

        // Re-check allowance now that tx should be mined
        await checkTokenAllowance(tokenAddress)

        return true
      } catch (err) {
        setApproveError(err instanceof Error ? err.message : 'Approve failed')
        return false
      } finally {
        setIsSendingApprove(false)
      }
    },
    [currentNetwork, accountAddress, checkTokenAllowance]
  )

  return {
    supportedTokens,
    sponsorPolicy,
    erc20Estimate,
    tokenAllowance,
    isLoadingTokens,
    isLoadingPolicy,
    isLoadingEstimate,
    isCheckingAllowance,
    isSendingApprove,
    approveError,
    fetchERC20Estimate,
    checkTokenAllowance,
    sendApproveTransaction,
  }
}
