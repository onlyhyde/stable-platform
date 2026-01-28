import type { Address, Hex } from 'viem'

/**
 * Subscription plan from the contract
 */
export interface SubscriptionPlan {
  merchant: Address
  name: string
  description: string
  price: bigint
  interval: bigint
  token: Address
  isActive: boolean
  subscriberCount: bigint
  trialPeriod: bigint
  gracePeriod: bigint
  createdAt: bigint
}

/**
 * Subscription details from the contract
 */
export interface Subscription {
  subscriber: Address
  planId: bigint
  startTime: bigint
  lastPaymentTime: bigint
  nextPaymentTime: bigint
  status: SubscriptionStatus
  permissionId: Hex
}

/**
 * Subscription status enum matching the contract
 */
export enum SubscriptionStatus {
  Active = 0,
  Trial = 1,
  Grace = 2,
  Cancelled = 3,
  Expired = 4,
}

/**
 * Payment execution result
 */
export interface PaymentResult {
  success: boolean
  transactionHash?: Hex
  error?: string
  gasUsed?: bigint
  timestamp: number
}

/**
 * Subscription payment job
 */
export interface PaymentJob {
  subscriber: Address
  planId: bigint
  plan: SubscriptionPlan
  subscription: Subscription
  scheduledTime: number
  retryCount: number
}

/**
 * Configuration for the payment processor
 */
export interface PaymentProcessorConfig {
  rpcUrl: string
  chainId: number
  subscriptionManagerAddress: Address
  permissionManagerAddress: Address
  recurringPaymentExecutorAddress: Address
  executorPrivateKey: Hex
  pollInterval: number // milliseconds
  maxRetries: number
  retryDelay: number // milliseconds
  batchSize: number
}

/**
 * Payment event log
 */
export interface PaymentLog {
  timestamp: number
  subscriber: Address
  planId: bigint
  amount: bigint
  token: Address
  transactionHash: Hex
  status: 'success' | 'failed' | 'pending'
  errorMessage?: string
}
