import { type Address, getAddress } from 'viem'

// ============================================================================
// EIP-4337 ValidationData Packing
// ============================================================================

/**
 * EIP-4337 Validation Data (uint256)
 *
 * Layout:
 * | authorizer (20 bytes) | validUntil (6 bytes) | validAfter (6 bytes) |
 *
 * authorizer:
 *   - 0x0 = valid signature
 *   - 0x1 = SIG_VALIDATION_FAILED
 *   - other = aggregator address
 *
 * Block Number Mode (v0.9):
 *   When bit 47 of validUntil and validAfter are both set to 1,
 *   values are interpreted as block numbers instead of timestamps.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export interface ValidationData {
  /** Authorizer: 0x0 = valid, 0x1 = sig failed, other = aggregator address */
  authorizer: Address
  /** Valid until timestamp/block (0 = infinite) */
  validUntil: bigint
  /** Valid after timestamp/block */
  validAfter: bigint
}

/** Signature validation succeeded (address 0x0) */
export const SIG_VALIDATION_SUCCESS =
  '0x0000000000000000000000000000000000000000' as Address
/** Signature validation failed (address 0x1) */
export const SIG_VALIDATION_FAILED =
  '0x0000000000000000000000000000000000000001' as Address

/**
 * Block number mode flag (v0.9)
 * When bit 47 is set, validUntil/validAfter are block numbers
 */
export const VALIDITY_BLOCK_MODE_FLAG = 0x800000000000n

/** Mask for lower 47 bits (block range value) */
export const VALIDITY_BLOCK_RANGE_MASK = 0x7fffffffffffn

/**
 * Pack ValidationData into uint256 bigint
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export function packValidationData(data: ValidationData): bigint {
  const authorizer = BigInt(data.authorizer)
  const validUntil = data.validUntil & 0xffffffffffffn
  const validAfter = data.validAfter & 0xffffffffffffn
  return (authorizer << 96n) | (validUntil << 48n) | validAfter
}

/**
 * Unpack uint256 bigint into ValidationData
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export function unpackValidationData(packed: bigint): ValidationData {
  const rawHex =
    `0x${((packed >> 96n) & 0xffffffffffffffffffffffffffffffffffffffffn).toString(16).padStart(40, '0')}` as Address
  const authorizer = getAddress(rawHex)
  const validUntil = (packed >> 48n) & 0xffffffffffffn
  const validAfter = packed & 0xffffffffffffn
  return { authorizer, validUntil, validAfter }
}

/**
 * Check if validation data uses block number mode (v0.9)
 */
export function isBlockNumberMode(data: ValidationData): boolean {
  return data.validAfter >= VALIDITY_BLOCK_MODE_FLAG && data.validUntil >= VALIDITY_BLOCK_MODE_FLAG
}

/**
 * Check if validation data indicates signature failure
 */
export function isValidationFailed(data: ValidationData): boolean {
  return data.authorizer.toLowerCase() === SIG_VALIDATION_FAILED.toLowerCase()
}
