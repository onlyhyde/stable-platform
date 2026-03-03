import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'

// ============================================================================
// Constants — Kernel v3 Nonce Layout (from ValidatorLib.sol:35-47)
// ============================================================================
//
// uint256 nonce (32 bytes) as used by EntryPoint v0.7:
//   getNonce(address sender, uint192 key) → key is the upper 192 bits
//
// Kernel encodes the 192-bit key as:
//   | 1B mode | 1B vType | 20B validatorAddress | 2B nonceKey |
//
// The lower 8 bytes (64 bits) are the sequential nonce managed by EntryPoint.

/**
 * Validation modes for Kernel v3
 */
export const VALIDATION_MODE = {
  /** Default validation — uses installed validator directly */
  DEFAULT: 0x00,
  /** Enable mode — installs + validates in one UserOp */
  ENABLE: 0x01,
} as const

export type ValidationMode = (typeof VALIDATION_MODE)[keyof typeof VALIDATION_MODE]

/**
 * Validation types for Kernel v3
 */
export const VALIDATION_TYPE = {
  /** Root validator — stored in account storage, key = 0 */
  ROOT: 0x00,
  /** Non-root validator — address encoded in nonce key */
  VALIDATOR: 0x01,
  /** Permission-based validation */
  PERMISSION: 0x02,
} as const

export type ValidationType = (typeof VALIDATION_TYPE)[keyof typeof VALIDATION_TYPE]

// ============================================================================
// Encoding options
// ============================================================================

export interface EncodeValidatorNonceKeyOptions {
  /** Validation mode (default: DEFAULT) */
  mode?: ValidationMode
  /** Validation type (ROOT, VALIDATOR, PERMISSION) */
  type: ValidationType
  /** Sub-key for distinguishing multiple nonce sequences (default: 0, max 65535) */
  nonceKey?: number
}

export interface DecodedNonceKey {
  mode: ValidationMode
  type: ValidationType
  address: Address
  nonceKey: number
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Encode a validator address into a 192-bit nonce key for EntryPoint.getNonce().
 *
 * Layout (24 bytes / 192 bits):
 *   [1B mode][1B vType][20B validatorAddress][2B nonceKey]
 *
 * For ROOT type, returns 0n (the root validator uses key=0).
 */
export function encodeValidatorNonceKey(
  validatorAddress: Address,
  options: EncodeValidatorNonceKeyOptions
): bigint {
  const { mode = VALIDATION_MODE.DEFAULT, type, nonceKey = 0 } = options

  // Validate nonceKey fits in 2 bytes (uint16)
  if (nonceKey < 0 || nonceKey > 0xffff) {
    throw new Error(
      `nonceKey must be in range 0-65535, got ${nonceKey}`
    )
  }

  // Root validator always uses key = 0n
  if (type === VALIDATION_TYPE.ROOT) {
    return 0n
  }

  // Strip 0x prefix and ensure lowercase
  const addrHex = validatorAddress.slice(2).toLowerCase()

  // Build the 24-byte key:  mode(1) | vType(1) | address(20) | nonceKey(2)
  const modeHex = mode.toString(16).padStart(2, '0')
  const typeHex = type.toString(16).padStart(2, '0')
  const nonceKeyHex = nonceKey.toString(16).padStart(4, '0')

  const keyHex = `${modeHex}${typeHex}${addrHex}${nonceKeyHex}`
  return BigInt(`0x${keyHex}`)
}

/**
 * Decode a 192-bit nonce key back into its components.
 */
export function decodeValidatorNonceKey(key: bigint): DecodedNonceKey {
  if (key === 0n) {
    return {
      mode: VALIDATION_MODE.DEFAULT,
      type: VALIDATION_TYPE.ROOT,
      address: '0x0000000000000000000000000000000000000000' as Address,
      nonceKey: 0,
    }
  }

  // Convert to 48-char hex string (24 bytes = 192 bits)
  const hex = key.toString(16).padStart(48, '0')

  const modeValue = parseInt(hex.slice(0, 2), 16)
  const validModes = [VALIDATION_MODE.DEFAULT, VALIDATION_MODE.ENABLE] as const
  if (!validModes.includes(modeValue as ValidationMode)) {
    throw new Error(`Invalid validation mode: 0x${modeValue.toString(16)}`)
  }
  const mode = modeValue as ValidationMode

  const typeValue = parseInt(hex.slice(2, 4), 16)
  const validTypes = [VALIDATION_TYPE.ROOT, VALIDATION_TYPE.VALIDATOR, VALIDATION_TYPE.PERMISSION] as const
  if (!validTypes.includes(typeValue as ValidationType)) {
    throw new Error(`Invalid validation type: 0x${typeValue.toString(16)}`)
  }
  const type = typeValue as ValidationType
  const rawAddress = `0x${hex.slice(4, 44)}` as Hex
  const nonceKey = parseInt(hex.slice(44, 48), 16)

  return {
    mode,
    type,
    address: getAddress(rawAddress),
    nonceKey,
  }
}

/**
 * Check whether a nonce key represents the root validator.
 */
export function isRootValidator(key: bigint): boolean {
  if (key === 0n) return true
  const decoded = decodeValidatorNonceKey(key)
  return decoded.type === VALIDATION_TYPE.ROOT
}
