import type { Address, Hex } from 'viem'

// ============================================================
//                    SubscriptionManager Types
// ============================================================

/** Subscription plan created by merchants */
export interface Plan {
  /** Merchant receiving payments */
  merchant: Address
  /** Payment amount per period */
  amount: bigint
  /** Payment period in seconds */
  period: bigint
  /** Payment token (0x0 for native) */
  token: Address
  /** Free trial period in seconds */
  trialPeriod: bigint
  /** Grace period after missed payment */
  gracePeriod: bigint
  /** Minimum subscription duration */
  minSubscriptionTime: bigint
  /** Plan name */
  name: string
  /** Plan description */
  description: string
  /** Whether plan accepts new subscriptions */
  active: boolean
  /** Current subscriber count */
  subscriberCount: bigint
}

/** Individual subscription record */
export interface Subscription {
  /** Reference to subscription plan */
  planId: bigint
  /** Subscriber address */
  subscriber: Address
  /** ERC-7715 permission ID */
  permissionId: Hex
  /** Subscription start timestamp */
  startTime: bigint
  /** Last successful payment timestamp */
  lastPayment: bigint
  /** Next payment due timestamp */
  nextPayment: bigint
  /** Total successful payments */
  paymentCount: bigint
  /** Total amount paid */
  totalPaid: bigint
  /** Whether subscription is active */
  active: boolean
  /** Whether in grace period */
  inGracePeriod: boolean
}

/** Parameters for creating a subscription plan */
export interface CreatePlanParams {
  /** Payment amount per period */
  amount: bigint
  /** Payment period in seconds */
  period: bigint
  /** Payment token address (0x0 for native) */
  token: Address
  /** Trial period in seconds (0 for no trial) */
  trialPeriod?: bigint
  /** Grace period in seconds (0 for no grace) */
  gracePeriod?: bigint
  /** Minimum subscription duration in seconds */
  minSubscriptionTime?: bigint
  /** Plan name */
  name: string
  /** Plan description */
  description: string
}

/** Parameters for subscribing to a plan */
export interface SubscribeParams {
  /** Plan ID to subscribe to */
  planId: bigint
  /** ERC-7715 permission ID for recurring payments */
  permissionId: Hex
}

/** SubscriptionManager client configuration */
export interface SubscriptionManagerConfig {
  /** SubscriptionManager contract address */
  managerAddress: Address
}

// ============================================================
//                RecurringPaymentExecutor Types
// ============================================================

/** Payment schedule configuration */
export interface PaymentSchedule {
  /** Payment recipient */
  recipient: Address
  /** Token address (0x0 for ETH) */
  token: Address
  /** Payment amount per interval */
  amount: bigint
  /** Time between payments in seconds */
  interval: bigint
  /** When payments can start */
  startTime: bigint
  /** Last payment timestamp */
  lastPaymentTime: bigint
  /** Maximum payments (0 = unlimited) */
  maxPayments: bigint
  /** Payments made so far */
  paymentsMade: bigint
  /** Whether schedule is active */
  isActive: boolean
}

/** Parameters for creating a payment schedule */
export interface CreateScheduleParams {
  /** Payment recipient */
  recipient: Address
  /** Token address (0x0 for ETH) */
  token: Address
  /** Payment amount per interval */
  amount: bigint
  /** Time between payments in seconds */
  interval: bigint
  /** Start time (0 = now) */
  startTime?: bigint
  /** Maximum payments (0 = unlimited) */
  maxPayments?: bigint
}

/** RecurringPaymentExecutor client configuration */
export interface RecurringPaymentExecutorConfig {
  /** RecurringPaymentExecutor contract address */
  executorAddress: Address
}

// ============================================================
//                ERC7715PermissionManager Types
// ============================================================

/** ERC-7715 Permission type identifiers */
export const PERMISSION_TYPES = {
  NATIVE_TOKEN_RECURRING: 'native-token-recurring-allowance',
  ERC20_RECURRING: 'erc20-recurring-allowance',
  SESSION_KEY: 'session-key',
  SUBSCRIPTION: 'subscription',
  SPENDING_LIMIT: 'spending-limit',
} as const

export type PermissionType = (typeof PERMISSION_TYPES)[keyof typeof PERMISSION_TYPES]

/** Rule type identifiers */
export const RULE_TYPES = {
  EXPIRY: 'expiry',
  RATE_LIMIT: 'rate-limit',
  SPENDING_LIMIT: 'spending-limit',
} as const

export type RuleType = (typeof RULE_TYPES)[keyof typeof RULE_TYPES]

/** Permission structure (ERC-7715 compatible) */
export interface Permission {
  /** Type identifier */
  permissionType: PermissionType
  /** Whether parameters can be modified */
  isAdjustmentAllowed: boolean
  /** Permission-specific encoded data */
  data: Hex
}

/** Rule applied to permissions */
export interface Rule {
  /** Type of rule */
  ruleType: string
  /** Rule-specific encoded data */
  data: Hex
}

/** Full permission record stored on-chain */
export interface PermissionRecord {
  /** Account that granted the permission */
  granter: Address
  /** Account that received the permission */
  grantee: Address
  /** Chain where permission is valid */
  chainId: bigint
  /** Target contract */
  target: Address
  /** Permission details */
  permission: Permission
  /** Applied rules */
  rules: Rule[]
  /** Creation timestamp */
  createdAt: bigint
  /** Whether permission is active */
  active: boolean
}

/** Parameters for granting a permission */
export interface GrantPermissionParams {
  /** Address receiving the permission */
  grantee: Address
  /** Target contract */
  target: Address
  /** Permission details */
  permission: Permission
  /** Rules to apply */
  rules: Rule[]
}

/** Parameters for granting with signature */
export interface GrantPermissionWithSignatureParams extends GrantPermissionParams {
  /** Address granting the permission */
  granter: Address
  /** EIP-712 signature */
  signature: Hex
}

/** Parameters for granting a subscription-specific recurring allowance */
export interface GrantSubscriptionPermissionParams {
  /** Address receiving the permission (e.g., SubscriptionManager) */
  grantee: Address
  /** Target contract for the permission */
  target: Address
  /** Spending limit per period */
  spendingLimit: bigint
  /** Expiry timestamp (0 = no expiry) */
  expiry?: bigint
  /** Whether the permission can be adjusted later */
  isAdjustmentAllowed?: boolean
}

/** ERC7715PermissionManager client configuration */
export interface PermissionManagerConfig {
  /** ERC7715PermissionManager contract address */
  managerAddress: Address
}

// ============================================================
//                          ABIs
// ============================================================

/** ABI for SubscriptionManager contract */
export const SUBSCRIPTION_MANAGER_ABI = [
  // Plan management
  {
    name: 'createPlan',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'trialPeriod', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
      { name: 'minSubscriptionTime', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ name: 'planId', type: 'uint256' }],
  },
  {
    name: 'updatePlan',
    type: 'function',
    inputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    outputs: [],
  },
  // Subscription management
  {
    name: 'subscribe',
    type: 'function',
    inputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'permissionId', type: 'bytes32' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'bytes32' }],
  },
  {
    name: 'cancelSubscription',
    type: 'function',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [],
  },
  // Payment processing
  {
    name: 'processPayment',
    type: 'function',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'batchProcessPayments',
    type: 'function',
    inputs: [{ name: 'subscriptionIds', type: 'bytes32[]' }],
    outputs: [],
  },
  // View functions
  {
    name: 'getPlan',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'merchant', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'period', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'trialPeriod', type: 'uint256' },
          { name: 'gracePeriod', type: 'uint256' },
          { name: 'minSubscriptionTime', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'active', type: 'bool' },
          { name: 'subscriberCount', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getSubscription',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'planId', type: 'uint256' },
          { name: 'subscriber', type: 'address' },
          { name: 'permissionId', type: 'bytes32' },
          { name: 'startTime', type: 'uint256' },
          { name: 'lastPayment', type: 'uint256' },
          { name: 'nextPayment', type: 'uint256' },
          { name: 'paymentCount', type: 'uint256' },
          { name: 'totalPaid', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'inGracePeriod', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getSubscriberSubscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    name: 'getMerchantPlans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'isPaymentDue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getDueSubscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionIds', type: 'bytes32[]' }],
    outputs: [{ name: 'dueIds', type: 'bytes32[]' }],
  },
  {
    name: 'daysUntilNextPayment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'int256' }],
  },
  // Admin functions
  {
    name: 'addProcessor',
    type: 'function',
    inputs: [{ name: 'processor', type: 'address' }],
    outputs: [],
  },
  {
    name: 'removeProcessor',
    type: 'function',
    inputs: [{ name: 'processor', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setProtocolFee',
    type: 'function',
    inputs: [{ name: 'feeBps', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setFeeRecipient',
    type: 'function',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
  },
  // State variables
  {
    name: 'planCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'protocolFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'authorizedProcessors',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/** ABI for RecurringPaymentExecutor contract */
export const RECURRING_PAYMENT_EXECUTOR_ABI = [
  // Schedule management
  {
    name: 'createSchedule',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'maxPayments', type: 'uint256' },
    ],
    outputs: [{ name: 'scheduleId', type: 'uint256' }],
  },
  {
    name: 'cancelSchedule',
    type: 'function',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'updateAmount',
    type: 'function',
    inputs: [
      { name: 'scheduleId', type: 'uint256' },
      { name: 'newAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'updateRecipient',
    type: 'function',
    inputs: [
      { name: 'scheduleId', type: 'uint256' },
      { name: 'newRecipient', type: 'address' },
    ],
    outputs: [],
  },
  // Execution
  {
    name: 'executePayment',
    type: 'function',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes[]' }],
  },
  {
    name: 'executePaymentBatch',
    type: 'function',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleIds', type: 'uint256[]' },
    ],
    outputs: [{ name: 'successCount', type: 'uint256' }],
  },
  // View functions
  {
    name: 'getSchedule',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'interval', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'lastPaymentTime', type: 'uint256' },
          { name: 'maxPayments', type: 'uint256' },
          { name: 'paymentsMade', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getActiveSchedules',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'isPaymentDue',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getNextPaymentTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getRemainingPayments',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTotalRemainingValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Constants
  {
    name: 'INTERVAL_DAILY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'INTERVAL_WEEKLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'INTERVAL_MONTHLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'INTERVAL_YEARLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Module interface
  {
    name: 'onInstall',
    type: 'function',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [],
  },
  {
    name: 'onUninstall',
    type: 'function',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [],
  },
  {
    name: 'isModuleType',
    type: 'function',
    stateMutability: 'pure',
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isInitialized',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'smartAccount', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/** ABI for ERC7715PermissionManager contract */
export const PERMISSION_MANAGER_ABI = [
  // Permission management
  {
    name: 'grantPermission',
    type: 'function',
    inputs: [
      { name: 'grantee', type: 'address' },
      { name: 'target', type: 'address' },
      {
        name: 'permission',
        type: 'tuple',
        components: [
          { name: 'permissionType', type: 'string' },
          { name: 'isAdjustmentAllowed', type: 'bool' },
          { name: 'data', type: 'bytes' },
        ],
      },
      {
        name: 'rules',
        type: 'tuple[]',
        components: [
          { name: 'ruleType', type: 'string' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'permissionId', type: 'bytes32' }],
  },
  {
    name: 'grantPermissionWithSignature',
    type: 'function',
    inputs: [
      { name: 'granter', type: 'address' },
      { name: 'grantee', type: 'address' },
      { name: 'target', type: 'address' },
      {
        name: 'permission',
        type: 'tuple',
        components: [
          { name: 'permissionType', type: 'string' },
          { name: 'isAdjustmentAllowed', type: 'bool' },
          { name: 'data', type: 'bytes' },
        ],
      },
      {
        name: 'rules',
        type: 'tuple[]',
        components: [
          { name: 'ruleType', type: 'string' },
          { name: 'data', type: 'bytes' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'permissionId', type: 'bytes32' }],
  },
  {
    name: 'revokePermission',
    type: 'function',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'adjustPermission',
    type: 'function',
    inputs: [
      { name: 'permissionId', type: 'bytes32' },
      { name: 'newData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'usePermission',
    type: 'function',
    inputs: [
      { name: 'permissionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  // View functions
  {
    name: 'getPermission',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'granter', type: 'address' },
          { name: 'grantee', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'target', type: 'address' },
          {
            name: 'permission',
            type: 'tuple',
            components: [
              { name: 'permissionType', type: 'string' },
              { name: 'isAdjustmentAllowed', type: 'bool' },
              { name: 'data', type: 'bytes' },
            ],
          },
          {
            name: 'rules',
            type: 'tuple[]',
            components: [
              { name: 'ruleType', type: 'string' },
              { name: 'data', type: 'bytes' },
            ],
          },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'isPermissionValid',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [{ name: 'valid', type: 'bool' }],
  },
  {
    name: 'getPermissionId',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'granter', type: 'address' },
      { name: 'grantee', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'permissionType', type: 'string' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'getRemainingAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  {
    name: 'getTotalUsage',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isPermissionTypeSupported',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionType', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
