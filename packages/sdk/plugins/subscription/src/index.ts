/**
 * @stablenet/plugin-subscription
 *
 * Subscription payment plugin for StableNet SDK
 *
 * Provides clients for three on-chain contracts that together enable
 * EIP-7702 based recurring subscription payments:
 *
 * - **SubscriptionManager**: Merchant plan management, subscriber enrollment, payment processing
 * - **RecurringPaymentExecutor**: ERC-7579 executor module for automated recurring payments
 * - **ERC7715PermissionManager**: Permission-based authorization for subscription workflows
 *
 * @example
 * ```ts
 * import {
 *   createSubscriptionManager,
 *   createRecurringPaymentExecutor,
 *   createSubscriptionPermissionClient,
 *   INTERVALS,
 *   PERMISSION_TYPES,
 * } from '@stablenet/plugin-subscription'
 * import { parseEther } from 'viem'
 *
 * // 1. Create clients
 * const subscriptions = createSubscriptionManager({ managerAddress: '0x...' })
 * const executor = createRecurringPaymentExecutor({ executorAddress: '0x...' })
 * const permissions = createSubscriptionPermissionClient({ managerAddress: '0x...' })
 *
 * // 2. Grant subscription permission (user signs this)
 * const grantCalldata = permissions.encodeGrantSubscriptionPermission({
 *   grantee: subscriptionManagerAddress,
 *   target: subscriptionManagerAddress,
 *   spendingLimit: parseEther('100'),
 *   expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
 * })
 *
 * // 3. Subscribe to a plan
 * const subscribeCalldata = subscriptions.encodeSubscribe({
 *   planId: 1n,
 *   permissionId: '0x...',
 * })
 *
 * // 4. Process payment (called by authorized processor)
 * const payCalldata = subscriptions.encodeProcessPayment('0x...')
 *
 * // 5. Query state
 * const plan = await subscriptions.getPlan(publicClient, 1n)
 * const isDue = await subscriptions.isPaymentDue(publicClient, subscriptionId)
 * ```
 */

// Types
export type {
  Plan,
  Subscription,
  CreatePlanParams,
  SubscribeParams,
  SubscriptionManagerConfig,
  PaymentSchedule,
  CreateScheduleParams,
  RecurringPaymentExecutorConfig,
  Permission,
  Rule,
  PermissionRecord,
  GrantPermissionParams,
  GrantPermissionWithSignatureParams,
  GrantSubscriptionPermissionParams,
  PermissionManagerConfig,
  PermissionType,
  RuleType,
} from './types'

export {
  SUBSCRIPTION_MANAGER_ABI,
  RECURRING_PAYMENT_EXECUTOR_ABI,
  PERMISSION_MANAGER_ABI,
  PERMISSION_TYPES,
  RULE_TYPES,
} from './types'

// Constants
export {
  NATIVE_TOKEN,
  INTERVALS,
  PERIOD_LIMITS,
  FEE_LIMITS,
  MODULE_TYPE_EXECUTOR,
} from './constants'

// Subscription Manager
export {
  createSubscriptionManager,
  type SubscriptionManagerClient,
} from './subscriptionClient'

// Recurring Payment Executor
export {
  createRecurringPaymentExecutor,
  type RecurringPaymentExecutorClient,
} from './recurringPaymentClient'

// Permission Manager
export {
  createSubscriptionPermissionClient,
  type SubscriptionPermissionClient,
} from './permissionClient'
