'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { useAccount } from 'wagmi'
import { STAKING_EXECUTOR_ABI } from '@stablenet/core'
import { useStableNetContext } from '@/providers'
import { useUserOp } from './useUserOp'
import type { StakingAccountConfig, StakingPosition, StakingPool } from '@/types/defi'

// ============================================================================
// Types
// ============================================================================

export interface UseStakingReturn {
  pools: StakingPool[]
  positions: StakingPosition[]
  accountConfig: StakingAccountConfig | null
  isLoading: boolean
  isExecuting: boolean
  error: string | null
  executorInstalled: boolean

  stake: (pool: Address, amount: bigint) => Promise<Hex | null>
  unstake: (pool: Address, amount: bigint) => Promise<Hex | null>
  claimRewards: (pool: Address) => Promise<Hex | null>
  compoundRewards: (pool: Address) => Promise<Hex | null>
  refetch: () => Promise<void>
  clearError: () => void
}

// ============================================================================
// Constants
// ============================================================================

// Staking executor module address (deployed on local devnet)
const STAKING_EXECUTOR_ADDRESS = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788' as const

// Default staking pools for demo (would come from on-chain registry in production)
const DEFAULT_POOLS: StakingPool[] = [
  {
    address: '0x0000000000000000000000000000000000000001' as Address,
    stakingToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      name: 'KRC',
      symbol: 'KRC',
      decimals: 18,
    },
    rewardToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      name: 'KRC',
      symbol: 'KRC',
      decimals: 18,
    },
    minStake: 100000000000000000n, // 0.1 KRC
    maxStake: 100000000000000000000n, // 100 KRC
    apr: 5.2,
    tvl: 1250000000000000000000n, // 1250 KRC
    isRegistered: true,
  },
  {
    address: '0x0000000000000000000000000000000000000002' as Address,
    stakingToken: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
      name: 'StableNet USD',
      symbol: 'snUSD',
      decimals: 18,
    },
    rewardToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      name: 'KRC',
      symbol: 'KRC',
      decimals: 18,
    },
    minStake: 10000000000000000000n, // 10 snUSD
    maxStake: 1000000000000000000000n, // 1000 snUSD
    apr: 3.8,
    tvl: 52000000000000000000000n, // 52,000 snUSD
    isRegistered: true,
  },
]

// ============================================================================
// Hook
// ============================================================================

export function useStaking(): UseStakingReturn {
  const { address } = useAccount()
  const { publicClient } = useStableNetContext()
  const { sendUserOp } = useUserOp()

  const [pools, setPools] = useState<StakingPool[]>(DEFAULT_POOLS)
  const [positions, setPositions] = useState<StakingPosition[]>([])
  const [accountConfig, setAccountConfig] = useState<StakingAccountConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executorInstalled, setExecutorInstalled] = useState(false)
  const fetchIdRef = useRef(0)

  // Fetch account config and positions
  const fetchAccountData = useCallback(async () => {
    if (!address || !publicClient) return
    const id = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)
    try {
      // Check if staking executor is installed by reading account config
      const config = await publicClient.readContract({
        address: STAKING_EXECUTOR_ADDRESS,
        abi: STAKING_EXECUTOR_ABI,
        functionName: 'getAccountConfig',
        args: [address],
      }) as [bigint, bigint, bigint, boolean, boolean]

      if (id !== fetchIdRef.current) return

      const [maxStakePerPool, dailyStakeLimit, dailyUsed, isActive, isPaused] = config
      setExecutorInstalled(isActive)
      setAccountConfig({
        maxStakePerPool,
        dailyStakeLimit,
        dailyUsed,
        lastResetTime: 0n,
        isActive,
        isPaused,
      })

      if (!isActive) {
        setPositions([])
        return
      }

      // Fetch positions for each pool
      const positionPromises = pools.map(async (pool) => {
        try {
          const stakedAmount = await publicClient.readContract({
            address: STAKING_EXECUTOR_ADDRESS,
            abi: STAKING_EXECUTOR_ABI,
            functionName: 'getStakedAmount',
            args: [address, pool.address],
          }) as bigint

          if (stakedAmount === 0n) return null

          const pendingRewards = await publicClient.readContract({
            address: STAKING_EXECUTOR_ADDRESS,
            abi: STAKING_EXECUTOR_ABI,
            functionName: 'getPendingRewards',
            args: [address, pool.address],
          }) as bigint

          return {
            pool: pool.address,
            stakedAmount,
            rewardsEarned: pendingRewards,
            stakingToken: pool.stakingToken,
            rewardToken: pool.rewardToken,
            stakedAt: 0,
          } satisfies StakingPosition
        } catch {
          return null
        }
      })

      const results = await Promise.all(positionPromises)
      if (id !== fetchIdRef.current) return
      setPositions(results.filter((p): p is StakingPosition => p !== null))
    } catch {
      if (id !== fetchIdRef.current) return
      // If the read fails, the executor is likely not installed
      setExecutorInstalled(false)
      setAccountConfig(null)
      setPositions([])
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [address, publicClient, pools])

  useEffect(() => {
    fetchAccountData()
  }, [fetchAccountData])

  // Send a staking executor operation via useUserOp
  const sendExecutorOp = useCallback(
    async (calldata: Hex): Promise<Hex | null> => {
      if (!address) {
        setError('Wallet not connected')
        return null
      }
      if (!executorInstalled) {
        setError('Staking Executor module not installed. Install it from the Marketplace.')
        return null
      }

      setIsExecuting(true)
      setError(null)
      try {
        const result = await sendUserOp(address, {
          to: STAKING_EXECUTOR_ADDRESS,
          value: 0n,
          data: calldata,
        })

        if (!result) {
          throw new Error('Failed to send UserOperation')
        }

        setTimeout(() => fetchAccountData(), 3000)
        return result.userOpHash
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Operation failed'
        setError(msg)
        return null
      } finally {
        setIsExecuting(false)
      }
    },
    [address, executorInstalled, sendUserOp, fetchAccountData]
  )

  const stake = useCallback(
    async (pool: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: STAKING_EXECUTOR_ABI,
        functionName: 'stake',
        args: [pool, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const unstake = useCallback(
    async (pool: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: STAKING_EXECUTOR_ABI,
        functionName: 'unstake',
        args: [pool, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const claimRewards = useCallback(
    async (pool: Address) => {
      const calldata = encodeFunctionData({
        abi: STAKING_EXECUTOR_ABI,
        functionName: 'claimRewards',
        args: [pool],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const compoundRewards = useCallback(
    async (pool: Address) => {
      const calldata = encodeFunctionData({
        abi: STAKING_EXECUTOR_ABI,
        functionName: 'compoundRewards',
        args: [pool],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  return {
    pools,
    positions,
    accountConfig,
    isLoading,
    isExecuting,
    error,
    executorInstalled,
    stake,
    unstake,
    claimRewards,
    compoundRewards,
    refetch: fetchAccountData,
    clearError: () => setError(null),
  }
}
