/**
 * Nonce Management Utilities
 *
 * Helpers for ERC-4337 nonce management via EntryPoint.getNonce().
 * Supports parallel nonce keys (ERC-4337 v0.7 nonce structure).
 */

import { ENTRY_POINT_ABI, ENTRY_POINT_ADDRESS } from '@stablenet/core'
import type { Address } from 'viem'
import type { PublicClient } from 'viem'

/**
 * Get the current nonce for a smart account from the EntryPoint.
 *
 * @param publicClient - Viem public client
 * @param sender - Smart account address
 * @param key - Nonce key for parallel nonce support (default: 0n)
 * @param entryPoint - EntryPoint address
 */
export async function getNonce(
  publicClient: PublicClient,
  sender: Address,
  key: bigint = 0n,
  entryPoint: Address = ENTRY_POINT_ADDRESS
): Promise<bigint> {
  const nonce = await publicClient.readContract({
    address: entryPoint,
    abi: ENTRY_POINT_ABI,
    functionName: 'getNonce',
    args: [sender, key],
  })
  return nonce as bigint
}

/**
 * Parse an ERC-4337 nonce into its key and sequence components.
 *
 * Nonce structure: key (192 bits) | sequence (64 bits)
 * The key allows parallel nonce channels, sequence is auto-incrementing.
 */
export function parseNonce(nonce: bigint): { key: bigint; sequence: bigint } {
  const sequence = nonce & ((1n << 64n) - 1n)
  const key = nonce >> 64n
  return { key, sequence }
}

/**
 * Encode a nonce key and sequence into a full ERC-4337 nonce.
 *
 * @param key - Nonce key (192 bits)
 * @param sequence - Sequence number (64 bits)
 */
export function encodeNonceKey(key: bigint, sequence: bigint): bigint {
  return (key << 64n) | (sequence & ((1n << 64n) - 1n))
}

// ============================================================================
// Kernel Nonce Detailed Parsing
// ============================================================================

/**
 * Validation mode for Kernel nonce key.
 * Occupies the highest byte (byte 23) of the 192-bit key.
 */
export const VALIDATION_MODE = {
  DEFAULT: 0x00,
  ENABLE: 0x01,
  INSTALL: 0x02,
} as const

/**
 * Validation type for Kernel nonce key.
 * Occupies byte 22 of the 192-bit key.
 */
export const VALIDATION_TYPE = {
  ROOT: 0x00,
  VALIDATOR: 0x01,
  PERMISSION: 0x02,
} as const

export type ValidationMode = (typeof VALIDATION_MODE)[keyof typeof VALIDATION_MODE]
export type ValidationType = (typeof VALIDATION_TYPE)[keyof typeof VALIDATION_TYPE]

/**
 * Detailed nonce structure for Kernel accounts.
 *
 * Full nonce layout (32 bytes / 256 bits):
 *   [mode:1][type:1][validatorId:20][key:2][sequence:8]
 *
 * Where the first 24 bytes (192 bits) form the "key" passed to EntryPoint.getNonce(),
 * and the last 8 bytes (64 bits) are the auto-incrementing sequence.
 */
export interface DetailedNonce {
  /** Validation mode (DEFAULT=0, ENABLE=1, INSTALL=2) */
  mode: ValidationMode
  /** Validation type (ROOT=0, VALIDATOR=1, PERMISSION=2) */
  type: ValidationType
  /** Validator module address (20 bytes) */
  validatorId: Address
  /** Sub-key for parallel nonces within the same validator (2 bytes, 0-65535) */
  key: number
  /** Auto-incrementing sequence number (8 bytes) */
  sequence: bigint
}

/**
 * Parse a full 256-bit nonce into Kernel's detailed structure.
 *
 * Layout: [mode:1][type:1][validatorId:20][key:2][sequence:8]
 *
 * @param nonce - Full 256-bit nonce from EntryPoint
 */
export function parseNonceDetailed(nonce: bigint): DetailedNonce {
  // sequence: lowest 64 bits
  const sequence = nonce & ((1n << 64n) - 1n)
  // key192: upper 192 bits
  const key192 = nonce >> 64n

  // key: lowest 2 bytes of key192 (bits 0..15)
  const key = Number(key192 & 0xffffn)
  // validatorId: next 20 bytes (bits 16..175)
  const validatorId = (key192 >> 16n) & ((1n << 160n) - 1n)
  // type: next 1 byte (bits 176..183)
  const type_ = Number((key192 >> 176n) & 0xffn) as ValidationType
  // mode: highest 1 byte (bits 184..191)
  const mode = Number((key192 >> 184n) & 0xffn) as ValidationMode

  const validatorAddress = `0x${validatorId.toString(16).padStart(40, '0')}` as Address

  return {
    mode,
    type: type_,
    validatorId: validatorAddress,
    key,
    sequence,
  }
}

/**
 * Encode Kernel's detailed nonce structure into a full 256-bit nonce.
 *
 * @param params - Detailed nonce components
 */
export function encodeNonce(params: {
  mode: ValidationMode
  type: ValidationType
  validatorId: Address
  key?: number
  sequence?: bigint
}): bigint {
  const mode = BigInt(params.mode)
  const type_ = BigInt(params.type)
  const validatorId = BigInt(params.validatorId)
  const key = BigInt(params.key ?? 0)
  const sequence = params.sequence ?? 0n

  // Build key192: [mode:1][type:1][validatorId:20][key:2]
  const key192 =
    (mode << 184n) |
    (type_ << 176n) |
    ((validatorId & ((1n << 160n) - 1n)) << 16n) |
    (key & 0xffffn)

  // Full nonce: key192(192) | sequence(64)
  return (key192 << 64n) | (sequence & ((1n << 64n) - 1n))
}
