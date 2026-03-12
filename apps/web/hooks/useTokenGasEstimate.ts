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
  /** Estimated token amount (raw string, needs formatUnits with token decimals) */
  estimatedAmount: string
  exchangeRate: string
  /** Markup in basis points */
  markup: number
}

interface TokenGasEstimateState {
  estimate: TokenPaymentEstimate | null
  formattedTokenCost: string | null
  isLoading: boolean
  error: Error | null
  estimateTokenCost: (
    tokenAddress: Address,
    userOpPartial: Record<string, unknown>,
    tokenDecimals?: number
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
  const [decimals, setDecimals] = useState(18)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const estimateTokenCost = useCallback(
    async (tokenAddress: Address, userOpPartial: Record<string, unknown>, tokenDecimals = 18) => {
      setDecimals(tokenDecimals)
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
            params: [userOpPartial, entryPoint, `0x${chainId.toString(16)}` as Hex, tokenAddress],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message ?? 'Token gas estimation failed')
        }

        if (!result.result) {
          throw new Error('No estimation data returned')
        }

        const data = result.result as TokenPaymentEstimate
        setEstimate(data)
      } catch (err) {
        setEstimate(null)
        setError(err instanceof Error ? err : new Error('Failed to estimate token gas cost'))
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, entryPoint, chainId]
  )

  const formattedTokenCost =
    estimate != null ? formatUnits(BigInt(estimate.estimatedAmount), decimals) : null

  return {
    estimate,
    formattedTokenCost,
    isLoading,
    error,
    estimateTokenCost,
  }
}
