'use client'

import type { SwapQuote, Token } from '@/types'
import { useCallback, useState } from 'react'
import { encodeFunctionData } from 'viem'
import type { Address, Hex } from 'viem'

interface SwapParams {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  slippage?: number
}

interface SwapOptions {
  slippage?: number
}

interface UseSwapConfig {
  orderRouterUrl?: string
  sendUserOp?: (
    sender: Address,
    params: {
      to: Address
      value?: bigint
      data: Hex
      minAmountOut?: bigint
    }
  ) => Promise<{ userOpHash: Hex; transactionHash?: Hex; success: boolean } | null>
  routerAddress?: Address
  defaultSlippage?: number
}

interface UserOpResult {
  userOpHash: Hex
  transactionHash?: Hex
  success: boolean
}

// Uniswap V2 Router ABI for swapExactTokensForTokens
const SWAP_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const

const DEFAULT_ORDER_ROUTER_URL = 'http://localhost:4340'
const DEFAULT_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address
const DEFAULT_SLIPPAGE = 0.5 // 0.5%
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export function useSwap(config: UseSwapConfig = {}) {
  const {
    orderRouterUrl = DEFAULT_ORDER_ROUTER_URL,
    sendUserOp,
    routerAddress = DEFAULT_ROUTER_ADDRESS,
    defaultSlippage = DEFAULT_SLIPPAGE,
  } = config

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Calculate minimum amount out with slippage
   */
  const calculateMinAmountOut = useCallback((amountOut: bigint, slippage: number): bigint => {
    const slippageBps = BigInt(Math.floor(slippage * 100))
    return amountOut - (amountOut * slippageBps) / BigInt(10000)
  }, [])

  /**
   * Build swap calldata for router
   */
  const buildSwapCalldata = useCallback(
    (swapQuote: SwapQuote, recipient: Address, minAmountOut: bigint): Hex => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 minutes
      const isETHIn = swapQuote.tokenIn.address.toLowerCase() === ETH_ADDRESS.toLowerCase()

      if (isETHIn) {
        return encodeFunctionData({
          abi: SWAP_ABI,
          functionName: 'swapExactETHForTokens',
          args: [minAmountOut, swapQuote.route, recipient, deadline],
        })
      }

      return encodeFunctionData({
        abi: SWAP_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [swapQuote.amountIn, minAmountOut, swapQuote.route, recipient, deadline],
      })
    },
    []
  )

  /**
   * Get swap quote from order router
   */
  const getQuote = useCallback(
    async (params: SwapParams): Promise<SwapQuote | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const { tokenIn, tokenOut, amountIn } = params

        const response = await fetch(`${orderRouterUrl}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: amountIn.toString(),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || 'Failed to get quote from order router')
        }

        const result = await response.json()

        const swapQuote: SwapQuote = {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: BigInt(result.amountOut),
          priceImpact: result.priceImpact,
          route: result.route || [tokenIn.address, tokenOut.address],
          gasEstimate: BigInt(result.gasEstimate || '150000'),
        }

        setQuote(swapQuote)
        return swapQuote
      } catch (err) {
        const swapError = err instanceof Error ? err : new Error('Failed to get quote')
        setError(swapError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orderRouterUrl]
  )

  /**
   * Execute swap via UserOperation
   */
  const executeSwap = useCallback(
    async (
      swapQuote: SwapQuote,
      recipient: Address,
      options: SwapOptions = {}
    ): Promise<{ transactionHash: string } | null> => {
      if (!sendUserOp) {
        setError(new Error('sendUserOp function not provided'))
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const slippage = options.slippage ?? defaultSlippage
        const minAmountOut = calculateMinAmountOut(swapQuote.amountOut, slippage)
        const calldata = buildSwapCalldata(swapQuote, recipient, minAmountOut)
        const isETHIn = swapQuote.tokenIn.address.toLowerCase() === ETH_ADDRESS.toLowerCase()

        const result = await sendUserOp(recipient, {
          to: routerAddress,
          value: isETHIn ? swapQuote.amountIn : undefined,
          data: calldata,
          minAmountOut,
        })

        if (!result || !result.success) {
          throw new Error('UserOperation failed')
        }

        return {
          transactionHash: result.transactionHash || result.userOpHash,
        }
      } catch (err) {
        const swapError = err instanceof Error ? err : new Error('Failed to execute swap')
        setError(swapError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [sendUserOp, routerAddress, defaultSlippage, calculateMinAmountOut, buildSwapCalldata]
  )

  return {
    quote,
    getQuote,
    executeSwap,
    isLoading,
    error,
    clearQuote: () => setQuote(null),
    clearError: () => setError(null),
  }
}
