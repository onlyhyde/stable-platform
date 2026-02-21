'use client'

import { getUniswapRouter } from '@stablenet/contracts'
import { useCallback, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, parseUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { getServiceUrls } from '@/lib/constants'
import { useStableNetContext } from '@/providers'
import type { Pool } from '@/types'

// Uniswap V2-style Router ABI for liquidity operations
const ROUTER_ABI = [
  {
    name: 'addLiquidity',
    type: 'function',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
  {
    name: 'removeLiquidity',
    type: 'function',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
    ],
  },
] as const

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

export type LiquidityStep = 'idle' | 'approving-token0' | 'approving-token1' | 'adding' | 'removing' | 'confirmed' | 'failed'

interface AddLiquidityParams {
  pool: Pool
  amount0: string
  amount1: string
  slippageBps?: number // basis points, default 50 (0.5%)
}

interface RemoveLiquidityParams {
  pool: Pool
  liquidity: bigint
  amount0Min?: bigint
  amount1Min?: bigint
  slippageBps?: number
}

interface UsePoolLiquidityReturn {
  addLiquidity: (params: AddLiquidityParams) => Promise<Hex | null>
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<Hex | null>
  step: LiquidityStep
  isLoading: boolean
  error: string | null
  clearError: () => void
}

export function usePoolLiquidity(): UsePoolLiquidityReturn {
  const { chainId } = useStableNetContext()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [step, setStep] = useState<LiquidityStep>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const routerAddress = useMemo(() => {
    try {
      return getUniswapRouter(chainId)
    } catch {
      return undefined
    }
  }, [chainId])

  const ensureAllowance = useCallback(
    async (token: Address, amount: bigint, stepLabel: LiquidityStep) => {
      if (!publicClient || !walletClient || !address || !routerAddress) return

      const allowance = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, routerAddress],
      })

      if (allowance < amount) {
        setStep(stepLabel)
        const hash = await walletClient.sendTransaction({
          to: token,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [routerAddress, amount],
          }),
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }
    },
    [publicClient, walletClient, address, routerAddress]
  )

  const addLiquidity = useCallback(
    async (params: AddLiquidityParams): Promise<Hex | null> => {
      if (!walletClient || !publicClient || !address || !routerAddress) {
        setError('Wallet not connected or router not configured')
        return null
      }

      const { pool, amount0, amount1, slippageBps = 50 } = params

      setIsLoading(true)
      setError(null)
      setStep('idle')

      try {
        const amountA = parseUnits(amount0, pool.token0.decimals)
        const amountB = parseUnits(amount1, pool.token1.decimals)
        const amountAMin = amountA - (amountA * BigInt(slippageBps)) / 10000n
        const amountBMin = amountB - (amountB * BigInt(slippageBps)) / 10000n
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 minutes

        // Approve token0 if needed
        await ensureAllowance(pool.token0.address, amountA, 'approving-token0')

        // Approve token1 if needed
        await ensureAllowance(pool.token1.address, amountB, 'approving-token1')

        // Execute addLiquidity
        setStep('adding')
        const calldata = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            pool.token0.address,
            pool.token1.address,
            amountA,
            amountB,
            amountAMin,
            amountBMin,
            address,
            deadline,
          ],
        })

        const hash = await walletClient.sendTransaction({
          to: routerAddress,
          data: calldata,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        setStep('confirmed')
        return hash
      } catch (err) {
        setStep('failed')
        const msg = err instanceof Error ? err.message : 'Failed to add liquidity'
        setError(msg)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, address, routerAddress, ensureAllowance]
  )

  const removeLiquidity = useCallback(
    async (params: RemoveLiquidityParams): Promise<Hex | null> => {
      if (!walletClient || !publicClient || !address || !routerAddress) {
        setError('Wallet not connected or router not configured')
        return null
      }

      const { pool, liquidity, slippageBps = 50 } = params

      setIsLoading(true)
      setError(null)

      try {
        // Calculate min amounts based on current reserves and liquidity share
        const totalLiquidity = pool.reserve0 + pool.reserve1 // simplified
        const share = totalLiquidity > 0n ? (liquidity * 10000n) / totalLiquidity : 0n
        const expectedAmount0 = (pool.reserve0 * share) / 10000n
        const expectedAmount1 = (pool.reserve1 * share) / 10000n

        const amount0Min =
          params.amount0Min ?? expectedAmount0 - (expectedAmount0 * BigInt(slippageBps)) / 10000n
        const amount1Min =
          params.amount1Min ?? expectedAmount1 - (expectedAmount1 * BigInt(slippageBps)) / 10000n
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

        // Approve LP token (pool address is the LP token for V2 pairs)
        await ensureAllowance(pool.address, liquidity, 'approving-token0')

        setStep('removing')
        const calldata = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [
            pool.token0.address,
            pool.token1.address,
            liquidity,
            amount0Min,
            amount1Min,
            address,
            deadline,
          ],
        })

        const hash = await walletClient.sendTransaction({
          to: routerAddress,
          data: calldata,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        setStep('confirmed')
        return hash
      } catch (err) {
        setStep('failed')
        const msg = err instanceof Error ? err.message : 'Failed to remove liquidity'
        setError(msg)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, address, routerAddress, ensureAllowance]
  )

  return {
    addLiquidity,
    removeLiquidity,
    step,
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
