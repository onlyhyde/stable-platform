'use client'

import { createBundlerClient } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, EIP1193Provider, Hex } from 'viem'
import { parseEther } from 'viem'
import { useAccount } from 'wagmi'
import { useStableNetContext } from '@/providers'

// ============================================================================
// Types
// ============================================================================

export type GasPaymentType = 'none' | 'sponsor' | 'erc20' | 'permit2'

export interface GasPaymentContext {
  type: GasPaymentType
  tokenAddress?: Address
  permitSignature?: Hex
}

interface SendUserOpParams {
  to: Address
  value?: bigint
  data?: Hex
  gasPayment?: GasPaymentContext
}

type UserOpStatus = 'submitted' | 'confirmed' | 'failed'

interface UserOpResult {
  userOpHash: Hex
  transactionHash?: Hex
  success: boolean
  status: UserOpStatus
}

// ============================================================================
// Pending UserOp localStorage (for re-checking timed-out submissions)
// ============================================================================

const PENDING_OPS_KEY = 'stablenet:pending-user-ops'

export interface PendingUserOp {
  userOpHash: Hex
  timestamp: number
  to?: string
}

function loadPendingOps(): PendingUserOp[] {
  try {
    const stored = localStorage.getItem(PENDING_OPS_KEY)
    if (!stored) return []
    const ops = JSON.parse(stored) as PendingUserOp[]
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return ops.filter((op) => op.timestamp > cutoff)
  } catch {
    return []
  }
}

function removePendingOp(userOpHash: Hex): void {
  try {
    const ops = loadPendingOps().filter((op) => op.userOpHash !== userOpHash)
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops))
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Send transactions through the StableNet wallet extension.
 *
 * The extension's handler.ts handles all UserOp logic:
 * - Kernel v3 execute calldata wrapping (ERC-7579)
 * - Nonce fetching from EntryPoint
 * - Gas estimation via bundler
 * - Signing with the wallet's private key
 * - Bundler submission and receipt polling
 *
 * The DApp only needs to specify {to, value, data} — no direct
 * bundler communication, UserOp construction, or signing required.
 */
export function useUserOp() {
  const { bundlerUrl, entryPoint } = useStableNetContext()
  const { connector } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [provider, setProvider] = useState<EIP1193Provider | null>(null)

  // Get provider from wagmi connector (shared with useWallet)
  // Note: wagmi connector returns the inpage EIP-1193 provider, not
  // the wallet-sdk StableNetProvider class. Use request() only.
  useEffect(() => {
    if (!connector) {
      setProvider(null)
      return
    }

    connector
      .getProvider()
      .then((p) => {
        if (p) setProvider(p as EIP1193Provider)
      })
      .catch(() => {
        setProvider(null)
      })
  }, [connector])

  // Bundler client — only for recheckUserOp (receipt polling of old submissions)
  const bundlerClient = useMemo(
    () => createBundlerClient({ url: bundlerUrl, entryPoint }),
    [bundlerUrl, entryPoint]
  )

  /**
   * Send a transaction through the wallet extension.
   *
   * When gasPayment is provided (sponsor/erc20/permit2), sends via
   * eth_sendUserOperation which triggers the extension's ERC-7677
   * sponsorAndSign flow. Otherwise falls back to eth_sendTransaction.
   */
  const sendUserOp = useCallback(
    async (sender: Address, params: SendUserOpParams): Promise<UserOpResult | null> => {
      if (!provider) {
        setError(new Error('StableNet wallet not detected. Please install the extension.'))
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const hasPaymaster = params.gasPayment && params.gasPayment.type !== 'none'

        if (hasPaymaster) {
          // Use eth_sendUserOperation — extension handles Kernel calldata wrapping,
          // nonce, gas estimation, sponsorAndSign, and bundler submission
          const hash = (await provider.request({
            method: 'eth_sendUserOperation' as 'eth_sendTransaction',
            params: [
              {
                sender,
                target: params.to,
                value: params.value ? `0x${params.value.toString(16)}` : '0x0',
                data: params.data ?? '0x',
                gasPayment: params.gasPayment,
              },
              entryPoint,
            ] as unknown as [{ from: Address; to: Address }],
          })) as Hex

          return {
            userOpHash: hash as Hex,
            transactionHash: hash as Hex,
            success: true,
            status: 'confirmed',
          }
        }

        // Fallback: regular eth_sendTransaction (extension auto-detects smart account)
        // Use provider.request() directly since the wagmi connector returns the
        // inpage EIP-1193 provider, not the wallet-sdk StableNetProvider class.
        const txHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: sender,
              to: params.to,
              value: params.value ? `0x${params.value.toString(16)}` : '0x0',
              data: params.data ?? '0x',
            },
          ],
        })) as Hex

        return {
          userOpHash: txHash as Hex,
          transactionHash: txHash as Hex,
          success: true,
          status: 'confirmed',
        }
      } catch (err) {
        const opError = err instanceof Error ? err : new Error('Transaction failed')
        setError(opError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [provider, entryPoint]
  )

  /**
   * Simple ETH transfer helper
   */
  const sendTransaction = useCallback(
    async (
      sender: Address,
      to: Address,
      value: string,
      gasPayment?: GasPaymentContext
    ): Promise<UserOpResult | null> => {
      return sendUserOp(sender, {
        to,
        value: parseEther(value),
        data: '0x',
        gasPayment,
      })
    },
    [sendUserOp]
  )

  /**
   * Re-check a previously submitted UserOp that timed out.
   * Uses bundler client directly for receipt polling.
   */
  const recheckUserOp = useCallback(
    async (userOpHash: Hex): Promise<UserOpResult> => {
      try {
        const receipt = await bundlerClient.waitForUserOperationReceipt(userOpHash, {
          timeout: 30000,
          pollingInterval: 3000,
        })
        removePendingOp(userOpHash)
        return {
          userOpHash,
          transactionHash: receipt.receipt?.transactionHash,
          success: receipt.success ?? false,
          status: receipt.success ? 'confirmed' : 'failed',
        }
      } catch {
        return {
          userOpHash,
          success: false,
          status: 'submitted',
        }
      }
    },
    [bundlerClient]
  )

  return {
    sendUserOp,
    sendTransaction,
    recheckUserOp,
    getPendingUserOps: loadPendingOps,
    removePendingUserOp: removePendingOp,
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
