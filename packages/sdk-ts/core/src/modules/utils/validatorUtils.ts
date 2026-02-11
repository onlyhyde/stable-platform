import type {
  ECDSAValidatorConfig,
  MultiSigValidatorConfig,
  WebAuthnValidatorConfig,
} from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import {
  bytesToHex,
  concat,
  decodeAbiParameters,
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  parseAbiParameters,
  toBytes,
} from 'viem'
import { ValidationError } from '../../errors'

// ============================================================================
// Types
// ============================================================================

/**
 * Validator validation result
 */
export interface ValidatorValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * WebAuthn signature data
 */
export interface WebAuthnSignatureData {
  /** Authenticator data */
  authenticatorData: Hex

  /** Client data JSON (raw bytes) */
  clientDataJSON: Hex

  /** Challenge index in client data */
  challengeIndex: number

  /** Type index in client data */
  typeIndex: number

  /** R component of signature */
  r: bigint

  /** S component of signature */
  s: bigint
}

// ============================================================================
// Constants
// ============================================================================

/** Address validation regex */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Minimum signers for multisig */
const MIN_MULTISIG_SIGNERS = 1

/** Maximum signers for multisig */
const MAX_MULTISIG_SIGNERS = 10

/** WebAuthn P256 curve order */
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

// ============================================================================
// ECDSA Validator Utils
// ============================================================================

/**
 * Encode ECDSA validator initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeECDSAValidatorInit({
 *   owner: '0x1234...',
 * })
 * ```
 */
export function encodeECDSAValidatorInit(config: ECDSAValidatorConfig): Hex {
  return encodeAbiParameters(parseAbiParameters('address owner'), [config.owner])
}

/**
 * Decode ECDSA validator initialization data
 */
export function decodeECDSAValidatorInit(data: Hex): ECDSAValidatorConfig {
  const [owner] = decodeAbiParameters(parseAbiParameters('address owner'), data)
  return { owner: owner as Address }
}

/**
 * Validate ECDSA validator configuration
 */
export function validateECDSAValidatorConfig(
  config: ECDSAValidatorConfig
): ValidatorValidationResult {
  const errors: string[] = []

  // Validate owner address
  if (!config.owner) {
    errors.push('Owner address is required')
  } else if (!ADDRESS_REGEX.test(config.owner)) {
    errors.push('Owner must be a valid Ethereum address')
  } else if (config.owner === '0x0000000000000000000000000000000000000000') {
    errors.push('Owner cannot be zero address')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Encode ECDSA signature for validation
 */
export function encodeECDSASignature(signature: { r: Hex; s: Hex; v: number }): Hex {
  // Standard ECDSA signature format: r || s || v
  const rBytes = hexToBytes(signature.r)
  const sBytes = hexToBytes(signature.s)
  const vByte = new Uint8Array([signature.v])

  return bytesToHex(new Uint8Array([...rBytes, ...sBytes, ...vByte]))
}

// ============================================================================
// WebAuthn Validator Utils
// ============================================================================

/**
 * Encode WebAuthn validator initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeWebAuthnValidatorInit({
 *   pubKeyX: 0x1234...n,
 *   pubKeyY: 0x5678...n,
 *   credentialId: '0xabcd...',
 * })
 * ```
 */
export function encodeWebAuthnValidatorInit(config: WebAuthnValidatorConfig): Hex {
  return encodeAbiParameters(
    parseAbiParameters('uint256 pubKeyX, uint256 pubKeyY, bytes credentialId'),
    [config.pubKeyX, config.pubKeyY, config.credentialId]
  )
}

/**
 * Decode WebAuthn validator initialization data
 */
export function decodeWebAuthnValidatorInit(data: Hex): WebAuthnValidatorConfig {
  const [pubKeyX, pubKeyY, credentialId] = decodeAbiParameters(
    parseAbiParameters('uint256 pubKeyX, uint256 pubKeyY, bytes credentialId'),
    data
  )
  return {
    pubKeyX: pubKeyX as bigint,
    pubKeyY: pubKeyY as bigint,
    credentialId: credentialId as Hex,
  }
}

/**
 * Validate WebAuthn validator configuration
 */
export function validateWebAuthnValidatorConfig(
  config: WebAuthnValidatorConfig
): ValidatorValidationResult {
  const errors: string[] = []

  // Validate public key X
  if (config.pubKeyX === undefined || config.pubKeyX === null) {
    errors.push('Public key X coordinate is required')
  } else if (config.pubKeyX <= 0n) {
    errors.push('Public key X must be positive')
  }

  // Validate public key Y
  if (config.pubKeyY === undefined || config.pubKeyY === null) {
    errors.push('Public key Y coordinate is required')
  } else if (config.pubKeyY <= 0n) {
    errors.push('Public key Y must be positive')
  }

  // Validate credential ID
  if (!config.credentialId) {
    errors.push('Credential ID is required')
  } else if (!config.credentialId.startsWith('0x')) {
    errors.push('Credential ID must be a hex string')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Encode WebAuthn signature for validation
 *
 * @example
 * ```typescript
 * const signature = encodeWebAuthnSignature({
 *   authenticatorData: '0x...',
 *   clientDataJSON: '0x...',
 *   challengeIndex: 23,
 *   typeIndex: 1,
 *   r: 0x1234...n,
 *   s: 0x5678...n,
 * })
 * ```
 */
export function encodeWebAuthnSignature(data: WebAuthnSignatureData): Hex {
  // Ensure s is in lower half of curve order (malleability fix)
  let s = data.s
  if (s > P256_N / 2n) {
    s = P256_N - s
  }

  return encodeAbiParameters(
    parseAbiParameters(
      'bytes authenticatorData, bytes clientDataJSON, uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s'
    ),
    [
      data.authenticatorData,
      data.clientDataJSON,
      BigInt(data.challengeIndex),
      BigInt(data.typeIndex),
      data.r,
      s,
    ]
  )
}

/**
 * Parse WebAuthn credential from registration response
 */
export function parseWebAuthnCredential(response: { id: string; publicKey: ArrayBuffer }): {
  credentialId: Hex
  pubKeyX: bigint
  pubKeyY: bigint
} {
  // Credential ID - decode base64url
  const credentialIdBytes = base64UrlToBytes(response.id)
  const credentialId = bytesToHex(credentialIdBytes)

  // Parse COSE public key (P-256 format)
  const publicKeyBytes = new Uint8Array(response.publicKey)

  // For P-256, the COSE key has specific structure
  // Assuming uncompressed point format (0x04 || x || y)
  if (publicKeyBytes[0] !== 0x04) {
    throw new ValidationError(
      'Invalid public key format: expected uncompressed point (0x04 prefix)',
      'publicKey',
      publicKeyBytes[0],
      { operation: 'parseWebAuthnCredential' }
    )
  }

  const x = publicKeyBytes.slice(1, 33)
  const y = publicKeyBytes.slice(33, 65)

  const pubKeyX = BigInt(bytesToHex(x))
  const pubKeyY = BigInt(bytesToHex(y))

  return {
    credentialId,
    pubKeyX,
    pubKeyY,
  }
}

/**
 * Decode base64url string to bytes
 */
function base64UrlToBytes(base64url: string): Uint8Array {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Padded = base64 + padding

  // Decode base64
  const binaryString = atob(base64Padded)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// ============================================================================
// MultiSig Validator Utils
// ============================================================================

/**
 * Encode MultiSig validator initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeMultiSigValidatorInit({
 *   signers: ['0x1234...', '0x5678...', '0x9abc...'],
 *   threshold: 2,
 * })
 * ```
 */
export function encodeMultiSigValidatorInit(config: MultiSigValidatorConfig): Hex {
  return encodeAbiParameters(parseAbiParameters('address[] signers, uint8 threshold'), [
    config.signers,
    config.threshold,
  ])
}

/**
 * Decode MultiSig validator initialization data
 */
export function decodeMultiSigValidatorInit(data: Hex): MultiSigValidatorConfig {
  const [signers, threshold] = decodeAbiParameters(
    parseAbiParameters('address[] signers, uint8 threshold'),
    data
  )
  return {
    signers: signers as Address[],
    threshold: Number(threshold),
  }
}

/**
 * Validate MultiSig validator configuration
 */
export function validateMultiSigValidatorConfig(
  config: MultiSigValidatorConfig
): ValidatorValidationResult {
  const errors: string[] = []

  // Validate signers array
  if (!config.signers || config.signers.length === 0) {
    errors.push('At least one signer is required')
  } else if (config.signers.length < MIN_MULTISIG_SIGNERS) {
    errors.push(`At least ${MIN_MULTISIG_SIGNERS} signer is required`)
  } else if (config.signers.length > MAX_MULTISIG_SIGNERS) {
    errors.push(`Maximum ${MAX_MULTISIG_SIGNERS} signers allowed`)
  } else {
    // Validate each signer address
    config.signers.forEach((signer, index) => {
      if (!ADDRESS_REGEX.test(signer)) {
        errors.push(`Signer ${index + 1} must be a valid Ethereum address`)
      }
      if (signer === '0x0000000000000000000000000000000000000000') {
        errors.push(`Signer ${index + 1} cannot be zero address`)
      }
    })

    // Check for duplicates
    const uniqueSigners = new Set(config.signers.map((s) => s.toLowerCase()))
    if (uniqueSigners.size !== config.signers.length) {
      errors.push('Duplicate signer addresses are not allowed')
    }
  }

  // Validate threshold
  if (config.threshold === undefined || config.threshold === null) {
    errors.push('Threshold is required')
  } else if (config.threshold < 1) {
    errors.push('Threshold must be at least 1')
  } else if (config.signers && config.threshold > config.signers.length) {
    errors.push('Threshold cannot be greater than number of signers')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Encode MultiSig signature for validation
 * Combines multiple ECDSA signatures in order
 */
export function encodeMultiSigSignature(
  signatures: Array<{ signer: Address; r: Hex; s: Hex; v: number }>
): Hex {
  // Sort signatures by signer address (ascending) for deterministic ordering
  const sorted = [...signatures].sort((a, b) =>
    a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
  )

  // Concatenate signatures
  const encoded = sorted.map((sig) => encodeECDSASignature(sig))

  return concat(encoded)
}

/**
 * Generate signer change proposal hash
 * Used for adding/removing signers with multisig approval
 */
export function generateSignerChangeHash(params: {
  account: Address
  operation: 'add' | 'remove'
  signer: Address
  nonce: bigint
}): Hex {
  const operationByte = params.operation === 'add' ? 0x01 : 0x02

  return keccak256(
    concat([
      toBytes(params.account),
      new Uint8Array([operationByte]),
      toBytes(params.signer),
      toBytes(params.nonce),
    ])
  )
}

// ============================================================================
// Common Validator Utils
// ============================================================================

/**
 * Get validator type from address (if known)
 */
export function identifyValidatorType(
  address: Address,
  knownValidators: Record<string, Address>
): string | null {
  const normalizedAddress = address.toLowerCase()

  for (const [type, addr] of Object.entries(knownValidators)) {
    if (addr.toLowerCase() === normalizedAddress) {
      return type
    }
  }

  return null
}

/**
 * Check if signature is valid format
 */
export function isValidSignatureFormat(signature: Hex): boolean {
  // Minimum ECDSA signature length (65 bytes = 130 hex chars + '0x')
  if (signature.length < 132) {
    return false
  }

  // Must be hex
  if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
    return false
  }

  return true
}

// ============================================================================
// Exports
// ============================================================================

export const validatorUtils = {
  // ECDSA
  encodeECDSAValidatorInit,
  decodeECDSAValidatorInit,
  validateECDSAValidatorConfig,
  encodeECDSASignature,

  // WebAuthn
  encodeWebAuthnValidatorInit,
  decodeWebAuthnValidatorInit,
  validateWebAuthnValidatorConfig,
  encodeWebAuthnSignature,
  parseWebAuthnCredential,

  // MultiSig
  encodeMultiSigValidatorInit,
  decodeMultiSigValidatorInit,
  validateMultiSigValidatorConfig,
  encodeMultiSigSignature,
  generateSignerChangeHash,

  // Common
  identifyValidatorType,
  isValidSignatureFormat,
}
