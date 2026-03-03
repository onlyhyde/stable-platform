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
 * Maximum gas limit (105M)
 * Aligned with StableNet genesis block gas limit (0x6422C40)
 */
export const MAX_GAS_LIMIT = 105_000_000n

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
 * Covers DeFi operations (swap/stake) in addition to simple transfers
 */
export const DEFAULT_CALL_GAS_LIMIT = 200_000n

/**
 * Paymaster verification gas (typical overhead)
 * Includes ERC20 oracle query, approval check, and signature verification
 */
export const PAYMASTER_VERIFICATION_GAS = 75_000n

/**
 * Paymaster post-operation gas (typical overhead)
 */
export const PAYMASTER_POST_OP_GAS = 50_000n

// ============================================================================
// EIP-4337 v0.9 Unused Gas Penalty
// ============================================================================

/**
 * Unused gas penalty threshold (40,000 gas)
 * Per EIP-4337 v0.9: if unused callGasLimit + paymasterPostOpGasLimit exceeds
 * this threshold, 10% of unused gas is charged as penalty to prevent griefing.
 */
export const UNUSED_GAS_PENALTY_THRESHOLD = 40_000n

/**
 * Unused gas penalty divisor (10 = 10%)
 */
export const UNUSED_GAS_PENALTY_DIVISOR = 10n

/**
 * Calculate the 10% unused gas penalty per EIP-4337 v0.9.
 *
 * If unused (callGasLimit + paymasterPostOpGasLimit) exceeds 40,000 gas,
 * 10% of the unused amount is charged as penalty to prevent bundler griefing.
 *
 * @param allocatedCallGas - callGasLimit set in the UserOp
 * @param estimatedCallGas - estimated actual call gas usage
 * @param allocatedPostOpGas - paymasterPostOpGasLimit set in the UserOp (0 if no paymaster)
 * @param estimatedPostOpGas - estimated actual postOp gas usage (0 if no paymaster)
 * @returns penalty gas amount (0 if unused gas is below threshold)
 */
export function calculateUnusedGasPenalty(
  allocatedCallGas: bigint,
  estimatedCallGas: bigint,
  allocatedPostOpGas: bigint,
  estimatedPostOpGas: bigint
): bigint {
  const unusedCallGas =
    allocatedCallGas > estimatedCallGas ? allocatedCallGas - estimatedCallGas : 0n
  const unusedPostOpGas =
    allocatedPostOpGas > estimatedPostOpGas ? allocatedPostOpGas - estimatedPostOpGas : 0n
  const totalUnused = unusedCallGas + unusedPostOpGas

  if (totalUnused > UNUSED_GAS_PENALTY_THRESHOLD) {
    return totalUnused / UNUSED_GAS_PENALTY_DIVISOR
  }
  return 0n
}

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
