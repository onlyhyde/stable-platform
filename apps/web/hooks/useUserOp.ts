'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { parseEther } from 'viem'
import { useStableNetContext } from '@/providers'
import {
  detectProvider,
  type StableNetProvider,
  createBundlerClient,
} from '@stablenet/wallet-sdk'

// ============================================================================
// Types
// ============================================================================

interface SendUserOpParams {
  to: Address
  value?: bigint
  data?: Hex
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [provider, setProvider] = useState<StableNetProvider | null>(null)

  // Detect wallet-sdk provider on mount
  useEffect(() => {
    detectProvider({ timeout: 2000 })
      .then((p) => {
        if (p) setProvider(p)
      })
      .catch(() => {
        // Provider not available
      })
  }, [])

  // Bundler client — only for recheckUserOp (receipt polling of old submissions)
  const bundlerClient = useMemo(
    () => createBundlerClient({ url: bundlerUrl, entryPoint }),
    [bundlerUrl, entryPoint]
  )

  /**
   * Send a transaction through the wallet extension.
   *
   * For smart accounts (delegated via EIP-7702), the extension automatically:
   * 1. Wraps {to, value, data} into Kernel execute calldata
   * 2. Builds a UserOperation with correct nonce and gas
   * 3. Signs and submits to the bundler
   * 4. Waits for on-chain confirmation
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
        const txHash = await provider.sendTransaction(
          {
            from: sender,
            to: params.to,
            value: params.value,
            data: params.data,
          },
          { waitForConfirmation: true }
        )

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
    [provider]
  )

  /**
   * Simple ETH transfer helper
   */
  const sendTransaction = useCallback(
    async (sender: Address, to: Address, value: string): Promise<UserOpResult | null> => {
      return sendUserOp(sender, {
        to,
        value: parseEther(value),
        data: '0x',
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
