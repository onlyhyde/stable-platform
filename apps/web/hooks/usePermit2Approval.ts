'use client'

import {
  createPermitSingle,
  getPermitSingleTypedData,
  MAX_UINT160,
  PERMIT2_ADDRESSES,
} from '@stablenet/plugin-defi'
import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useChainId, useWalletClient } from 'wagmi'

// ============================================================================
// Types
// ============================================================================

export interface Permit2ApprovalState {
  /** Signed permit signature */
  permitSignature: Hex | null
  /** Whether a signing request is pending */
  isSigning: boolean
  /** Error from signing */
  error: string | null
  /**
   * Request Permit2 signature for a token → spender (paymaster).
   * Returns the signature hex on success, or null on failure.
   */
  requestPermit2Signature: (
    tokenAddress: Address,
    spenderAddress: Address,
    amount?: bigint
  ) => Promise<Hex | null>
  /** Clear state */
  reset: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Handle Permit2 approval signature flow for paymaster gas payment.
 *
 * When the user selects Permit2 paymaster mode, this hook:
 * 1. Builds a PermitSingle typed data structure
 * 2. Requests an EIP-712 signature from the user's wallet
 * 3. Returns the signature to be included in paymaster data
 */
export function usePermit2Approval(): Permit2ApprovalState {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()

  const [permitSignature, setPermitSignature] = useState<Hex | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestPermit2Signature = useCallback(
    async (
      tokenAddress: Address,
      spenderAddress: Address,
      amount?: bigint
    ): Promise<Hex | null> => {
      if (!walletClient) {
        setError('Wallet not connected')
        return null
      }

      const permit2Address = PERMIT2_ADDRESSES[chainId]
      if (!permit2Address) {
        setError(`Permit2 not available on chain ${chainId}`)
        return null
      }

      setIsSigning(true)
      setError(null)

      try {
        // Build permit struct
        const permit = createPermitSingle(tokenAddress, spenderAddress, amount ?? MAX_UINT160)

        // Get EIP-712 typed data
        const typedData = getPermitSingleTypedData(permit, chainId)

        // Request signature from wallet
        const signature = await walletClient.signTypedData({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        })

        setPermitSignature(signature)
        return signature
      } catch (err) {
        const msg = err instanceof Error ? err.message.split('\n')[0] : 'Permit2 signature failed'
        setError(msg)
        return null
      } finally {
        setIsSigning(false)
      }
    },
    [walletClient, chainId]
  )

  const reset = useCallback(() => {
    setPermitSignature(null)
    setIsSigning(false)
    setError(null)
  }, [])

  return {
    permitSignature,
    isSigning,
    error,
    requestPermit2Signature,
    reset,
  }
}
