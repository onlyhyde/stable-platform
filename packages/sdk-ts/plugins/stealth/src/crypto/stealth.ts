import type { ProjPointType } from '@noble/curves/abstract/weierstrass'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import type { Hex } from 'viem'
import { bytesToHex, getAddress, hexToBytes, toHex } from 'viem'
import { SCHEME_ID } from '../constants'
import type {
  ComputedStealthKey,
  GeneratedStealthAddress,
  StealthKeyPair,
  StealthMetaAddress,
} from '../types'
import { computeViewTag } from './viewTag'

/** Type alias for secp256k1 projective point */
type Secp256k1Point = ProjPointType<bigint>

/**
 * Validate a private key
 * - Must not be zero
 * - Must be less than the curve order n
 */
function validatePrivateKey(privateKey: Hex): void {
  const privKeyBigInt = BigInt(privateKey)

  if (privKeyBigInt === 0n) {
    throw new Error('Invalid private key: cannot be zero')
  }

  if (privKeyBigInt >= secp256k1.CURVE.n) {
    throw new Error('Invalid private key: must be less than curve order')
  }
}

/**
 * Validate a public key
 * - Must be a valid secp256k1 point
 * - Must not be the point at infinity
 */
function validatePublicKey(publicKey: Hex): Secp256k1Point {
  try {
    const point = secp256k1.ProjectivePoint.fromHex(hexToBytes(publicKey))

    // Check for point at infinity
    if (point.equals(secp256k1.ProjectivePoint.ZERO)) {
      throw new Error('Invalid public key: point at infinity')
    }

    return point
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid public key')) {
      throw error
    }
    throw new Error(
      `Invalid public key: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }
}

/**
 * Generate a random private key
 */
export function generatePrivateKey(): Hex {
  const privateKey = secp256k1.utils.randomPrivateKey()
  return bytesToHex(privateKey)
}

/**
 * Derive public key from private key
 */
export function derivePublicKey(privateKey: Hex, compressed = true): Hex {
  validatePrivateKey(privateKey)
  const privKeyBytes = hexToBytes(privateKey)
  const publicKey = secp256k1.getPublicKey(privKeyBytes, compressed)
  return bytesToHex(publicKey)
}

/**
 * Generate a complete stealth key pair
 */
export function generateStealthKeyPair(): StealthKeyPair {
  const privateKey = generatePrivateKey()
  const publicKey = derivePublicKey(privateKey, true)
  return { privateKey, publicKey }
}

/**
 * Generate a stealth address for a recipient
 *
 * This implements the EIP-5564 stealth address generation:
 * 1. Generate ephemeral key pair (r, R = r*G)
 * 2. Compute shared secret S = r * viewingPubKey
 * 3. Compute stealth public key P = spendingPubKey + H(S) * G
 * 4. Derive stealth address from P
 *
 * @param spendingPubKey - Recipient's spending public key
 * @param viewingPubKey - Recipient's viewing public key
 * @param ephemeralPubKeyOverride - Optional ephemeral public key for verification (internal use)
 * @returns The stealth address, ephemeral public key, and view tag
 */
export function generateStealthAddress(
  spendingPubKey: Hex,
  viewingPubKey: Hex,
  ephemeralPubKeyOverride?: Hex
): GeneratedStealthAddress {
  // Validate public keys
  const viewingPoint = validatePublicKey(viewingPubKey)
  const spendingPoint = validatePublicKey(spendingPubKey)

  // 1. Generate ephemeral key pair or use override for verification
  if (ephemeralPubKeyOverride) {
    // For verification: reconstruct from provided ephemeral public key
    // Note: we can't derive the shared secret without the private key
    // This branch is used when we have the ephemeral pub key and viewing private key
    throw new Error('ephemeralPubKeyOverride requires using computeStealthAddressFromSharedSecret')
  }

  const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey()
  const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)
  const ephemeralPrivKeyBigInt = BigInt(bytesToHex(ephemeralPrivateKey))

  // 2. Compute shared secret: S = r * viewingPubKey
  const sharedSecretPoint = viewingPoint.multiply(ephemeralPrivKeyBigInt)

  // 3. Hash the shared secret: H(S)
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)
  const hashedSecret = keccak_256(sharedSecretBytes)

  // 4. Compute stealth public key: P = spendingPubKey + H(S) * G
  const hashScalar = BigInt(bytesToHex(hashedSecret)) % secp256k1.CURVE.n
  const hashPoint = secp256k1.ProjectivePoint.BASE.multiply(hashScalar)
  const stealthPubKeyPoint = spendingPoint.add(hashPoint)

  // Check for degenerate case (extremely unlikely but handle it)
  if (stealthPubKeyPoint.equals(secp256k1.ProjectivePoint.ZERO)) {
    throw new Error('Degenerate stealth public key generated (point at infinity)')
  }

  const stealthPubKey = stealthPubKeyPoint.toRawBytes(false) // uncompressed

  // 5. Derive Ethereum address from stealth public key
  const addressHash = keccak_256(stealthPubKey.slice(1))
  const stealthAddress = getAddress(bytesToHex(addressHash.slice(-20)))

  // 6. Compute view tag
  const viewTag = computeViewTag(sharedSecretBytes)

  return {
    stealthAddress,
    ephemeralPubKey: bytesToHex(ephemeralPubKey) as Hex,
    viewTag,
  }
}

/**
 * Compute the stealth private key from an announcement
 *
 * This implements the recipient's key derivation:
 * 1. Compute shared secret S = viewingPrivateKey * ephemeralPubKey
 * 2. Compute stealth private key p = spendingPrivateKey + H(S)
 *
 * @param ephemeralPubKey - Ephemeral public key from announcement
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns The stealth private key and derived address
 */
export function computeStealthPrivateKey(
  ephemeralPubKey: Hex,
  spendingPrivateKey: Hex,
  viewingPrivateKey: Hex
): ComputedStealthKey {
  // Validate inputs
  validatePrivateKey(spendingPrivateKey)
  validatePrivateKey(viewingPrivateKey)
  const ephemeralPoint = validatePublicKey(ephemeralPubKey)

  // 1. Compute shared secret: S = viewingPrivateKey * ephemeralPubKey
  const viewingPrivKeyBigInt = BigInt(viewingPrivateKey) % secp256k1.CURVE.n
  const sharedSecretPoint = ephemeralPoint.multiply(viewingPrivKeyBigInt)

  // 2. Hash the shared secret
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)
  const hashedSecret = keccak_256(sharedSecretBytes)

  // 3. Compute stealth private key: p = spendingPrivateKey + H(S) mod n
  const spendingPrivKeyBigInt = BigInt(spendingPrivateKey)
  const hashScalar = BigInt(bytesToHex(hashedSecret)) % secp256k1.CURVE.n
  const stealthPrivKeyBigInt = (spendingPrivKeyBigInt + hashScalar) % secp256k1.CURVE.n

  // Handle edge case where result could be zero (extremely unlikely)
  if (stealthPrivKeyBigInt === 0n) {
    throw new Error('Degenerate stealth private key (zero)')
  }

  // Convert to hex with proper padding
  const stealthPrivateKey = toHex(stealthPrivKeyBigInt, { size: 32 })

  // 4. Derive the stealth address
  const stealthPubKey = secp256k1.getPublicKey(hexToBytes(stealthPrivateKey), false) // uncompressed
  const addressHash = keccak_256(stealthPubKey.slice(1))
  const stealthAddress = getAddress(bytesToHex(addressHash.slice(-20)))

  return {
    stealthAddress,
    stealthPrivateKey,
  }
}

/**
 * Check if an ephemeral public key corresponds to a potential stealth address
 * This is used for efficient scanning with view tags
 *
 * @param ephemeralPubKey - Ephemeral public key from announcement
 * @param viewingPrivateKey - Recipient's viewing private key
 * @param expectedViewTag - View tag from announcement
 * @returns True if the view tag matches
 */
export function checkViewTag(
  ephemeralPubKey: Hex,
  viewingPrivateKey: Hex,
  expectedViewTag: Hex
): boolean {
  // Validate inputs
  validatePrivateKey(viewingPrivateKey)
  const ephemeralPoint = validatePublicKey(ephemeralPubKey)

  // Compute shared secret
  const viewingPrivKeyBigInt = BigInt(viewingPrivateKey) % secp256k1.CURVE.n
  const sharedSecretPoint = ephemeralPoint.multiply(viewingPrivKeyBigInt)
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)

  // Compute view tag
  const computedViewTag = computeViewTag(sharedSecretBytes)

  return computedViewTag.toLowerCase() === expectedViewTag.toLowerCase()
}

/**
 * Parse a stealth meta-address from raw bytes
 * Format: spendingPubKey (33 bytes) + viewingPubKey (33 bytes) = 66 bytes
 */
export function parseStealthMetaAddress(raw: Hex): StealthMetaAddress {
  const bytes = hexToBytes(raw)

  if (bytes.length !== 66) {
    throw new Error(`Invalid stealth meta-address length: expected 66 bytes, got ${bytes.length}`)
  }

  const spendingPubKey = bytesToHex(bytes.slice(0, 33)) as Hex
  const viewingPubKey = bytesToHex(bytes.slice(33, 66)) as Hex

  return {
    spendingPubKey,
    viewingPubKey,
    schemeId: SCHEME_ID.SECP256K1,
  }
}

/**
 * Encode a stealth meta-address to raw bytes
 */
export function encodeStealthMetaAddress(spendingPubKey: Hex, viewingPubKey: Hex): Hex {
  const spendingBytes = hexToBytes(spendingPubKey)
  const viewingBytes = hexToBytes(viewingPubKey)

  if (spendingBytes.length !== 33 || viewingBytes.length !== 33) {
    throw new Error('Public keys must be compressed (33 bytes)')
  }

  const combined = new Uint8Array(66)
  combined.set(spendingBytes, 0)
  combined.set(viewingBytes, 33)

  return bytesToHex(combined) as Hex
}

/**
 * Parse a stealth meta-address URI
 * Format: st:<chain>:<stealthMetaAddress>
 *
 * @example
 * ```typescript
 * const result = parseStealthMetaAddressUri('st:eth:0x...')
 * console.log(result.chainPrefix) // 'eth'
 * console.log(result.stealthMetaAddress.spendingPubKey)
 * console.log(result.stealthMetaAddress.viewingPubKey)
 * ```
 */
export function parseStealthMetaAddressUri(uri: string): {
  chainPrefix: string
  stealthMetaAddress: StealthMetaAddress
  raw: Hex
} {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid stealth meta-address URI: must be a non-empty string')
  }

  // Trim whitespace
  const trimmedUri = uri.trim()

  // Check for the 'st:' prefix
  if (!trimmedUri.startsWith('st:')) {
    throw new Error('Invalid stealth meta-address URI: must start with "st:"')
  }

  // Split only on the first two colons to handle hex addresses properly
  const firstColonIndex = trimmedUri.indexOf(':')
  const secondColonIndex = trimmedUri.indexOf(':', firstColonIndex + 1)

  if (secondColonIndex === -1) {
    throw new Error('Invalid stealth meta-address URI format. Expected: st:<chain>:<address>')
  }

  const chainPrefix = trimmedUri.slice(firstColonIndex + 1, secondColonIndex)
  const raw = trimmedUri.slice(secondColonIndex + 1)

  // Validate chain prefix
  if (!chainPrefix || chainPrefix.length === 0) {
    throw new Error('Invalid stealth meta-address URI: chain prefix cannot be empty')
  }

  // Validate chain prefix format (alphanumeric, no special chars except hyphen)
  if (!/^[a-zA-Z0-9-]+$/.test(chainPrefix)) {
    throw new Error('Invalid stealth meta-address URI: chain prefix must be alphanumeric')
  }

  // Validate address
  if (!raw || raw.length === 0) {
    throw new Error('Invalid stealth meta-address URI: address cannot be empty')
  }

  if (!raw.startsWith('0x')) {
    throw new Error('Invalid stealth meta-address: must be a hex string starting with 0x')
  }

  // Validate hex format
  if (!/^0x[a-fA-F0-9]+$/.test(raw)) {
    throw new Error('Invalid stealth meta-address: contains invalid hex characters')
  }

  const stealthMetaAddress = parseStealthMetaAddress(raw as Hex)

  return {
    chainPrefix,
    stealthMetaAddress,
    raw: raw as Hex,
  }
}

/**
 * Encode a stealth meta-address to URI format
 */
export function encodeStealthMetaAddressUri(
  chainPrefix: string,
  spendingPubKey: Hex,
  viewingPubKey: Hex
): string {
  const raw = encodeStealthMetaAddress(spendingPubKey, viewingPubKey)
  return `st:${chainPrefix}:${raw}`
}
