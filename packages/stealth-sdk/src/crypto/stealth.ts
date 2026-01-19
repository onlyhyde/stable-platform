import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import type { Hex } from 'viem'
import { hexToBytes, bytesToHex, toHex, getAddress } from 'viem'
import type {
  StealthMetaAddress,
  GeneratedStealthAddress,
  ComputedStealthKey,
  StealthKeyPair,
} from '../types'
import { SCHEME_ID } from '../constants'
import { computeViewTag } from './viewTag'

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
 * @returns The stealth address, ephemeral public key, and view tag
 */
export function generateStealthAddress(
  spendingPubKey: Hex,
  viewingPubKey: Hex
): GeneratedStealthAddress {
  // 1. Generate ephemeral key pair
  const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey()
  const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

  // 2. Compute shared secret: S = r * viewingPubKey
  const viewingPoint = secp256k1.ProjectivePoint.fromHex(hexToBytes(viewingPubKey))
  const sharedSecretPoint = viewingPoint.multiply(
    BigInt(bytesToHex(ephemeralPrivateKey))
  )

  // 3. Hash the shared secret: H(S)
  // We use the x-coordinate of the shared secret point
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)
  const hashedSecret = keccak_256(sharedSecretBytes)

  // 4. Compute stealth public key: P = spendingPubKey + H(S) * G
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(hexToBytes(spendingPubKey))
  const hashScalar = BigInt(bytesToHex(hashedSecret))
  const hashPoint = secp256k1.ProjectivePoint.BASE.multiply(hashScalar % secp256k1.CURVE.n)
  const stealthPubKeyPoint = spendingPoint.add(hashPoint)
  const stealthPubKey = stealthPubKeyPoint.toRawBytes(false) // uncompressed

  // 5. Derive Ethereum address from stealth public key
  // Skip the 0x04 prefix for uncompressed key, then keccak256 and take last 20 bytes
  const addressHash = keccak_256(stealthPubKey.slice(1))
  const stealthAddress = getAddress(
    bytesToHex(addressHash.slice(-20))
  )

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
  // 1. Compute shared secret: S = viewingPrivateKey * ephemeralPubKey
  const ephemeralPoint = secp256k1.ProjectivePoint.fromHex(hexToBytes(ephemeralPubKey))
  const viewingPrivKeyBigInt = BigInt(viewingPrivateKey)
  const sharedSecretPoint = ephemeralPoint.multiply(viewingPrivKeyBigInt)

  // 2. Hash the shared secret
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)
  const hashedSecret = keccak_256(sharedSecretBytes)

  // 3. Compute stealth private key: p = spendingPrivateKey + H(S) mod n
  const spendingPrivKeyBigInt = BigInt(spendingPrivateKey)
  const hashScalar = BigInt(bytesToHex(hashedSecret))
  const stealthPrivKeyBigInt =
    (spendingPrivKeyBigInt + hashScalar) % secp256k1.CURVE.n

  // Convert to hex with proper padding
  const stealthPrivateKey = toHex(stealthPrivKeyBigInt, { size: 32 })

  // 4. Derive the stealth address
  const stealthPubKey = secp256k1.getPublicKey(
    hexToBytes(stealthPrivateKey),
    false
  ) // uncompressed
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
  // Compute shared secret
  const ephemeralPoint = secp256k1.ProjectivePoint.fromHex(hexToBytes(ephemeralPubKey))
  const viewingPrivKeyBigInt = BigInt(viewingPrivateKey)
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
export function encodeStealthMetaAddress(
  spendingPubKey: Hex,
  viewingPubKey: Hex
): Hex {
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
 */
export function parseStealthMetaAddressUri(uri: string): {
  chainPrefix: string
  stealthMetaAddress: StealthMetaAddress
  raw: Hex
} {
  const parts = uri.split(':')

  if (parts.length !== 3 || parts[0] !== 'st') {
    throw new Error('Invalid stealth meta-address URI format. Expected: st:<chain>:<address>')
  }

  const chainPrefix = parts[1]
  const raw = parts[2]

  if (!chainPrefix || !raw) {
    throw new Error('Invalid stealth meta-address URI format. Expected: st:<chain>:<address>')
  }

  if (!raw.startsWith('0x')) {
    throw new Error('Stealth meta-address must be a hex string starting with 0x')
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
