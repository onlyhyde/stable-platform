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

// Constants
export {
  FEE_LIMITS,
  INTERVALS,
  MODULE_TYPE_EXECUTOR,
  NATIVE_TOKEN,
  PERIOD_LIMITS,
} from './constants'
// Permission Manager
export {
  createSubscriptionPermissionClient,
  type SubscriptionPermissionClient,
} from './permissionClient'
// Recurring Payment Executor
export {
  createRecurringPaymentExecutor,
  type RecurringPaymentExecutorClient,
} from './recurringPaymentClient'

// Subscription Manager
export {
  createSubscriptionManager,
  type SubscriptionManagerClient,
} from './subscriptionClient'
// Types
export type {
  CreatePlanParams,
  CreateScheduleParams,
  GrantPermissionParams,
  GrantPermissionWithSignatureParams,
  GrantSubscriptionPermissionParams,
  PaymentSchedule,
  Permission,
  PermissionManagerConfig,
  PermissionRecord,
  PermissionType,
  Plan,
  RecurringPaymentExecutorConfig,
  Rule,
  RuleType,
  SubscribeParams,
  Subscription,
  SubscriptionManagerConfig,
} from './types'
export {
  PERMISSION_MANAGER_ABI,
  PERMISSION_TYPES,
  RECURRING_PAYMENT_EXECUTOR_ABI,
  RULE_TYPES,
  SUBSCRIPTION_MANAGER_ABI,
} from './types'
