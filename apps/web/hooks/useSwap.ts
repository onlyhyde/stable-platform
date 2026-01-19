'use client'

import { useState, useCallback } from 'react'
import type { Address } from 'viem'
import type { Token, SwapQuote } from '@/types'

interface SwapParams {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  slippage?: number // Percentage
}

export function useSwap() {
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Get swap quote
   */
  const getQuote = useCallback(async (params: SwapParams): Promise<SwapQuote | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const { tokenIn, tokenOut, amountIn } = params

      // In production, this would call the order router service
      // For now, return a mock quote
      const mockQuote: SwapQuote = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: (amountIn * BigInt(99)) / BigInt(100), // Mock 1% spread
        priceImpact: 0.1,
        route: [tokenIn.address, tokenOut.address],
        gasEstimate: BigInt(150000),
      }

      setQuote(mockQuote)
      return mockQuote
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get quote')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Execute swap
   */
  const executeSwap = useCallback(async (
    _quote: SwapQuote,
    _recipient: Address
  ): Promise<{ transactionHash: string } | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // In production, this would:
      // 1. Build the swap calldata
      // 2. Send via UserOperation
      // 3. Wait for confirmation

      // Mock successful swap
      await new Promise((resolve) => setTimeout(resolve, 2000))

      return {
        transactionHash: `0x${'0'.repeat(64)}`,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to execute swap')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    quote,
    getQuote,
    executeSwap,
    isLoading,
    error,
    clearQuote: () => setQuote(null),
  }
}
