/**
 * Subscription Types for Wallet App
 */

import type { Address } from 'viem'

/**
 * Subscription plan as returned from the contract
 */
export interface SubscriptionPlan {
  id: bigint
  merchant: Address
  name: string
  description: string
  price: bigint
  interval: bigint // in seconds
  token: Address // 0x0 for native token
  isActive: boolean
  subscriberCount: bigint
  trialPeriod: bigint
  gracePeriod: bigint
  createdAt: bigint
}

/**
 * User subscription status
 */
export interface UserSubscription {
  planId: bigint
  subscriber: Address
  startTime: bigint
  lastPaymentTime: bigint
  nextPaymentTime: bigint
  status: SubscriptionStatus
  permissionId: `0x${string}`
}

export type SubscriptionStatus = 'active' | 'trial' | 'grace' | 'cancelled' | 'expired'

/**
 * Permission grant request
 */
export interface PermissionRequest {
  subscriber: Address
  subscriptionManager: Address
  token: Address
  amount: bigint
  interval: bigint
  expiry: bigint
}

/**
 * Payment history entry
 */
export interface PaymentHistoryEntry {
  subscriptionId: bigint
  planId: bigint
  amount: bigint
  token: Address
  timestamp: bigint
  txHash: `0x${string}`
  status: 'success' | 'failed'
}

/**
 * Merchant stats
 */
export interface MerchantStats {
  totalPlans: number
  totalSubscribers: number
  activeSubscribers: number
  totalRevenue: bigint
  monthlyRevenue: bigint
}

/**
 * Plan creation params
 */
export interface CreatePlanParams {
  name: string
  description: string
  price: bigint
  interval: bigint
  token: Address
  trialPeriod?: bigint
  gracePeriod?: bigint
}

/**
 * Subscribe params
 */
export interface SubscribeParams {
  planId: bigint
  permissionId: `0x${string}`
}

/**
 * UI display helpers
 */
export interface PlanDisplayInfo extends SubscriptionPlan {
  priceFormatted: string
  intervalFormatted: string
  tokenSymbol: string
  tokenDecimals: number
}

export interface SubscriptionDisplayInfo extends UserSubscription {
  plan: PlanDisplayInfo
  nextPaymentFormatted: string
  statusLabel: string
  statusColor: string
}

/**
 * Interval presets for plan creation
 */
export const INTERVAL_PRESETS = {
  daily: 86400n,
  weekly: 604800n,
  monthly: 2592000n, // 30 days
  quarterly: 7776000n, // 90 days
  yearly: 31536000n, // 365 days
} as const

export type IntervalPreset = keyof typeof INTERVAL_PRESETS

/**
 * Get interval label
 */
export function getIntervalLabel(seconds: bigint): string {
  const s = Number(seconds)
  if (s === 86400) return 'Daily'
  if (s === 604800) return 'Weekly'
  if (s === 2592000) return 'Monthly'
  if (s === 7776000) return 'Quarterly'
  if (s === 31536000) return 'Yearly'
  if (s < 86400) return `Every ${Math.floor(s / 3600)} hours`
  if (s < 604800) return `Every ${Math.floor(s / 86400)} days`
  return `Every ${Math.floor(s / 86400)} days`
}

/**
 * Get status display info
 */
export function getStatusInfo(status: SubscriptionStatus): { label: string; color: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'green' }
    case 'trial':
      return { label: 'Trial', color: 'blue' }
    case 'grace':
      return { label: 'Grace Period', color: 'yellow' }
    case 'cancelled':
      return { label: 'Cancelled', color: 'gray' }
    case 'expired':
      return { label: 'Expired', color: 'red' }
    default:
      return { label: 'Unknown', color: 'gray' }
  }
}
