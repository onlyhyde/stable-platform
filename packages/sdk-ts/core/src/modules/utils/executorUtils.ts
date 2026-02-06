import type { RecurringPaymentConfig, SessionKeyConfig } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  parseAbiParameters,
  toBytes,
} from 'viem'

// ============================================================================
// Types
// ============================================================================

/**
 * Executor validation result
 */
export interface ExecutorValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Session key permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Recurring payment execution status
 */
export interface RecurringPaymentStatus {
  /** Number of payments made */
  paymentsMade: number

  /** Next payment timestamp */
  nextPaymentTime: number

  /** Remaining payments (null if unlimited) */
  remainingPayments: number | null

  /** Is payment currently due */
  isDue: boolean
}

// ============================================================================
// Constants
// ============================================================================

/** Address validation regex */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Function selector regex (4 bytes) */
const SELECTOR_REGEX = /^0x[a-fA-F0-9]{8}$/

/** Maximum session key validity (30 days) */
const MAX_SESSION_VALIDITY_SECONDS = 30 * 24 * 60 * 60

/** Minimum recurring payment interval (1 day) */
const MIN_PAYMENT_INTERVAL_SECONDS = 24 * 60 * 60

/** Zero address */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// ============================================================================
// Session Key Executor Utils
// ============================================================================

/**
 * Encode Session Key executor initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeSessionKeyInit({
 *   sessionKey: '0xSessionKey...',
 *   allowedTargets: ['0xContract1...', '0xContract2...'],
 *   allowedSelectors: ['0x12345678', '0x87654321'],
 *   maxValuePerTx: parseEther('0.1'),
 *   validUntil: Math.floor(Date.now() / 1000) + 86400, // 1 day
 *   validAfter: Math.floor(Date.now() / 1000),
 * })
 * ```
 */
export function encodeSessionKeyInit(config: SessionKeyConfig): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address sessionKey, address[] allowedTargets, bytes4[] allowedSelectors, uint256 maxValuePerTx, uint64 validUntil, uint64 validAfter'
    ),
    [
      config.sessionKey,
      config.allowedTargets,
      config.allowedSelectors as `0x${string}`[],
      config.maxValuePerTx,
      BigInt(config.validUntil),
      BigInt(config.validAfter),
    ]
  )
}

/**
 * Validate Session Key configuration
 */
export function validateSessionKeyConfig(config: SessionKeyConfig): ExecutorValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const now = Math.floor(Date.now() / 1000)

  // Validate session key address
  if (!config.sessionKey) {
    errors.push('Session key address is required')
  } else if (!ADDRESS_REGEX.test(config.sessionKey)) {
    errors.push('Session key must be a valid Ethereum address')
  } else if (config.sessionKey === ZERO_ADDRESS) {
    errors.push('Session key cannot be zero address')
  }

  // Validate allowed targets
  if (!config.allowedTargets || config.allowedTargets.length === 0) {
    errors.push('At least one allowed target is required')
  } else {
    config.allowedTargets.forEach((target, index) => {
      if (!ADDRESS_REGEX.test(target)) {
        errors.push(`Allowed target ${index + 1} must be a valid address`)
      }
    })
  }

  // Validate allowed selectors
  if (config.allowedSelectors && config.allowedSelectors.length > 0) {
    config.allowedSelectors.forEach((selector, index) => {
      if (!SELECTOR_REGEX.test(selector)) {
        errors.push(`Allowed selector ${index + 1} must be a 4-byte hex string (0x12345678)`)
      }
    })
  }

  // Validate max value
  if (config.maxValuePerTx < 0n) {
    errors.push('Max value per transaction cannot be negative')
  }

  // Validate time bounds
  if (config.validAfter >= config.validUntil) {
    errors.push('validAfter must be before validUntil')
  }

  if (config.validUntil <= now) {
    errors.push('Session key has already expired (validUntil is in the past)')
  }

  if (config.validAfter > now + 60) {
    warnings.push('Session key starts in the future')
  }

  const validityDuration = config.validUntil - config.validAfter
  if (validityDuration > MAX_SESSION_VALIDITY_SECONDS) {
    warnings.push(
      `Session validity (${Math.floor(validityDuration / 86400)} days) exceeds recommended maximum (30 days)`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Check if a transaction is allowed by session key permissions
 */
export function checkSessionKeyPermission(
  config: SessionKeyConfig,
  transaction: {
    to: Address
    value: bigint
    data: Hex
  }
): PermissionCheckResult {
  const now = Math.floor(Date.now() / 1000)

  // Check time validity
  if (now < config.validAfter) {
    return {
      allowed: false,
      reason: 'Session key not yet valid',
    }
  }

  if (now >= config.validUntil) {
    return {
      allowed: false,
      reason: 'Session key has expired',
    }
  }

  // Check target
  const targetAllowed = config.allowedTargets.some(
    (allowed) => allowed.toLowerCase() === transaction.to.toLowerCase()
  )

  if (!targetAllowed) {
    return {
      allowed: false,
      reason: `Target ${transaction.to} is not in allowed targets`,
    }
  }

  // Check value
  if (transaction.value > config.maxValuePerTx) {
    return {
      allowed: false,
      reason: `Value ${transaction.value} exceeds max ${config.maxValuePerTx}`,
    }
  }

  // Check function selector (if selectors are restricted)
  if (config.allowedSelectors && config.allowedSelectors.length > 0) {
    const callSelector = transaction.data.slice(0, 10) // 0x + 8 hex chars

    const selectorAllowed = config.allowedSelectors.some(
      (allowed) => allowed.toLowerCase() === callSelector.toLowerCase()
    )

    if (!selectorAllowed) {
      return {
        allowed: false,
        reason: `Function selector ${callSelector} is not allowed`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Create a session key for a specific dApp
 */
export function createDAppSessionKey(params: {
  sessionKeyAddress: Address
  dAppContract: Address
  allowedFunctions: Hex[]
  maxEthPerTx: bigint
  durationSeconds: number
}): SessionKeyConfig {
  const now = Math.floor(Date.now() / 1000)

  return {
    sessionKey: params.sessionKeyAddress,
    allowedTargets: [params.dAppContract],
    allowedSelectors: params.allowedFunctions,
    maxValuePerTx: params.maxEthPerTx,
    validAfter: now,
    validUntil: now + params.durationSeconds,
  }
}

// ============================================================================
// Recurring Payment Executor Utils
// ============================================================================

/**
 * Encode Recurring Payment executor initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeRecurringPaymentInit({
 *   recipient: '0xRecipient...',
 *   token: ZERO_ADDRESS, // ETH
 *   amount: parseEther('0.01'),
 *   interval: 86400 * 30, // Monthly
 *   maxPayments: 12, // 1 year
 * })
 * ```
 */
export function encodeRecurringPaymentInit(config: RecurringPaymentConfig): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address recipient, address token, uint256 amount, uint64 interval, uint32 maxPayments'
    ),
    [config.recipient, config.token, config.amount, BigInt(config.interval), config.maxPayments]
  )
}

/**
 * Validate Recurring Payment configuration
 */
export function validateRecurringPaymentConfig(
  config: RecurringPaymentConfig
): ExecutorValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate recipient
  if (!config.recipient) {
    errors.push('Recipient address is required')
  } else if (!ADDRESS_REGEX.test(config.recipient)) {
    errors.push('Recipient must be a valid Ethereum address')
  } else if (config.recipient === ZERO_ADDRESS) {
    errors.push('Recipient cannot be zero address')
  }

  // Validate token
  if (!config.token) {
    errors.push('Token address is required (use zero address for native ETH)')
  } else if (!ADDRESS_REGEX.test(config.token)) {
    errors.push('Token must be a valid Ethereum address')
  }

  // Validate amount
  if (!config.amount || config.amount <= 0n) {
    errors.push('Payment amount must be greater than zero')
  }

  // Validate interval
  if (!config.interval || config.interval < MIN_PAYMENT_INTERVAL_SECONDS) {
    errors.push(`Interval must be at least ${MIN_PAYMENT_INTERVAL_SECONDS} seconds (1 day)`)
  }

  // Validate max payments
  if (config.maxPayments < 0) {
    errors.push('Max payments cannot be negative')
  }

  // Warnings
  if (config.maxPayments === 0) {
    warnings.push('Unlimited payments (maxPayments = 0) - ensure this is intended')
  }

  if (config.token === ZERO_ADDRESS && config.amount > 10n ** 18n) {
    warnings.push('Large ETH payment amount - verify this is correct')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Calculate recurring payment status
 */
export function calculateRecurringPaymentStatus(
  config: RecurringPaymentConfig,
  paymentsMade: number,
  lastPaymentTime: number
): RecurringPaymentStatus {
  const now = Math.floor(Date.now() / 1000)
  const nextPaymentTime = lastPaymentTime + config.interval

  const remainingPayments =
    config.maxPayments === 0 ? null : Math.max(0, config.maxPayments - paymentsMade)

  const isDue =
    now >= nextPaymentTime && (config.maxPayments === 0 || paymentsMade < config.maxPayments)

  return {
    paymentsMade,
    nextPaymentTime,
    remainingPayments,
    isDue,
  }
}

/**
 * Calculate total cost of recurring payments
 */
export function calculateTotalRecurringCost(config: RecurringPaymentConfig): {
  totalAmount: bigint
  isUnlimited: boolean
} {
  if (config.maxPayments === 0) {
    return {
      totalAmount: 0n,
      isUnlimited: true,
    }
  }

  return {
    totalAmount: config.amount * BigInt(config.maxPayments),
    isUnlimited: false,
  }
}

/**
 * Encode execute recurring payment call
 */
export function encodeExecuteRecurringPayment(paymentId: bigint): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executePayment',
        inputs: [{ name: 'paymentId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'executePayment',
    args: [paymentId],
  })
}

// ============================================================================
// Common Executor Utils
// ============================================================================

/**
 * Encode generic executor call
 */
export function encodeExecutorCall(target: Address, value: bigint, data: Hex): Hex {
  return encodeAbiParameters(parseAbiParameters('address target, uint256 value, bytes data'), [
    target,
    value,
    data,
  ])
}

/**
 * Encode batch executor calls
 */
export function encodeBatchExecutorCalls(
  calls: Array<{ target: Address; value: bigint; data: Hex }>
): Hex {
  return encodeAbiParameters(parseAbiParameters('(address target, uint256 value, bytes data)[]'), [
    calls.map((c) => ({ target: c.target, value: c.value, data: c.data })),
  ])
}

/**
 * Generate unique payment ID for recurring payments
 */
export function generatePaymentId(
  account: Address,
  recipient: Address,
  token: Address,
  nonce: bigint
): bigint {
  const hash = keccak256(
    concat([toBytes(account), toBytes(recipient), toBytes(token), pad(toBytes(nonce))])
  )

  // Return first 8 bytes as uint64
  return BigInt(hash.slice(0, 18))
}

// ============================================================================
// Exports
// ============================================================================

export const executorUtils = {
  // Session Key
  encodeSessionKeyInit,
  validateSessionKeyConfig,
  checkSessionKeyPermission,
  createDAppSessionKey,

  // Recurring Payment
  encodeRecurringPaymentInit,
  validateRecurringPaymentConfig,
  calculateRecurringPaymentStatus,
  calculateTotalRecurringCost,
  encodeExecuteRecurringPayment,

  // Common
  encodeExecutorCall,
  encodeBatchExecutorCalls,
  generatePaymentId,
}
