'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { getServiceUrls } from '@/lib/constants'
import { useStableNetContext } from '@/providers'
import type { SwapQuote, Token } from '@/types'

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
  readContract?: (params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  }) => Promise<bigint>
  routerAddress?: Address
  defaultSlippage?: number
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

// ERC-20 ABI fragments for allowance check and approve
const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const DEFAULT_SLIPPAGE = 0.5 // 0.5%
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export function useSwap(config: UseSwapConfig = {}) {
  const { chainId } = useStableNetContext()
  const serviceUrls = useMemo(() => getServiceUrls(chainId), [chainId])

  const {
    orderRouterUrl = serviceUrls?.orderRouter,
    sendUserOp,
    readContract,
    routerAddress,
    defaultSlippage = DEFAULT_SLIPPAGE,
  } = config

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchIdRef = useRef(0)

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
      const id = ++fetchIdRef.current
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

        if (id !== fetchIdRef.current) return null

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
        if (id !== fetchIdRef.current) return null
        const swapError = err instanceof Error ? err : new Error('Failed to get quote')
        setError(swapError)
        return null
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
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

      if (!routerAddress) {
        setError(new Error('routerAddress not configured'))
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const slippage = options.slippage ?? defaultSlippage
        const minAmountOut = calculateMinAmountOut(swapQuote.amountOut, slippage)
        const calldata = buildSwapCalldata(swapQuote, recipient, minAmountOut)
        const isETHIn = swapQuote.tokenIn.address.toLowerCase() === ETH_ADDRESS.toLowerCase()

        // ERC-20: Check allowance and approve if needed
        if (!isETHIn && readContract) {
          const currentAllowance = await readContract({
            address: swapQuote.tokenIn.address as Address,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [recipient, routerAddress],
          })

          if (currentAllowance < swapQuote.amountIn) {
            const approveData = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [routerAddress, swapQuote.amountIn],
            })

            const approveResult = await sendUserOp(recipient, {
              to: swapQuote.tokenIn.address as Address,
              data: approveData,
            })

            if (!approveResult || !approveResult.success) {
              throw new Error('ERC-20 approve failed')
            }
          }
        }

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
    [
      sendUserOp,
      readContract,
      routerAddress,
      defaultSlippage,
      calculateMinAmountOut,
      buildSwapCalldata,
    ]
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
