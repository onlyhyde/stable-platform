'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Address, formatUnits, type Hex } from 'viem'
import { useChainId } from 'wagmi'
import { getContractAddresses } from '../lib/config'
import { useStableNetContext } from '../providers/StableNetProvider'
import { useWallet } from './useWallet'

// SubscriptionManager event ABIs
const SUBSCRIPTION_EVENTS_ABI = [
  {
    type: 'event',
    name: 'PaymentProcessed',
    inputs: [
      { name: 'planId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionCreated',
    inputs: [
      { name: 'planId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionCancelled',
    inputs: [
      { name: 'planId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PlanCreated',
    inputs: [
      { name: 'planId', type: 'uint256', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
    ],
  },
] as const

// Default SubscriptionManager address
const DEFAULT_SUBSCRIPTION_MANAGER = '0x9d4454B023096f34B160D6B654540c56A1F81688' as const

// Token info for formatting
const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
  '0x322813fd9a801c5507c9de605d63cea4f2ce6c44': { symbol: 'USDC', decimals: 6 },
}

// Time constants
const SECONDS_PER_DAY = 86400
const BLOCKS_PER_SECOND_ESTIMATE = 1 // Local chain: ~1 block per second

export interface PaymentEvent {
  planId: bigint
  subscriber: Address
  amount: bigint
  timestamp: bigint
  txHash: Hex
  blockNumber: bigint
}

export interface SubscriptionEvent {
  type: 'created' | 'cancelled'
  planId: bigint
  subscriber: Address
  txHash: Hex
  blockNumber: bigint
  timestamp: bigint
}

export interface PaymentDataPoint {
  date: string
  successful: number
  failed: number
  revenue: number
}

export interface MerchantEventStats {
  totalRevenue: number
  revenueChange: number
  totalPayments: number
  paymentSuccessRate: number
  avgTransactionValue: number
  avgValueChange: number
  newSubscriptions: number
  subscriptionChange: number
}

export interface TransactionRecord {
  id: string
  subscriptionId: string
  subscriberAddress: string
  amount: number
  token: string
  status: 'success' | 'failed' | 'pending' | 'refunded'
  txHash: string
  createdAt: Date
}

export interface UseSubscriptionEventsReturn {
  payments: PaymentEvent[]
  subscriptionEvents: SubscriptionEvent[]
  paymentData: PaymentDataPoint[]
  transactions: TransactionRecord[]
  stats: MerchantEventStats
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function getTimeRangeDays(timeRange: '7d' | '30d' | '90d'): number {
  switch (timeRange) {
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
  }
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useSubscriptionEvents(
  timeRange: '7d' | '30d' | '90d' = '30d'
): UseSubscriptionEventsReturn {
  const { address } = useWallet()
  const { publicClient } = useStableNetContext()
  const chainId = useChainId()

  const [payments, setPayments] = useState<PaymentEvent[]>([])
  const [subscriptionEvents, setSubscriptionEvents] = useState<SubscriptionEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  const subscriptionManager = (() => {
    const contracts = getContractAddresses(chainId)
    return (contracts?.subscriptionManager ?? DEFAULT_SUBSCRIPTION_MANAGER) as Address
  })()

  const fetchEvents = useCallback(async () => {
    if (!publicClient || !address) return

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const currentBlock = await publicClient.getBlockNumber()
      const days = getTimeRangeDays(timeRange)
      // Estimate blocks for the time range (double it for comparison period)
      const blocksNeeded = BigInt(days * 2 * SECONDS_PER_DAY * BLOCKS_PER_SECOND_ESTIMATE)
      const fromBlock = currentBlock > blocksNeeded ? currentBlock - blocksNeeded : 0n

      // Fetch PaymentProcessed events (merchant is indexed as topic - subscriber pays merchant)
      // Since PaymentProcessed indexes planId and subscriber, we fetch all and filter client-side
      const [paymentLogs, createdLogs, cancelledLogs] = await Promise.all([
        publicClient.getLogs({
          address: subscriptionManager,
          event: SUBSCRIPTION_EVENTS_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        }),
        publicClient.getLogs({
          address: subscriptionManager,
          event: SUBSCRIPTION_EVENTS_ABI[1],
          fromBlock,
          toBlock: currentBlock,
        }),
        publicClient.getLogs({
          address: subscriptionManager,
          event: SUBSCRIPTION_EVENTS_ABI[2],
          fromBlock,
          toBlock: currentBlock,
        }),
      ])

      // Process payment events
      const paymentEvents: PaymentEvent[] = paymentLogs.map((log) => ({
        planId: (log.args as { planId: bigint }).planId,
        subscriber: (log.args as { subscriber: Address }).subscriber,
        amount: (log.args as { amount: bigint }).amount,
        timestamp: (log.args as { timestamp: bigint }).timestamp,
        txHash: log.transactionHash as Hex,
        blockNumber: log.blockNumber,
      }))

      // Process subscription events
      const subEvents: SubscriptionEvent[] = [
        ...createdLogs.map((log) => ({
          type: 'created' as const,
          planId: (log.args as { planId: bigint }).planId,
          subscriber: (log.args as { subscriber: Address }).subscriber,
          txHash: log.transactionHash as Hex,
          blockNumber: log.blockNumber,
          // Estimate timestamp from block number relative to current time
          timestamp: BigInt(Math.floor(Date.now() / 1000)) -
            (currentBlock - log.blockNumber) * BigInt(BLOCKS_PER_SECOND_ESTIMATE),
        })),
        ...cancelledLogs.map((log) => ({
          type: 'cancelled' as const,
          planId: (log.args as { planId: bigint }).planId,
          subscriber: (log.args as { subscriber: Address }).subscriber,
          txHash: log.transactionHash as Hex,
          blockNumber: log.blockNumber,
          timestamp: BigInt(Math.floor(Date.now() / 1000)) -
            (currentBlock - log.blockNumber) * BigInt(BLOCKS_PER_SECOND_ESTIMATE),
        })),
      ]

      if (id !== fetchIdRef.current) return
      setPayments(paymentEvents)
      setSubscriptionEvents(subEvents)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription events'
      setError(message)
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient, address, subscriptionManager, timeRange])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Derived: aggregate payments into daily chart data
  const paymentData: PaymentDataPoint[] = (() => {
    const days = getTimeRangeDays(timeRange)
    const now = Math.floor(Date.now() / 1000)
    const startTimestamp = now - days * SECONDS_PER_DAY

    // Create date buckets
    const buckets = new Map<string, PaymentDataPoint>()
    for (let i = 0; i < days; i++) {
      const dayTs = startTimestamp + i * SECONDS_PER_DAY
      const dateStr = formatDate(dayTs)
      buckets.set(dateStr, { date: dateStr, successful: 0, failed: 0, revenue: 0 })
    }

    // Fill buckets from payment events
    for (const payment of payments) {
      const ts = Number(payment.timestamp)
      if (ts < startTimestamp) continue

      const dateStr = formatDate(ts)
      const bucket = buckets.get(dateStr)
      if (bucket) {
        bucket.successful += 1
        // Default to USDC (6 decimals) for revenue calculation
        bucket.revenue += Number(formatUnits(payment.amount, 6))
      }
    }

    return Array.from(buckets.values())
  })()

  // Derived: recent transactions for the table
  const transactions: TransactionRecord[] = payments
    .filter((p) => {
      const days = getTimeRangeDays(timeRange)
      const cutoff = BigInt(Math.floor(Date.now() / 1000) - days * SECONDS_PER_DAY)
      return p.timestamp >= cutoff
    })
    .sort((a, b) => Number(b.timestamp - a.timestamp))
    .slice(0, 20)
    .map((p, idx) => ({
      id: `${p.txHash.slice(0, 10)}-${idx}`,
      subscriptionId: p.planId.toString(),
      subscriberAddress: p.subscriber,
      amount: Number(formatUnits(p.amount, 6)),
      token: 'USDC',
      status: 'success' as const,
      txHash: p.txHash,
      createdAt: new Date(Number(p.timestamp) * 1000),
    }))

  // Derived: stats with period comparison
  const stats: MerchantEventStats = (() => {
    const days = getTimeRangeDays(timeRange)
    const now = Math.floor(Date.now() / 1000)
    const currentPeriodStart = now - days * SECONDS_PER_DAY
    const previousPeriodStart = now - days * 2 * SECONDS_PER_DAY

    // Current period payments
    const currentPayments = payments.filter(
      (p) => Number(p.timestamp) >= currentPeriodStart
    )
    const previousPayments = payments.filter(
      (p) =>
        Number(p.timestamp) >= previousPeriodStart &&
        Number(p.timestamp) < currentPeriodStart
    )

    // Revenue
    const currentRevenue = currentPayments.reduce(
      (sum, p) => sum + Number(formatUnits(p.amount, 6)),
      0
    )
    const previousRevenue = previousPayments.reduce(
      (sum, p) => sum + Number(formatUnits(p.amount, 6)),
      0
    )
    const revenueChange =
      previousRevenue > 0
        ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
        : currentRevenue > 0
          ? 100
          : 0

    // Payments count
    const totalPayments = currentPayments.length

    // Average transaction value
    const avgValue = totalPayments > 0 ? currentRevenue / totalPayments : 0
    const prevAvg =
      previousPayments.length > 0 ? previousRevenue / previousPayments.length : 0
    const avgValueChange =
      prevAvg > 0
        ? Math.round(((avgValue - prevAvg) / prevAvg) * 100)
        : avgValue > 0
          ? 100
          : 0

    // Subscriptions
    const currentSubs = subscriptionEvents.filter(
      (e) => e.type === 'created' && Number(e.timestamp) >= currentPeriodStart
    ).length
    const previousSubs = subscriptionEvents.filter(
      (e) =>
        e.type === 'created' &&
        Number(e.timestamp) >= previousPeriodStart &&
        Number(e.timestamp) < currentPeriodStart
    ).length
    const subscriptionChange =
      previousSubs > 0
        ? Math.round(((currentSubs - previousSubs) / previousSubs) * 100)
        : currentSubs > 0
          ? 100
          : 0

    return {
      totalRevenue: currentRevenue,
      revenueChange,
      totalPayments,
      paymentSuccessRate: totalPayments > 0 ? 100 : 0,
      avgTransactionValue: avgValue,
      avgValueChange,
      newSubscriptions: currentSubs,
      subscriptionChange,
    }
  })()

  return {
    payments,
    subscriptionEvents,
    paymentData,
    transactions,
    stats,
    isLoading,
    error,
    refetch: fetchEvents,
  }
}
