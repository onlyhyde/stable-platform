import type { AuditHookConfig, HookGasLimitRequest, SpendingLimitHookConfig } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { encodeAbiParameters, formatEther, formatUnits, parseAbiParameters } from 'viem'

// ============================================================================
// Types
// ============================================================================

/**
 * Hook validation result
 */
export interface HookValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Spending limit status
 */
export interface SpendingLimitStatus {
  /** Token address */
  token: Address

  /** Configured limit */
  limit: bigint

  /** Amount spent in current period */
  spent: bigint

  /** Remaining allowance */
  remaining: bigint

  /** Timestamp when limit resets */
  resetTime: number

  /** Period duration in seconds */
  period: number

  /** Percentage of limit used */
  usedPercentage: number

  /** Is limit currently exceeded */
  isExceeded: boolean
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Transaction hash */
  txHash: Hex

  /** Block number */
  blockNumber: bigint

  /** Timestamp */
  timestamp: number

  /** Event type */
  eventType: 'transfer' | 'approval' | 'call'

  /** Target address */
  target: Address

  /** Value transferred */
  value: bigint

  /** Calldata (if logged) */
  callData?: Hex
}

// ============================================================================
// Constants
// ============================================================================

/** Address validation regex */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Zero address for native ETH */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

/** Minimum spending limit period (1 hour) */
const MIN_PERIOD_SECONDS = 60 * 60

/** Maximum spending limit period (365 days) */
const MAX_PERIOD_SECONDS = 365 * 24 * 60 * 60

/** Common period presets in seconds */
export const PERIOD_PRESETS = {
  HOURLY: 60 * 60,
  DAILY: 24 * 60 * 60,
  WEEKLY: 7 * 24 * 60 * 60,
  MONTHLY: 30 * 24 * 60 * 60,
} as const

// ============================================================================
// Spending Limit Hook Utils
// ============================================================================

/**
 * Encode Spending Limit hook initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeSpendingLimitInit({
 *   token: ZERO_ADDRESS, // ETH
 *   limit: parseEther('1'), // 1 ETH per day
 *   period: PERIOD_PRESETS.DAILY,
 * })
 * ```
 */
export function encodeSpendingLimitInit(config: SpendingLimitHookConfig): Hex {
  return encodeAbiParameters(parseAbiParameters('address token, uint256 limit, uint64 period'), [
    config.token,
    config.limit,
    BigInt(config.period),
  ])
}

/**
 * Encode multiple spending limits initialization
 * For setting limits on multiple tokens at once
 */
export function encodeMultipleSpendingLimitsInit(configs: SpendingLimitHookConfig[]): Hex {
  return encodeAbiParameters(
    parseAbiParameters('(address token, uint256 limit, uint64 period)[]'),
    [configs.map((c) => ({ token: c.token, limit: c.limit, period: BigInt(c.period) }))]
  )
}

/**
 * Validate Spending Limit configuration
 */
export function validateSpendingLimitConfig(config: SpendingLimitHookConfig): HookValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate token address
  if (!config.token) {
    errors.push('Token address is required (use zero address for native ETH)')
  } else if (!ADDRESS_REGEX.test(config.token)) {
    errors.push('Token must be a valid Ethereum address')
  }

  // Validate limit
  if (config.limit === undefined || config.limit === null) {
    errors.push('Spending limit is required')
  } else if (config.limit <= 0n) {
    errors.push('Spending limit must be greater than zero')
  }

  // Validate period
  if (!config.period) {
    errors.push('Period is required')
  } else if (config.period < MIN_PERIOD_SECONDS) {
    errors.push(`Period must be at least ${MIN_PERIOD_SECONDS} seconds (1 hour)`)
  } else if (config.period > MAX_PERIOD_SECONDS) {
    errors.push(`Period cannot exceed ${MAX_PERIOD_SECONDS} seconds (365 days)`)
  }

  // Warnings for potentially risky configurations
  if (config.limit && config.limit > 10n ** 21n && config.token === ZERO_ADDRESS) {
    warnings.push('Very high ETH limit (>1000 ETH) - ensure this is intentional')
  }

  if (config.period && config.period > 30 * 24 * 60 * 60) {
    warnings.push('Long reset period (>30 days) - limit may accumulate significantly')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Calculate spending limit status
 */
export function calculateSpendingLimitStatus(
  config: SpendingLimitHookConfig,
  spent: bigint,
  lastResetTime: number
): SpendingLimitStatus {
  const now = Math.floor(Date.now() / 1000)
  const resetTime = lastResetTime + config.period

  // Check if period has reset
  const effectiveSpent = now >= resetTime ? 0n : spent
  const remaining = config.limit > effectiveSpent ? config.limit - effectiveSpent : 0n

  const usedPercentage =
    config.limit > 0n ? Number((effectiveSpent * 10000n) / config.limit) / 100 : 0

  return {
    token: config.token,
    limit: config.limit,
    spent: effectiveSpent,
    remaining,
    resetTime: now >= resetTime ? now + config.period : resetTime,
    period: config.period,
    usedPercentage,
    isExceeded: effectiveSpent >= config.limit,
  }
}

/**
 * Check if a transaction would exceed the spending limit
 */
export function wouldExceedLimit(
  status: SpendingLimitStatus,
  transactionValue: bigint
): { wouldExceed: boolean; amountOver: bigint } {
  const newSpent = status.spent + transactionValue

  if (newSpent > status.limit) {
    return {
      wouldExceed: true,
      amountOver: newSpent - status.limit,
    }
  }

  return {
    wouldExceed: false,
    amountOver: 0n,
  }
}

/**
 * Format spending limit for display
 */
export function formatSpendingLimit(
  status: SpendingLimitStatus,
  tokenDecimals = 18,
  tokenSymbol = 'ETH'
): {
  limit: string
  spent: string
  remaining: string
  resetIn: string
  usedPercentage: string
} {
  const formatAmount = (value: bigint) =>
    tokenDecimals === 18 ? formatEther(value) : formatUnits(value, tokenDecimals)

  const now = Math.floor(Date.now() / 1000)
  const secondsUntilReset = Math.max(0, status.resetTime - now)

  let resetIn: string
  if (secondsUntilReset === 0) {
    resetIn = 'Now'
  } else if (secondsUntilReset < 3600) {
    resetIn = `${Math.floor(secondsUntilReset / 60)} minutes`
  } else if (secondsUntilReset < 86400) {
    resetIn = `${Math.floor(secondsUntilReset / 3600)} hours`
  } else {
    resetIn = `${Math.floor(secondsUntilReset / 86400)} days`
  }

  return {
    limit: `${formatAmount(status.limit)} ${tokenSymbol}`,
    spent: `${formatAmount(status.spent)} ${tokenSymbol}`,
    remaining: `${formatAmount(status.remaining)} ${tokenSymbol}`,
    resetIn,
    usedPercentage: `${status.usedPercentage.toFixed(1)}%`,
  }
}

/**
 * Encode set limit call
 */
export function encodeSetLimit(token: Address, limit: bigint, period: number): Hex {
  return encodeAbiParameters(parseAbiParameters('address token, uint256 limit, uint64 period'), [
    token,
    limit,
    BigInt(period),
  ])
}

// ============================================================================
// Audit Hook Utils
// ============================================================================

/**
 * Encode Audit hook initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeAuditHookInit({
 *   logEvents: ['transfer', 'approval'],
 *   logCalldata: true,
 * })
 * ```
 */
export function encodeAuditHookInit(config: AuditHookConfig): Hex {
  // Encode event flags as bitmask
  let eventFlags = 0
  if (config.logEvents.includes('transfer')) eventFlags |= 1
  if (config.logEvents.includes('approval')) eventFlags |= 2
  if (config.logEvents.includes('call')) eventFlags |= 4

  return encodeAbiParameters(parseAbiParameters('uint8 eventFlags, bool logCalldata'), [
    eventFlags,
    config.logCalldata,
  ])
}

/**
 * Decode audit event flags
 */
export function decodeAuditEventFlags(flags: number): AuditHookConfig['logEvents'] {
  const events: AuditHookConfig['logEvents'] = []

  if (flags & 1) events.push('transfer')
  if (flags & 2) events.push('approval')
  if (flags & 4) events.push('call')

  return events
}

/**
 * Validate Audit hook configuration
 */
export function validateAuditHookConfig(config: AuditHookConfig): HookValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate events
  if (!config.logEvents || config.logEvents.length === 0) {
    errors.push('At least one event type must be selected')
  } else {
    const validEvents = ['transfer', 'approval', 'call']
    config.logEvents.forEach((event) => {
      if (!validEvents.includes(event)) {
        errors.push(`Invalid event type: ${event}`)
      }
    })
  }

  // Warnings
  if (config.logCalldata && config.logEvents.includes('call')) {
    warnings.push('Logging calldata may use significant gas for complex calls')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Format audit log entry for display
 */
export function formatAuditLogEntry(
  entry: AuditLogEntry,
  tokenDecimals = 18
): {
  date: string
  type: string
  target: string
  value: string
  txHash: string
} {
  return {
    date: new Date(entry.timestamp * 1000).toLocaleString(),
    type: entry.eventType.charAt(0).toUpperCase() + entry.eventType.slice(1),
    target: `${entry.target.slice(0, 6)}...${entry.target.slice(-4)}`,
    value:
      entry.value > 0n
        ? tokenDecimals === 18
          ? formatEther(entry.value)
          : formatUnits(entry.value, tokenDecimals)
        : '-',
    txHash: `${entry.txHash.slice(0, 10)}...`,
  }
}

// ============================================================================
// Common Hook Utils
// ============================================================================

/**
 * Get period name from seconds
 */
export function getPeriodName(seconds: number): string {
  if (seconds === PERIOD_PRESETS.HOURLY) return 'Hourly'
  if (seconds === PERIOD_PRESETS.DAILY) return 'Daily'
  if (seconds === PERIOD_PRESETS.WEEKLY) return 'Weekly'
  if (seconds === PERIOD_PRESETS.MONTHLY) return 'Monthly'

  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`
  return `${Math.floor(seconds / 86400)} days`
}

/**
 * Suggest optimal spending limit based on historical usage
 */
export function suggestSpendingLimit(
  averageSpend: bigint,
  _period: number,
  safetyMargin = 1.5
): bigint {
  // Suggest limit as average spend * safety margin
  const suggested = (averageSpend * BigInt(Math.floor(safetyMargin * 100))) / 100n

  // Round up to nice numbers
  if (suggested < 10n ** 16n) {
    // < 0.01 ETH, round to 0.01
    return 10n ** 16n
  }
  if (suggested < 10n ** 17n) {
    // < 0.1 ETH, round to nearest 0.01
    return ((suggested + 10n ** 16n - 1n) / 10n ** 16n) * 10n ** 16n
  }
  if (suggested < 10n ** 18n) {
    // < 1 ETH, round to nearest 0.1
    return ((suggested + 10n ** 17n - 1n) / 10n ** 17n) * 10n ** 17n
  }
  // >= 1 ETH, round to nearest 1
  return ((suggested + 10n ** 18n - 1n) / 10n ** 18n) * 10n ** 18n
}

// ============================================================================
// Hook Gas Limit Utils (Kernel v0.3.3)
// ============================================================================

/** Well-known gas limit presets */
export const HOOK_GAS_LIMIT_PRESETS = {
  /** No limit (backward compatible default) */
  UNLIMITED: 0n,
  /** Lightweight hooks (view-only checks) */
  LOW: 50_000n,
  /** Standard hooks (state reads + simple logic) */
  STANDARD: 200_000n,
  /** Heavy hooks (state writes, external calls) */
  HIGH: 500_000n,
  /** Maximum recommended limit */
  MAX_RECOMMENDED: 1_000_000n,
} as const

/**
 * Validate Hook Gas Limit configuration
 */
export function validateHookGasLimitConfig(config: HookGasLimitRequest): HookValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.hookAddress) {
    errors.push('Hook address is required')
  } else if (!ADDRESS_REGEX.test(config.hookAddress)) {
    errors.push('Hook address must be a valid Ethereum address')
  }

  if (config.gasLimit < 0n) {
    errors.push('Gas limit cannot be negative')
  }

  if (config.gasLimit > 0n && config.gasLimit < 21_000n) {
    warnings.push('Gas limit below 21,000 may cause hooks to always fail')
  }

  if (config.gasLimit > 2_000_000n) {
    warnings.push('Very high gas limit (>2M) — hook may consume excessive gas per transaction')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Format hook gas limit for display
 */
export function formatHookGasLimit(gasLimit: bigint): string {
  if (gasLimit === 0n) return 'Unlimited'
  if (gasLimit < 1_000n) return `${gasLimit}`
  if (gasLimit < 1_000_000n) return `${Number(gasLimit) / 1_000}K`
  return `${(Number(gasLimit) / 1_000_000).toFixed(1)}M`
}

/**
 * Get preset name for a gas limit value
 */
export function getHookGasLimitPresetName(gasLimit: bigint): string | null {
  for (const [name, value] of Object.entries(HOOK_GAS_LIMIT_PRESETS)) {
    if (value === gasLimit) return name
  }
  return null
}

// ============================================================================
// Exports
// ============================================================================

export const hookUtils = {
  // Spending Limit
  encodeSpendingLimitInit,
  encodeMultipleSpendingLimitsInit,
  validateSpendingLimitConfig,
  calculateSpendingLimitStatus,
  wouldExceedLimit,
  formatSpendingLimit,
  encodeSetLimit,

  // Audit
  encodeAuditHookInit,
  decodeAuditEventFlags,
  validateAuditHookConfig,
  formatAuditLogEntry,

  // Hook Gas Limit
  validateHookGasLimitConfig,
  formatHookGasLimit,
  getHookGasLimitPresetName,
  HOOK_GAS_LIMIT_PRESETS,

  // Common
  getPeriodName,
  suggestSpendingLimit,
  PERIOD_PRESETS,
}
