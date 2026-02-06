import type { SponsorPolicy, SupportedToken } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSelectedNetwork } from '../../../hooks'

interface ERC20Estimate {
  tokenAddress: Address
  estimatedAmount: bigint
  exchangeRate: bigint
}

/**
 * Hook for interacting with the Paymaster client
 *
 * Provides supported tokens, sponsor policies, and ERC20 gas estimation
 */
export function usePaymasterClient(accountAddress?: Address) {
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [sponsorPolicy, setSponsorPolicy] = useState<SponsorPolicy | null>(null)
  const [erc20Estimate, setErc20Estimate] = useState<ERC20Estimate | null>(null)

  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false)
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false)

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
          // Default policy when paymaster not available
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

  return {
    supportedTokens,
    sponsorPolicy,
    erc20Estimate,
    isLoadingTokens,
    isLoadingPolicy,
    isLoadingEstimate,
    fetchERC20Estimate,
  }
}
