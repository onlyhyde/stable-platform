'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { useAccount } from 'wagmi'
import { LENDING_EXECUTOR_ABI, HEALTH_FACTOR_HOOK_ABI } from '@stablenet/core'
import { useStableNetContext } from '@/providers'
import { useUserOp } from './useUserOp'
import type { LendingAccountConfig, LendingMarket, LendingPosition, HealthFactorInfo } from '@/types/defi'

// ============================================================================
// Types
// ============================================================================

export interface UseLendingReturn {
  markets: LendingMarket[]
  positions: LendingPosition[]
  accountConfig: LendingAccountConfig | null
  healthFactor: bigint | null
  healthFactorInfo: HealthFactorInfo | null
  isLoading: boolean
  isExecuting: boolean
  error: string | null
  executorInstalled: boolean

  supply: (asset: Address, amount: bigint) => Promise<Hex | null>
  withdraw: (asset: Address, amount: bigint) => Promise<Hex | null>
  borrow: (asset: Address, amount: bigint) => Promise<Hex | null>
  repay: (asset: Address, amount: bigint) => Promise<Hex | null>
  refetch: () => Promise<void>
  clearError: () => void
}

// ============================================================================
// Constants
// ============================================================================

const LENDING_EXECUTOR_ADDRESS = '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e' as const
const HEALTH_FACTOR_HOOK_ADDRESS = '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0' as const

const WAD = 1000000000000000000n // 1e18

// Default lending markets for demo
const DEFAULT_MARKETS: LendingMarket[] = [
  {
    asset: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      name: 'KRC',
      symbol: 'KRC',
      decimals: 18,
    },
    supplyAPY: 2.1,
    borrowAPY: 4.5,
    totalSupply: 5000000000000000000000n,
    totalBorrow: 2000000000000000000000n,
    availableLiquidity: 3000000000000000000000n,
    utilizationRate: 40,
  },
  {
    asset: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
      name: 'StableNet USD',
      symbol: 'snUSD',
      decimals: 18,
    },
    supplyAPY: 3.2,
    borrowAPY: 5.1,
    totalSupply: 100000000000000000000000n,
    totalBorrow: 65000000000000000000000n,
    availableLiquidity: 35000000000000000000000n,
    utilizationRate: 65,
  },
  {
    asset: {
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Address,
      name: 'Wrapped KRC',
      symbol: 'wKRC',
      decimals: 18,
    },
    supplyAPY: 1.8,
    borrowAPY: 3.9,
    totalSupply: 3000000000000000000000n,
    totalBorrow: 1200000000000000000000n,
    availableLiquidity: 1800000000000000000000n,
    utilizationRate: 40,
  },
]

// ============================================================================
// Hook
// ============================================================================

export function useLending(): UseLendingReturn {
  const { address } = useAccount()
  const { publicClient } = useStableNetContext()
  const { sendUserOp } = useUserOp()

  const [markets] = useState<LendingMarket[]>(DEFAULT_MARKETS)
  const [positions, setPositions] = useState<LendingPosition[]>([])
  const [accountConfig, setAccountConfig] = useState<LendingAccountConfig | null>(null)
  const [healthFactor, setHealthFactor] = useState<bigint | null>(null)
  const [healthFactorInfo, setHealthFactorInfo] = useState<HealthFactorInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executorInstalled, setExecutorInstalled] = useState(false)
  const fetchIdRef = useRef(0)

  const fetchAccountData = useCallback(async () => {
    if (!address || !publicClient) return
    const id = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)
    try {
      // Read lending executor account config
      const config = await publicClient.readContract({
        address: LENDING_EXECUTOR_ADDRESS,
        abi: LENDING_EXECUTOR_ABI,
        functionName: 'getAccountConfig',
        args: [address],
      }) as [bigint, bigint, bigint, boolean]

      if (id !== fetchIdRef.current) return

      const [minHealthFactor, maxBorrowLimit, totalBorrowed, isActive] = config
      setExecutorInstalled(isActive)
      setAccountConfig({
        minHealthFactor,
        maxBorrowLimit,
        totalBorrowed,
        isActive,
      })

      if (!isActive) {
        setPositions([])
        setHealthFactor(null)
        return
      }

      // Read health factor from hook
      try {
        const hfConfig = await publicClient.readContract({
          address: HEALTH_FACTOR_HOOK_ADDRESS,
          abi: HEALTH_FACTOR_HOOK_ABI,
          functionName: 'getAccountConfig',
          args: [address],
        }) as [bigint, boolean, boolean]

        if (id !== fetchIdRef.current) return

        setHealthFactorInfo({
          value: hfConfig[0],
          isEnabled: hfConfig[1],
          isInitialized: hfConfig[2],
        })

        if (hfConfig[2]) {
          const currentHf = await publicClient.readContract({
            address: HEALTH_FACTOR_HOOK_ADDRESS,
            abi: HEALTH_FACTOR_HOOK_ABI,
            functionName: 'getCurrentHealthFactor',
            args: [address],
          }) as bigint

          if (id !== fetchIdRef.current) return

          setHealthFactor(currentHf)
        }
      } catch {
        if (id !== fetchIdRef.current) return
        // Health factor hook may not be installed
        setHealthFactorInfo(null)
      }

      // For positions, we'd query events or an indexer in production.
      // For now, check which assets have been supplied/borrowed by reading
      // the executor's state. Since there's no direct getter for positions
      // in the ABI, we use asset checking per market.
      const positionPromises = markets.map(async (market) => {
        try {
          const isAllowed = await publicClient.readContract({
            address: LENDING_EXECUTOR_ADDRESS,
            abi: LENDING_EXECUTOR_ABI,
            functionName: 'isAssetAllowed',
            args: [address, market.asset.address],
          }) as boolean

          // If the asset is allowed, it may have a position
          // In a real implementation, we'd query the lending pool contract
          // For demo purposes, we return empty positions
          return null
        } catch {
          return null
        }
      })

      await Promise.all(positionPromises)
      // Positions would be populated from events/indexer in production
    } catch {
      if (id !== fetchIdRef.current) return
      setExecutorInstalled(false)
      setAccountConfig(null)
      setPositions([])
      setHealthFactor(null)
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [address, publicClient, markets])

  useEffect(() => {
    fetchAccountData()
  }, [fetchAccountData])

  const sendExecutorOp = useCallback(
    async (calldata: Hex): Promise<Hex | null> => {
      if (!address) {
        setError('Wallet not connected')
        return null
      }
      if (!executorInstalled) {
        setError('Lending Executor module not installed. Install it from the Marketplace.')
        return null
      }

      setIsExecuting(true)
      setError(null)
      try {
        const result = await sendUserOp(address, {
          to: LENDING_EXECUTOR_ADDRESS,
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

  const supply = useCallback(
    async (asset: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: LENDING_EXECUTOR_ABI,
        functionName: 'supply',
        args: [asset, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const withdraw = useCallback(
    async (asset: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: LENDING_EXECUTOR_ABI,
        functionName: 'withdraw',
        args: [asset, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const borrow = useCallback(
    async (asset: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: LENDING_EXECUTOR_ABI,
        functionName: 'borrow',
        args: [asset, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  const repay = useCallback(
    async (asset: Address, amount: bigint) => {
      const calldata = encodeFunctionData({
        abi: LENDING_EXECUTOR_ABI,
        functionName: 'repay',
        args: [asset, amount],
      })
      return sendExecutorOp(calldata)
    },
    [sendExecutorOp]
  )

  return {
    markets,
    positions,
    accountConfig,
    healthFactor,
    healthFactorInfo,
    isLoading,
    isExecuting,
    error,
    executorInstalled,
    supply,
    withdraw,
    borrow,
    repay,
    refetch: fetchAccountData,
    clearError: () => setError(null),
  }
}
