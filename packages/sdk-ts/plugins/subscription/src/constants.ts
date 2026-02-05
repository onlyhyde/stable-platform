import type { Address } from 'viem'

/** Zero address constant for native token payments */
export const NATIVE_TOKEN: Address = '0x0000000000000000000000000000000000000000'

/** Common payment intervals in seconds */
export const INTERVALS = {
  HOURLY: 3600n,
  DAILY: 86400n,
  WEEKLY: 604800n,
  MONTHLY: 2592000n, // 30 days
  YEARLY: 31536000n, // 365 days
} as const

/** SubscriptionManager period constraints */
export const PERIOD_LIMITS = {
  MIN: 3600n, // 1 hour
  MAX: 31536000n, // 365 days
} as const

/** Protocol fee constraints */
export const FEE_LIMITS = {
  MAX_BPS: 1000n, // 10%
  DEFAULT_BPS: 50n, // 0.5%
  BASIS_POINTS_DENOMINATOR: 10000n,
} as const

/** ERC-7579 module type constant */
export const MODULE_TYPE_EXECUTOR = 2n
