'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Address,
  encodePacked,
  formatUnits,
  keccak256,
  maxUint256,
  parseEventLogs,
  toHex,
} from 'viem'
import { useChainId, useWalletClient } from 'wagmi'
import { getContractAddresses } from '../lib/config'
import { useStableNetContext } from '../providers/StableNetProvider'
import type {
  CreatePlanParams,
  MerchantStats,
  PlanDisplayInfo,
  SubscriptionDisplayInfo,
  SubscriptionStatus,
} from '../types/subscription'
import { getIntervalLabel, getStatusInfo } from '../types/subscription'
import { useWallet } from './useWallet'

// Default fallback addresses for development
const DEFAULT_subscriptionManager = '0x9d4454B023096f34B160D6B654540c56A1F81688' as const
const DEFAULT_permissionManager = '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf' as const
const DEFAULT_recurringPaymentExecutor = '0x998abeb3E57409262aE5b751f60747921B33613E' as const

// ABI fragments for PermissionManager (ERC-7715)
const permissionManager_ABI = [
  {
    name: 'grantPermission',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'validUntil', type: 'uint256' },
    ],
    outputs: [{ name: 'permissionId', type: 'bytes32' }],
  },
  {
    name: 'revokePermission',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'isPermissionValid',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getPermission',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'validUntil', type: 'uint256' },
      { name: 'usedAllowance', type: 'uint256' },
      { name: 'lastResetTime', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
  },
] as const

// ABI fragments for subscription manager
const subscriptionManager_ABI = [
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

// ABI for PermissionGranted event (used for type-safe log parsing)
const permissionGrantedEvent_ABI = [
  {
    type: 'event',
    name: 'PermissionGranted',
    inputs: [
      { name: 'permissionId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'operator', type: 'address', indexed: false },
    ],
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

export function useSubscription(config: UseSubscriptionConfig = {}): UseSubscriptionReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = config

  const { address, isConnected } = useWallet()
  const { publicClient } = useStableNetContext()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()

  // Get contract addresses from config based on chain ID
  const { subscriptionManager, permissionManager, recurringPaymentExecutor } = useMemo(() => {
    const contracts = getContractAddresses(chainId)
    return {
      subscriptionManager: (contracts?.subscriptionManager ??
        DEFAULT_subscriptionManager) as Address,
      permissionManager: (contracts?.permissionManager ?? DEFAULT_permissionManager) as Address,
      recurringPaymentExecutor: DEFAULT_recurringPaymentExecutor as Address, // Not in config yet
    }
  }, [chainId])

  // State
  const [plans, setPlans] = useState<PlanDisplayInfo[]>([])
  const [mySubscriptions, setMySubscriptions] = useState<SubscriptionDisplayInfo[]>([])
  const [merchantPlans, setMerchantPlans] = useState<PlanDisplayInfo[]>([])
  const [merchantStats, setMerchantStats] = useState<MerchantStats | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchIdRef = useRef(0)

  // Helper: Convert raw plan data to display info
  const toPlanDisplayInfo = useCallback(
    (id: bigint, rawPlan: readonly unknown[]): PlanDisplayInfo => {
      const [
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
      ] = rawPlan as readonly [
        Address,
        string,
        string,
        bigint,
        bigint,
        Address,
        boolean,
        bigint,
        bigint,
        bigint,
        bigint,
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
    },
    []
  )

  // Load all plans
  const loadPlans = useCallback(async () => {
    if (!publicClient) return

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const planCount = (await publicClient.readContract({
        address: subscriptionManager,
        abi: subscriptionManager_ABI,
        functionName: 'planCount',
      })) as bigint

      const planPromises: Promise<PlanDisplayInfo>[] = []
      for (let i = 1n; i <= planCount; i++) {
        planPromises.push(
          publicClient
            .readContract({
              address: subscriptionManager,
              abi: subscriptionManager_ABI,
              functionName: 'plans',
              args: [i],
            })
            .then((data) => toPlanDisplayInfo(i, data as readonly unknown[]))
        )
      }

      const loadedPlans = await Promise.all(planPromises)
      if (id !== fetchIdRef.current) return
      setPlans(loadedPlans.filter((p) => p.isActive))
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to load plans'))
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient, toPlanDisplayInfo, subscriptionManager])

  // Load user's subscriptions
  const loadMySubscriptions = useCallback(async () => {
    if (!publicClient || !address) return

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const planIds = (await publicClient.readContract({
        address: subscriptionManager,
        abi: subscriptionManager_ABI,
        functionName: 'getSubscriberSubscriptions',
        args: [address],
      })) as bigint[]

      const subscriptionPromises = planIds.map(async (planId) => {
        const [planData, subData] = await Promise.all([
          publicClient.readContract({
            address: subscriptionManager,
            abi: subscriptionManager_ABI,
            functionName: 'plans',
            args: [planId],
          }),
          publicClient.readContract({
            address: subscriptionManager,
            abi: subscriptionManager_ABI,
            functionName: 'getSubscription',
            args: [address, planId],
          }),
        ])

        const plan = toPlanDisplayInfo(planId, planData as readonly unknown[])
        const [startTime, lastPaymentTime, nextPaymentTime, statusEnum, permissionId] =
          subData as readonly [bigint, bigint, bigint, number, `0x${string}`]

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
      if (id !== fetchIdRef.current) return
      setMySubscriptions(subscriptions)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to load subscriptions'))
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient, address, toPlanDisplayInfo, subscriptionManager])

  // Load merchant's plans
  const loadMerchantPlans = useCallback(async () => {
    if (!publicClient || !address) return

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const planIds = (await publicClient.readContract({
        address: subscriptionManager,
        abi: subscriptionManager_ABI,
        functionName: 'getMerchantPlans',
        args: [address],
      })) as bigint[]

      const planPromises = planIds.map(async (planId) => {
        const planData = await publicClient.readContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
          functionName: 'plans',
          args: [planId],
        })
        return toPlanDisplayInfo(planId, planData as readonly unknown[])
      })

      const loadedPlans = await Promise.all(planPromises)
      if (id !== fetchIdRef.current) return

      setMerchantPlans(loadedPlans)

      // Calculate stats
      const totalSubscribers = loadedPlans.reduce((sum, p) => sum + Number(p.subscriberCount), 0)
      const activeSubscribers = loadedPlans
        .filter((p) => p.isActive)
        .reduce((sum, p) => sum + Number(p.subscriberCount), 0)

      // Estimate revenue from plan data
      const SECONDS_PER_MONTH = 2_592_000n // 30 days
      const nowSeconds = BigInt(Math.floor(Date.now() / 1000))

      let monthlyRevenue = 0n
      let totalRevenue = 0n
      for (const plan of loadedPlans) {
        if (!plan.isActive || plan.interval === 0n) continue
        // Monthly revenue: price * subscribers * (seconds_per_month / interval)
        const paymentsPerMonth = SECONDS_PER_MONTH / plan.interval
        monthlyRevenue += plan.price * plan.subscriberCount * paymentsPerMonth
        // Total revenue estimate: price * subscribers * payments since creation
        if (plan.createdAt > 0n && plan.createdAt < nowSeconds) {
          const elapsed = nowSeconds - plan.createdAt
          const estimatedPayments = elapsed / plan.interval
          totalRevenue += plan.price * plan.subscriberCount * estimatedPayments
        }
      }

      setMerchantStats({
        totalPlans: loadedPlans.length,
        totalSubscribers,
        activeSubscribers,
        totalRevenue,
        monthlyRevenue,
      })
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to load merchant plans'))
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient, address, toPlanDisplayInfo, subscriptionManager])

  // Request ERC-7715 permission
  const requestPermission = useCallback(
    async (plan: PlanDisplayInfo): Promise<`0x${string}`> => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      // Calculate permission parameters
      const allowancePerPeriod = plan.price
      const period = plan.interval
      // Permission valid for 1 year or 365 payment cycles, whichever is longer
      const validUntil = BigInt(Math.floor(Date.now() / 1000)) + BigInt(365 * 24 * 60 * 60)

      // Build ERC-7715 permission request
      const permissionRequest = {
        permissions: [
          {
            type: 'native-token-recurring-allowance' as const,
            data: {
              allowance: allowancePerPeriod.toString(),
              period: period.toString(),
              start: Math.floor(Date.now() / 1000),
            },
            policies: [
              {
                type: 'token-allowance' as const,
                data: {
                  token: plan.token,
                  allowance: allowancePerPeriod.toString(),
                },
              },
            ],
            required: true,
          },
        ],
        expiry: Number(validUntil),
      }

      try {
        // Try ERC-7715 wallet_grantPermissions first (modern wallets)
        // biome-ignore lint/suspicious/noExplicitAny: wallet_grantPermissions is a non-standard ERC-7715 RPC method not typed in viem
        const response = await (walletClient as any).request({
          method: 'wallet_grantPermissions',
          params: [permissionRequest],
        })

        // Extract permissionId from response
        if (response && typeof response === 'object' && 'permissionId' in response) {
          return (response as { permissionId: `0x${string}` }).permissionId
        }

        // Fallback: Some wallets may return the permissionId directly
        if (typeof response === 'string' && response.startsWith('0x')) {
          return response as `0x${string}`
        }

        throw new Error('Invalid permission response from wallet')
      } catch (err: unknown) {
        // Check if wallet doesn't support ERC-7715
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (
          errorMessage.includes('not supported') ||
          errorMessage.includes('unknown method') ||
          errorMessage.includes('Method not found')
        ) {
          // Wallet does not support ERC-7715, fallback to direct contract call on PermissionManager
          if (!walletClient) throw new Error('Wallet disconnected during operation')
          const permissionTxHash = await walletClient.writeContract({
            address: permissionManager,
            abi: permissionManager_ABI,
            functionName: 'grantPermission',
            args: [
              recurringPaymentExecutor, // operator
              plan.token, // token
              allowancePerPeriod, // allowance per period
              period, // period
              validUntil, // validUntil
            ],
          })

          // Wait for transaction and extract permissionId from logs
          const receipt = await publicClient.waitForTransactionReceipt({ hash: permissionTxHash })

          // Type-safe event log parsing via viem
          const parsedLogs = parseEventLogs({
            abi: permissionGrantedEvent_ABI,
            eventName: 'PermissionGranted',
            logs: receipt.logs,
          })

          const permissionLog = parsedLogs.find(
            (log) => log.address.toLowerCase() === permissionManager.toLowerCase()
          )

          if (permissionLog) {
            return permissionLog.args.permissionId as `0x${string}`
          }

          // Fallback: generate a cryptographically random permissionId via
          // keccak256(abi.encodePacked(address, operator, token, randomNonce))
          // This prevents collision and is unpredictable.
          const randomNonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
          const permissionId = keccak256(
            encodePacked(
              ['address', 'address', 'address', 'bytes32'],
              [
                address as Address,
                recurringPaymentExecutor,
                plan.token,
                randomNonce as `0x${string}`,
              ]
            )
          )

          return permissionId
        }

        // Re-throw other errors
        throw err
      }
    },
    [walletClient, publicClient, address, permissionManager, recurringPaymentExecutor]
  )

  // Subscribe to a plan
  const subscribe = useCallback(
    async (planId: bigint): Promise<`0x${string}`> => {
      if (!publicClient || !address || !walletClient) {
        throw new Error('Wallet not connected')
      }

      setIsSubscribing(true)
      setError(null)

      try {
        // Get the plan to check if payment is needed and for permission request
        const planData = (await publicClient.readContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
          functionName: 'plans',
          args: [planId],
        })) as readonly unknown[]

        const plan = toPlanDisplayInfo(planId, planData)

        // Step 1: Request ERC-7715 permission for recurring payments
        const permissionId = await requestPermission(plan)

        // Step 1.5: ERC-20 approve if needed (native ETH doesn't need approval)
        const isNativeToken = plan.token === '0x0000000000000000000000000000000000000000'
        if (!isNativeToken) {
          const currentAllowance = (await publicClient.readContract({
            address: plan.token,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, subscriptionManager],
          })) as bigint

          if (currentAllowance < plan.price) {
            const approveTxHash = await walletClient.writeContract({
              address: plan.token,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [subscriptionManager, maxUint256],
            })
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
          }

          // Also approve permissionManager for recurring payment execution
          const pmAllowance = (await publicClient.readContract({
            address: plan.token,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, permissionManager],
          })) as bigint

          if (pmAllowance < plan.price) {
            const pmApproveTxHash = await walletClient.writeContract({
              address: plan.token,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [permissionManager, maxUint256],
            })
            await publicClient.waitForTransactionReceipt({ hash: pmApproveTxHash })
          }
        }

        // Step 2: Subscribe with the permission ID
        if (!walletClient) throw new Error('Wallet disconnected during operation')
        const txHash = await walletClient.writeContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
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
    },
    [
      publicClient,
      address,
      walletClient,
      toPlanDisplayInfo,
      requestPermission,
      subscriptionManager,
      permissionManager,
    ]
  )

  // Cancel subscription
  const cancelSubscription = useCallback(
    async (planId: bigint): Promise<`0x${string}`> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      setIsCancelling(true)
      setError(null)

      try {
        // Send cancel subscription transaction
        const txHash = await walletClient.writeContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
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
    },
    [address, walletClient, publicClient, subscriptionManager]
  )

  // Create a new plan (for merchants)
  const createPlan = useCallback(
    async (params: CreatePlanParams): Promise<bigint> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      setIsCreatingPlan(true)
      setError(null)

      try {
        // Send create plan transaction
        const txHash = await walletClient.writeContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
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
        const _receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        // Get the new plan count (the plan ID is planCount - 1 since it's 0-indexed after creation)
        const planCount = (await publicClient.readContract({
          address: subscriptionManager,
          abi: subscriptionManager_ABI,
          functionName: 'planCount',
        })) as bigint

        // Return the new plan ID (last created)
        return planCount - 1n
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create plan')
        setError(error)
        throw error
      } finally {
        setIsCreatingPlan(false)
      }
    },
    [address, walletClient, publicClient, subscriptionManager]
  )

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

// Export default contract addresses for external use
// For chain-specific addresses, use getContractAddresses(chainId)
export const SUBSCRIPTION_CONTRACTS = {
  subscriptionManager: DEFAULT_subscriptionManager,
  permissionManager: DEFAULT_permissionManager,
  recurringPaymentExecutor: DEFAULT_recurringPaymentExecutor,
} as const
