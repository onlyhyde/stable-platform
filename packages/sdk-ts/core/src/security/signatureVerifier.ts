/**
 * EIP-1271: Standard Signature Validation Method for Contracts
 *
 * This module provides utilities for verifying signatures from both
 * EOA (Externally Owned Accounts) and smart contract accounts.
 *
 * @see https://eips.ethereum.org/EIPS/eip-1271
 */

import {
  type Address,
  getAddress,
  type Hex,
  hashMessage,
  hashTypedData,
  isAddress,
  type PublicClient,
  type TypedData,
  type TypedDataDomain,
  verifyMessage,
  verifyTypedData,
} from 'viem'

// ============================================================================
// Constants
// ============================================================================

/**
 * EIP-1271 magic value returned for valid signatures
 * bytes4(keccak256("isValidSignature(bytes32,bytes)"))
 */
export const EIP1271_MAGIC_VALUE = '0x1626ba7e' as const

/**
 * Invalid signature return value
 */
export const EIP1271_INVALID_VALUE = '0xffffffff' as const

/**
 * EIP-1271 isValidSignature function selector
 */
export const IS_VALID_SIGNATURE_SELECTOR = '0x1626ba7e' as const

/**
 * EIP-1271 ABI for isValidSignature
 */
export const EIP1271_ABI = [
  {
    name: 'isValidSignature',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

// ============================================================================
// Types
// ============================================================================

/**
 * Signature type classification
 */
export type SignatureType = 'eoa' | 'contract' | 'unknown'

/**
 * Result of signature verification
 */
export interface SignatureVerificationResult {
  /** Whether the signature is valid */
  isValid: boolean
  /** Type of signature (EOA or contract) */
  signatureType: SignatureType
  /** The recovered/verified signer address */
  signer: Address | null
  /** Error message if verification failed */
  error?: string
  /** Additional details */
  details?: {
    /** Whether the signer is a contract */
    isContract: boolean
    /** Raw return value from contract (for EIP-1271) */
    returnValue?: Hex
  }
}

/**
 * Options for signature verification
 */
export interface VerifySignatureOptions {
  /** Force EOA verification only */
  eoaOnly?: boolean
  /** Force contract verification only */
  contractOnly?: boolean
  /** Custom contract ABI for isValidSignature */
  customAbi?: typeof EIP1271_ABI
}

/**
 * Personal message verification params
 */
export interface VerifyPersonalMessageParams {
  /** The message that was signed (string or hex) */
  message: string
  /** The signature */
  signature: Hex
  /** Expected signer address */
  signer: Address
  /** Verification options */
  options?: VerifySignatureOptions
}

/**
 * Typed data verification params
 */
export interface VerifyTypedDataParams {
  /** EIP-712 domain */
  domain: TypedDataDomain
  /** EIP-712 types */
  types: TypedData
  /** Primary type name */
  primaryType: string
  /** Message data */
  message: Record<string, unknown>
  /** The signature */
  signature: Hex
  /** Expected signer address */
  signer: Address
  /** Verification options */
  options?: VerifySignatureOptions
}

/**
 * Raw hash verification params
 */
export interface VerifyHashParams {
  /** The hash that was signed */
  hash: Hex
  /** The signature */
  signature: Hex
  /** Expected signer address */
  signer: Address
  /** Verification options */
  options?: VerifySignatureOptions
}

// ============================================================================
// Signature Verifier Class
// ============================================================================

/**
 * SignatureVerifier - Verifies signatures from EOAs and smart contracts
 *
 * Supports:
 * - EOA signatures (ecrecover)
 * - Smart contract signatures (EIP-1271)
 * - Personal messages (EIP-191)
 * - Typed data (EIP-712)
 *
 * @example
 * ```typescript
 * const verifier = createSignatureVerifier(publicClient)
 *
 * // Verify a personal message
 * const result = await verifier.verifyPersonalMessage({
 *   message: 'Hello, world!',
 *   signature: '0x...',
 *   signer: '0x...',
 * })
 *
 * if (result.isValid) {
 *   console.log('Signature is valid from', result.signatureType)
 * }
 * ```
 */
export class SignatureVerifier {
  private client: PublicClient

  constructor(client: PublicClient) {
    this.client = client
  }

  /**
   * Check if an address is a contract
   */
  async isContract(address: Address): Promise<boolean> {
    try {
      const code = await this.client.getCode({ address })
      return code !== undefined && code !== '0x' && code.length > 2
    } catch {
      return false
    }
  }

  /**
   * Verify a personal message signature (EIP-191)
   */
  async verifyPersonalMessage(
    params: VerifyPersonalMessageParams
  ): Promise<SignatureVerificationResult> {
    const { message, signature, signer, options } = params

    // Validate signer address
    if (!isAddress(signer)) {
      return {
        isValid: false,
        signatureType: 'unknown',
        signer: null,
        error: 'Invalid signer address',
      }
    }

    const normalizedSigner = getAddress(signer)

    // Check if signer is a contract
    const isSignerContract = await this.isContract(normalizedSigner)

    // If contract-only is requested but signer is EOA
    if (options?.contractOnly && !isSignerContract) {
      return {
        isValid: false,
        signatureType: 'eoa',
        signer: normalizedSigner,
        error: 'Expected contract signer but found EOA',
        details: { isContract: false },
      }
    }

    // If EOA-only is requested but signer is contract
    if (options?.eoaOnly && isSignerContract) {
      return {
        isValid: false,
        signatureType: 'contract',
        signer: normalizedSigner,
        error: 'Expected EOA signer but found contract',
        details: { isContract: true },
      }
    }

    // Try EOA verification first (unless contract-only)
    if (!options?.contractOnly) {
      try {
        const isValid = await verifyMessage({
          address: normalizedSigner,
          message,
          signature,
        })

        if (isValid) {
          return {
            isValid: true,
            signatureType: 'eoa',
            signer: normalizedSigner,
            details: { isContract: isSignerContract },
          }
        }
      } catch {
        // EOA verification failed, try contract verification
      }
    }

    // Try contract verification (EIP-1271)
    if (isSignerContract && !options?.eoaOnly) {
      const hash = hashMessage(message)
      return this.verifyContractSignature(normalizedSigner, hash, signature)
    }

    return {
      isValid: false,
      signatureType: isSignerContract ? 'contract' : 'eoa',
      signer: normalizedSigner,
      error: 'Signature verification failed',
      details: { isContract: isSignerContract },
    }
  }

  /**
   * Verify typed data signature (EIP-712)
   */
  async verifyTypedData(params: VerifyTypedDataParams): Promise<SignatureVerificationResult> {
    const { domain, types, primaryType, message, signature, signer, options } = params

    // Validate signer address
    if (!isAddress(signer)) {
      return {
        isValid: false,
        signatureType: 'unknown',
        signer: null,
        error: 'Invalid signer address',
      }
    }

    const normalizedSigner = getAddress(signer)

    // Check if signer is a contract
    const isSignerContract = await this.isContract(normalizedSigner)

    // If contract-only is requested but signer is EOA
    if (options?.contractOnly && !isSignerContract) {
      return {
        isValid: false,
        signatureType: 'eoa',
        signer: normalizedSigner,
        error: 'Expected contract signer but found EOA',
        details: { isContract: false },
      }
    }

    // Try EOA verification first (unless contract-only)
    if (!options?.contractOnly) {
      try {
        const isValid = await verifyTypedData({
          address: normalizedSigner,
          domain,
          types,
          primaryType,
          message,
          signature,
        })

        if (isValid) {
          return {
            isValid: true,
            signatureType: 'eoa',
            signer: normalizedSigner,
            details: { isContract: isSignerContract },
          }
        }
      } catch {
        // EOA verification failed, try contract verification
      }
    }

    // Try contract verification (EIP-1271)
    if (isSignerContract && !options?.eoaOnly) {
      const hash = hashTypedData({ domain, types, primaryType, message })
      return this.verifyContractSignature(normalizedSigner, hash, signature)
    }

    return {
      isValid: false,
      signatureType: isSignerContract ? 'contract' : 'eoa',
      signer: normalizedSigner,
      error: 'Signature verification failed',
      details: { isContract: isSignerContract },
    }
  }

  /**
   * Verify a raw hash signature
   */
  async verifyHash(params: VerifyHashParams): Promise<SignatureVerificationResult> {
    const { hash, signature, signer, options } = params

    // Validate signer address
    if (!isAddress(signer)) {
      return {
        isValid: false,
        signatureType: 'unknown',
        signer: null,
        error: 'Invalid signer address',
      }
    }

    const normalizedSigner = getAddress(signer)

    // Check if signer is a contract
    const isSignerContract = await this.isContract(normalizedSigner)

    // Contract signature verification (EIP-1271)
    if (isSignerContract && !options?.eoaOnly) {
      return this.verifyContractSignature(normalizedSigner, hash, signature)
    }

    // For EOA, we can't verify raw hash without the original message
    // Return unknown result
    return {
      isValid: false,
      signatureType: 'eoa',
      signer: normalizedSigner,
      error: 'Cannot verify raw hash for EOA without original message',
      details: { isContract: false },
    }
  }

  /**
   * Verify signature using EIP-1271 contract call
   */
  private async verifyContractSignature(
    contractAddress: Address,
    hash: Hex,
    signature: Hex
  ): Promise<SignatureVerificationResult> {
    try {
      const result = await this.client.readContract({
        address: contractAddress,
        abi: EIP1271_ABI,
        functionName: 'isValidSignature',
        args: [hash, signature],
      })

      const returnValue = result as Hex
      const isValid = returnValue.toLowerCase() === EIP1271_MAGIC_VALUE.toLowerCase()

      return {
        isValid,
        signatureType: 'contract',
        signer: contractAddress,
        details: {
          isContract: true,
          returnValue,
        },
      }
    } catch (error) {
      return {
        isValid: false,
        signatureType: 'contract',
        signer: contractAddress,
        error: `EIP-1271 verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { isContract: true },
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a signature verifier instance
 */
export function createSignatureVerifier(client: PublicClient): SignatureVerifier {
  return new SignatureVerifier(client)
}

// ============================================================================
// Standalone Utility Functions
// ============================================================================

/**
 * Check if a bytes4 value is the EIP-1271 magic value
 */
export function isEIP1271MagicValue(value: Hex): boolean {
  return value.toLowerCase() === EIP1271_MAGIC_VALUE.toLowerCase()
}

/**
 * Encode isValidSignature call data
 */
export function encodeIsValidSignatureCall(hash: Hex, signature: Hex): Hex {
  // Function selector + hash (32 bytes) + signature offset (32 bytes) + signature length + signature data
  const hashPadded = hash.slice(2).padStart(64, '0')
  const signatureBytes = signature.slice(2)
  const signatureLength = (signatureBytes.length / 2).toString(16).padStart(64, '0')
  const signatureOffset = (64).toString(16).padStart(64, '0') // offset to signature data

  return `${IS_VALID_SIGNATURE_SELECTOR}${hashPadded}${signatureOffset}${signatureLength}${signatureBytes}` as Hex
}

/**
 * Decode isValidSignature result
 */
export function decodeIsValidSignatureResult(data: Hex): {
  isValid: boolean
  magicValue: Hex
} {
  const magicValue = data.slice(0, 10) as Hex
  return {
    isValid: isEIP1271MagicValue(magicValue),
    magicValue,
  }
}
