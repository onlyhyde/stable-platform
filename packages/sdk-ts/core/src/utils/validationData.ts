/**
 * EIP-4337 validationData Utilities
 *
 * Parses and packs the `validationData` uint256 returned by
 * `validateUserOp` and `validatePaymasterUserOp`.
 *
 * Layout: | authorizer (20 bytes) | validUntil (6 bytes) | validAfter (6 bytes) |
 *
 * Block Number Mode (EIP-4337 v0.9):
 *   When bit 47 (0x800000000000) is set on validUntil or validAfter,
 *   the value represents a block number instead of a timestamp.
 */

import type { Address, Hex } from 'viem'

// ============================================================================
// Constants
// ============================================================================

/** Signature validation failed (authorizer = 1) */
export const SIG_VALIDATION_FAILED = 1n

/**
 * Block Number Mode flag (bit 47).
 * When set on validUntil or validAfter, the value is a block number, not a timestamp.
 */
export const VALIDITY_BLOCK_RANGE_FLAG = 0x800_000_000_000n

/** Mask to extract the actual value (lower 47 bits) */
export const VALIDITY_BLOCK_RANGE_MASK = 0x7ff_fff_fff_fffn

// ============================================================================
// Types
// ============================================================================

export interface ValidationData {
  /** 0 = valid, 1 = SIG_VALIDATION_FAILED, other = aggregator address */
  authorizer: Address | 0n | 1n
  /** Expiry time/block. 0 = infinite */
  validUntil: bigint
  /** Start time/block */
  validAfter: bigint
  /** true if validUntil uses block number mode */
  validUntilIsBlockNumber: boolean
  /** true if validAfter uses block number mode */
  validAfterIsBlockNumber: boolean
}

// ============================================================================
// Parse
// ============================================================================

/**
 * Parse a uint256 validationData into its components.
 *
 * @param validationData - The packed uint256 from validateUserOp/validatePaymasterUserOp
 */
export function parseValidationData(validationData: bigint): ValidationData {
  // authorizer: top 20 bytes (bits 96..255)
  const authorizerRaw = validationData >> 96n
  // validUntil: next 6 bytes (bits 48..95)
  const validUntilRaw = (validationData >> 48n) & 0xffff_ffff_ffffn
  // validAfter: bottom 6 bytes (bits 0..47)
  const validAfterRaw = validationData & 0xffff_ffff_ffffn

  // Block number mode detection (bit 47)
  const validUntilIsBlockNumber = (validUntilRaw & VALIDITY_BLOCK_RANGE_FLAG) !== 0n
  const validAfterIsBlockNumber = (validAfterRaw & VALIDITY_BLOCK_RANGE_FLAG) !== 0n

  // Extract actual values (mask out bit 47 if block mode)
  const validUntil = validUntilIsBlockNumber
    ? validUntilRaw & VALIDITY_BLOCK_RANGE_MASK
    : validUntilRaw
  const validAfter = validAfterIsBlockNumber
    ? validAfterRaw & VALIDITY_BLOCK_RANGE_MASK
    : validAfterRaw

  // Authorizer interpretation
  let authorizer: Address | 0n | 1n
  if (authorizerRaw === 0n) {
    authorizer = 0n
  } else if (authorizerRaw === 1n) {
    authorizer = 1n
  } else {
    authorizer = (`0x${authorizerRaw.toString(16).padStart(40, '0')}` as Address)
  }

  return {
    authorizer,
    validUntil,
    validAfter,
    validUntilIsBlockNumber,
    validAfterIsBlockNumber,
  }
}

// ============================================================================
// Pack
// ============================================================================

/**
 * Pack validation data components into a uint256.
 *
 * @param authorizer - 0 (valid), 1 (sig failed), or aggregator address
 * @param validUntil - Expiry time/block (0 = infinite)
 * @param validAfter - Start time/block
 * @param useBlockNumbers - If true, sets bit 47 flag on both validUntil and validAfter
 */
export function packValidationData(
  authorizer: bigint | Address,
  validUntil: bigint,
  validAfter: bigint,
  useBlockNumbers: boolean = false
): bigint {
  let authorizerValue: bigint
  if (typeof authorizer === 'string') {
    authorizerValue = BigInt(authorizer)
  } else {
    authorizerValue = authorizer
  }

  let until = validUntil
  let after = validAfter

  if (useBlockNumbers) {
    until = until | VALIDITY_BLOCK_RANGE_FLAG
    after = after | VALIDITY_BLOCK_RANGE_FLAG
  }

  return (
    (authorizerValue << 96n) |
    ((until & 0xffff_ffff_ffffn) << 48n) |
    (after & 0xffff_ffff_ffffn)
  )
}

// ============================================================================
// Helpers
// ============================================================================

/** Check if validationData indicates signature failure */
export function isSignatureValidationFailed(validationData: bigint): boolean {
  const authorizer = validationData >> 96n
  return authorizer === SIG_VALIDATION_FAILED
}

/** Check if validationData uses block number mode for either field */
export function usesBlockNumberMode(validationData: bigint): boolean {
  const validUntilRaw = (validationData >> 48n) & 0xffff_ffff_ffffn
  const validAfterRaw = validationData & 0xffff_ffff_ffffn
  return (
    (validUntilRaw & VALIDITY_BLOCK_RANGE_FLAG) !== 0n ||
    (validAfterRaw & VALIDITY_BLOCK_RANGE_FLAG) !== 0n
  )
}
