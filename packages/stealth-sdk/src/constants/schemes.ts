import type { SchemeId } from '../types'

/**
 * EIP-5564 Stealth Address Scheme IDs
 *
 * Scheme ID 0 is reserved.
 * Scheme ID 1 is secp256k1 with view tags.
 */
export const SCHEME_ID = {
  /** Reserved scheme */
  RESERVED: 0 as SchemeId,
  /** secp256k1 with view tags (recommended) */
  SECP256K1: 1 as SchemeId,
} as const

/**
 * Default scheme ID for StableNet
 */
export const DEFAULT_SCHEME_ID: SchemeId = SCHEME_ID.SECP256K1

/**
 * View tag size in bytes
 */
export const VIEW_TAG_SIZE = 1

/**
 * Ephemeral public key size (compressed) in bytes
 */
export const COMPRESSED_PUBKEY_SIZE = 33

/**
 * Ephemeral public key size (uncompressed) in bytes
 */
export const UNCOMPRESSED_PUBKEY_SIZE = 65

/**
 * Stealth meta address prefix
 */
export const STEALTH_META_ADDRESS_PREFIX = 'st'

/**
 * Supported chain prefixes
 */
export const CHAIN_PREFIX = {
  ETHEREUM: 'eth',
  STABLENET: 'stablenet',
  SEPOLIA: 'sep',
  BASE_SEPOLIA: 'basesep',
} as const

export type ChainPrefix = (typeof CHAIN_PREFIX)[keyof typeof CHAIN_PREFIX]
