'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { type Address, formatUnits, parseUnits } from 'viem'
import { useWalletClient } from 'wagmi'
import { useWallet } from './useWallet'
import { useStableNetContext } from '../providers/StableNetProvider'
import type {
  SubscriptionPlan,
  UserSubscription,
  PlanDisplayInfo,
  SubscriptionDisplayInfo,
  CreatePlanParams,
  PaymentHistoryEntry,
  MerchantStats,
  SubscriptionStatus,
} from '../types/subscription'
import { getIntervalLabel, getStatusInfo } from '../types/subscription'

// Contract addresses - these should come from @stablenet/contracts
const SUBSCRIPTION_MANAGER = '0x9d4454B023096f34B160D6B654540c56A1F81688' as const
const PERMISSION_MANAGER = '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf' as const
const RECURRING_PAYMENT_EXECUTOR = '0x998abeb3E57409262aE5b751f60747921B33613E' as const

// ABI fragments for subscription manager
const SUBSCRIPTION_MANAGER_ABI = [
  {
    name: 'planCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'plans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [
      { name: 'merchant', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'subscriberCount', type: 'uint256' },
      { name: 'trialPeriod', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'getSubscription',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'planId', type: 'uint256' },
    ],
    outputs: [
      { name: 'startTime', type: 'uint256' },
      { name: 'lastPaymentTime', type: 'uint256' },
      { name: 'nextPaymentTime', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'permissionId', type: 'bytes32' },
    ],
  },
  {
    name: 'getSubscriberSubscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [{ name: 'planIds', type: 'uint256[]' }],
  },
  {
    name: 'getMerchantPlans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: 'planIds', type: 'uint256[]' }],
  },
  {
    name: 'createPlan',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'trialPeriod', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
    ],
    outputs: [{ name: 'planId', type: 'uint256' }],
  },
  {
    name: 'subscribe',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'permissionId', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'cancelSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'protocolFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

// Token info cache
const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
  '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44': { symbol: 'USDC', decimals: 6 },
}

interface UseSubscriptionConfig {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseSubscriptionReturn {
  // Data
  plans: PlanDisplayInfo[]
  mySubscriptions: SubscriptionDisplayInfo[]
  merchantPlans: PlanDisplayInfo[]
  merchantStats: MerchantStats | null

  // State
  isLoading: boolean
  isSubscribing: boolean
  isCancelling: boolean
  isCreatingPlan: boolean
  error: Error | null

  // Actions
  loadPlans: () => Promise<void>
  loadMySubscriptions: () => Promise<void>
  loadMerchantPlans: () => Promise<void>
  subscribe: (planId: bigint) => Promise<`0x${string}`>
  cancelSubscription: (planId: bigint) => Promise<`0x${string}`>
  createPlan: (params: CreatePlanParams) => Promise<bigint>
  refetch: () => Promise<void>
  clearError: () => void
}

export function useSubscription(config: UseSubscriptionConfig = {}): UseSubscriptionReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = config

  const { address, isConnected } = useWallet()
  const { publicClient } = useStableNetContext()
  const { data: walletClient } = useWalletClient()

  // State
  const [plans, setPlans] = useState<PlanDisplayInfo[]>([])
  const [mySubscriptions, setMySubscriptions] = useState<SubscriptionDisplayInfo[]>([])
  const [merchantPlans, setMerchantPlans] = useState<PlanDisplayInfo[]>([])
  const [merchantStats, setMerchantStats] = useState<MerchantStats | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Helper: Convert raw plan data to display info
  const toPlanDisplayInfo = useCallback((id: bigint, rawPlan: readonly unknown[]): PlanDisplayInfo => {
    const [merchant, name, description, price, interval, token, isActive, subscriberCount, trialPeriod, gracePeriod, createdAt] = rawPlan as readonly [
      Address, string, string, bigint, bigint, Address, boolean, bigint, bigint, bigint, bigint
    ]

    const tokenInfo = TOKEN_INFO[token.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 }

    return {
      id,
      merchant,
      name,
      description,
      price,
      interval,
      token,
      isActive,
      subscriberCount,
      trialPeriod,
      gracePeriod,
      createdAt,
      priceFormatted: `${formatUnits(price, tokenInfo.decimals)} ${tokenInfo.symbol}`,
      intervalFormatted: getIntervalLabel(interval),
      tokenSymbol: tokenInfo.symbol,
      tokenDecimals: tokenInfo.decimals,
    }
  }, [])

  // Helper: Get subscription status from enum
  const getStatusFromEnum = (statusEnum: number): SubscriptionStatus => {
    const statusMap: Record<number, SubscriptionStatus> = {
      0: 'active',
      1: 'trial',
      2: 'grace',
      3: 'cancelled',
      4: 'expired',
    }
    return statusMap[statusEnum] || 'expired'
  }

  // Load all plans
  const loadPlans = useCallback(async () => {
    if (!publicClient) return

    setIsLoading(true)
    setError(null)

    try {
      const planCount = await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'planCount',
      }) as bigint

      const planPromises: Promise<PlanDisplayInfo>[] = []
      for (let i = 1n; i <= planCount; i++) {
        planPromises.push(
          publicClient.readContract({
            address: SUBSCRIPTION_MANAGER,
            abi: SUBSCRIPTION_MANAGER_ABI,
            functionName: 'plans',
            args: [i],
          }).then((data) => toPlanDisplayInfo(i, data as readonly unknown[]))
        )
      }

      const loadedPlans = await Promise.all(planPromises)
      setPlans(loadedPlans.filter((p) => p.isActive))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load plans'))
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, toPlanDisplayInfo])

  // Load user's subscriptions
  const loadMySubscriptions = useCallback(async () => {
    if (!publicClient || !address) return

    setIsLoading(true)
    setError(null)

    try {
      const planIds = await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscriberSubscriptions',
        args: [address],
      }) as bigint[]

      const subscriptionPromises = planIds.map(async (planId) => {
        const [planData, subData] = await Promise.all([
          publicClient.readContract({
            address: SUBSCRIPTION_MANAGER,
            abi: SUBSCRIPTION_MANAGER_ABI,
            functionName: 'plans',
            args: [planId],
          }),
          publicClient.readContract({
            address: SUBSCRIPTION_MANAGER,
            abi: SUBSCRIPTION_MANAGER_ABI,
            functionName: 'getSubscription',
            args: [address, planId],
          }),
        ])

        const plan = toPlanDisplayInfo(planId, planData as readonly unknown[])
        const [startTime, lastPaymentTime, nextPaymentTime, statusEnum, permissionId] = subData as readonly [
          bigint, bigint, bigint, number, `0x${string}`
        ]

        const status = getStatusFromEnum(statusEnum)
        const statusInfo = getStatusInfo(status)

        return {
          planId,
          subscriber: address,
          startTime,
          lastPaymentTime,
          nextPaymentTime,
          status,
          permissionId,
          plan,
          nextPaymentFormatted: new Date(Number(nextPaymentTime) * 1000).toLocaleDateString(),
          statusLabel: statusInfo.label,
          statusColor: statusInfo.color,
        } satisfies SubscriptionDisplayInfo
      })

      const subscriptions = await Promise.all(subscriptionPromises)
      setMySubscriptions(subscriptions)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load subscriptions'))
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, address, toPlanDisplayInfo])

  // Load merchant's plans
  const loadMerchantPlans = useCallback(async () => {
    if (!publicClient || !address) return

    setIsLoading(true)
    setError(null)

    try {
      const planIds = await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getMerchantPlans',
        args: [address],
      }) as bigint[]

      const planPromises = planIds.map(async (planId) => {
        const planData = await publicClient.readContract({
          address: SUBSCRIPTION_MANAGER,
          abi: SUBSCRIPTION_MANAGER_ABI,
          functionName: 'plans',
          args: [planId],
        })
        return toPlanDisplayInfo(planId, planData as readonly unknown[])
      })

      const loadedPlans = await Promise.all(planPromises)
      setMerchantPlans(loadedPlans)

      // Calculate stats
      const totalSubscribers = loadedPlans.reduce((sum, p) => sum + Number(p.subscriberCount), 0)
      const activeSubscribers = loadedPlans.filter((p) => p.isActive).reduce((sum, p) => sum + Number(p.subscriberCount), 0)

      setMerchantStats({
        totalPlans: loadedPlans.length,
        totalSubscribers,
        activeSubscribers,
        totalRevenue: 0n, // Would need to query events
        monthlyRevenue: 0n,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load merchant plans'))
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, address, toPlanDisplayInfo])

  // Subscribe to a plan
  const subscribe = useCallback(async (planId: bigint): Promise<`0x${string}`> => {
    if (!publicClient || !address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsSubscribing(true)
    setError(null)

    try {
      // For now, use a placeholder permission ID
      // In production, this would come from the permission grant flow
      const permissionId = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      // Get the plan to check if payment is needed
      const planData = await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'plans',
        args: [planId],
      }) as readonly unknown[]

      const plan = toPlanDisplayInfo(planId, planData)

      // Encode and send the subscribe transaction
      const txHash = await walletClient.writeContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'subscribe',
        args: [planId, permissionId],
        value: plan.token === '0x0000000000000000000000000000000000000000' ? plan.price : 0n,
      })

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      return txHash
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to subscribe')
      setError(error)
      throw error
    } finally {
      setIsSubscribing(false)
    }
  }, [publicClient, address, walletClient, toPlanDisplayInfo])

  // Cancel subscription
  const cancelSubscription = useCallback(async (planId: bigint): Promise<`0x${string}`> => {
    if (!address || !walletClient || !publicClient) {
      throw new Error('Wallet not connected')
    }

    setIsCancelling(true)
    setError(null)

    try {
      // Send cancel subscription transaction
      const txHash = await walletClient.writeContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'cancelSubscription',
        args: [planId],
      })

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      return txHash
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to cancel subscription')
      setError(error)
      throw error
    } finally {
      setIsCancelling(false)
    }
  }, [address, walletClient, publicClient])

  // Create a new plan (for merchants)
  const createPlan = useCallback(async (params: CreatePlanParams): Promise<bigint> => {
    if (!address || !walletClient || !publicClient) {
      throw new Error('Wallet not connected')
    }

    setIsCreatingPlan(true)
    setError(null)

    try {
      // Send create plan transaction
      const txHash = await walletClient.writeContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'createPlan',
        args: [
          params.name,
          params.description,
          params.price,
          params.interval,
          params.token,
          params.trialPeriod ?? 0n,
          params.gracePeriod ?? 0n,
        ],
      })

      // Wait for transaction receipt to get the plan ID from logs
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      // Get the new plan count (the plan ID is planCount - 1 since it's 0-indexed after creation)
      const planCount = await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'planCount',
      }) as bigint

      // Return the new plan ID (last created)
      return planCount - 1n
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create plan')
      setError(error)
      throw error
    } finally {
      setIsCreatingPlan(false)
    }
  }, [address, walletClient, publicClient])

  // Refetch all data
  const refetch = useCallback(async () => {
    await Promise.all([loadPlans(), loadMySubscriptions(), loadMerchantPlans()])
  }, [loadPlans, loadMySubscriptions, loadMerchantPlans])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && isConnected) {
      const interval = setInterval(refetch, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, isConnected, refreshInterval, refetch])

  // Initial load
  useEffect(() => {
    if (isConnected && publicClient) {
      loadPlans()
    }
  }, [isConnected, publicClient, loadPlans])

  return {
    // Data
    plans,
    mySubscriptions,
    merchantPlans,
    merchantStats,

    // State
    isLoading,
    isSubscribing,
    isCancelling,
    isCreatingPlan,
    error,

    // Actions
    loadPlans,
    loadMySubscriptions,
    loadMerchantPlans,
    subscribe,
    cancelSubscription,
    createPlan,
    refetch,
    clearError,
  }
}

// Export contract addresses for external use
export const SUBSCRIPTION_CONTRACTS = {
  subscriptionManager: SUBSCRIPTION_MANAGER,
  permissionManager: PERMISSION_MANAGER,
  recurringPaymentExecutor: RECURRING_PAYMENT_EXECUTOR,
} as const
