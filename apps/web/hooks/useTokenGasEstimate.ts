'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { formatUnits } from 'viem'
import { useStableNetContext } from '@/providers'

// ============================================================================
// Types
// ============================================================================

export interface TokenPaymentEstimate {
  tokenAddress: Address
  tokenAmount: string
  tokenSymbol: string
  tokenDecimals: number
  exchangeRate: string
  gasCostInWei: string
}

interface TokenGasEstimateState {
  estimate: TokenPaymentEstimate | null
  formattedTokenCost: string | null
  isLoading: boolean
  error: Error | null
  estimateTokenCost: (
    tokenAddress: Address,
    userOpPartial: Record<string, unknown>
  ) => Promise<void>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Estimate gas cost in ERC-20 tokens via pm_estimateTokenPayment RPC.
 *
 * This calls the Paymaster proxy to calculate how much of a specific
 * ERC-20 token is needed to cover a UserOperation's gas cost.
 */
export function useTokenGasEstimate(): TokenGasEstimateState {
  const { paymasterUrl, entryPoint, chainId } = useStableNetContext()
  const [estimate, setEstimate] = useState<TokenPaymentEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const estimateTokenCost = useCallback(
    async (tokenAddress: Address, userOpPartial: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_estimateTokenPayment',
            params: [
              userOpPartial,
              entryPoint,
              `0x${chainId.toString(16)}` as Hex,
              tokenAddress,
            ],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message)
        }

        const data = result.result as TokenPaymentEstimate
        setEstimate(data)
      } catch (err) {
        setEstimate(null)
        setError(
          err instanceof Error ? err : new Error('Failed to estimate token gas cost')
        )
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, entryPoint, chainId]
  )

  const formattedTokenCost =
    estimate != null
      ? formatUnits(BigInt(estimate.tokenAmount), estimate.tokenDecimals)
      : null

  return {
    estimate,
    formattedTokenCost,
    isLoading,
    error,
    estimateTokenCost,
  }
}
