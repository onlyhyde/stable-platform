/**
 * Gas Configuration Constants
 *
 * Centralized gas-related constants for consistent usage across the SDK.
 * All values are documented with their purpose and typical use cases.
 */

import { parseGwei } from 'viem'

// ============================================================================
// Priority Fee Bounds
// ============================================================================

/**
 * Minimum priority fee (1 gwei)
 * Used as floor to ensure transactions are picked up by validators
 */
export const MIN_PRIORITY_FEE = parseGwei('1')

/**
 * Maximum priority fee (50 gwei)
 * Used as ceiling to prevent overpaying during network congestion
 */
export const MAX_PRIORITY_FEE = parseGwei('50')

/**
 * Default max fee per gas (1 gwei)
 * Fallback when network fee estimation fails
 */
export const DEFAULT_MAX_FEE_PER_GAS = parseGwei('1')

// ============================================================================
// Base Gas Limits
// ============================================================================

/**
 * Base gas for simple ETH transfer (21,000)
 * Standard gas cost for transferring ETH without data
 */
export const BASE_TRANSFER_GAS = 21_000n

/**
 * Maximum gas limit (30M)
 * Block gas limit ceiling for transactions
 */
export const MAX_GAS_LIMIT = 30_000_000n

// ============================================================================
// Gas Buffer Settings
// ============================================================================

/**
 * Gas buffer multiplier (110 = 10% extra)
 * Applied to estimated gas for safety margin
 */
export const GAS_BUFFER_MULTIPLIER = 110n

/**
 * Gas buffer divisor (100)
 * Used with multiplier: (gas * 110) / 100 = 10% buffer
 */
export const GAS_BUFFER_DIVISOR = 100n

// ============================================================================
// EIP-7702 Gas Constants
// ============================================================================

/**
 * Gas overhead for EIP-7702 authorization verification
 */
export const EIP7702_AUTH_GAS = 25_000n

/**
 * Gas per authorization in the authorization list
 */
export const GAS_PER_AUTHORIZATION = 12_500n

/**
 * SetCode transaction base gas
 */
export const SETCODE_BASE_GAS = 21_000n

// ============================================================================
// Smart Account (ERC-4337) Gas Constants
// ============================================================================

/**
 * Default verification gas limit for UserOperations
 */
export const DEFAULT_VERIFICATION_GAS_LIMIT = 150_000n

/**
 * Default pre-verification gas for UserOperations
 */
export const DEFAULT_PRE_VERIFICATION_GAS = 50_000n

/**
 * Default call gas limit for UserOperations
 */
export const DEFAULT_CALL_GAS_LIMIT = 100_000n

/**
 * Paymaster verification gas (typical overhead)
 */
export const PAYMASTER_VERIFICATION_GAS = 30_000n

/**
 * Paymaster post-operation gas (typical overhead)
 */
export const PAYMASTER_POST_OP_GAS = 50_000n

// ============================================================================
// Gas Config Object (for structured access)
// ============================================================================

/**
 * Complete gas configuration object
 * Provides structured access to all gas constants
 */
export const GAS_CONFIG = {
  priorityFee: {
    min: MIN_PRIORITY_FEE,
    max: MAX_PRIORITY_FEE,
    default: MIN_PRIORITY_FEE,
  },
  baseLimits: {
    transfer: BASE_TRANSFER_GAS,
    maxBlock: MAX_GAS_LIMIT,
  },
  buffer: {
    multiplier: GAS_BUFFER_MULTIPLIER,
    divisor: GAS_BUFFER_DIVISOR,
  },
  eip7702: {
    authGas: EIP7702_AUTH_GAS,
    perAuthorization: GAS_PER_AUTHORIZATION,
    setCodeBase: SETCODE_BASE_GAS,
  },
  smartAccount: {
    verificationGasLimit: DEFAULT_VERIFICATION_GAS_LIMIT,
    preVerificationGas: DEFAULT_PRE_VERIFICATION_GAS,
    callGasLimit: DEFAULT_CALL_GAS_LIMIT,
    paymasterVerification: PAYMASTER_VERIFICATION_GAS,
    paymasterPostOp: PAYMASTER_POST_OP_GAS,
  },
} as const
