/**
 * EIP-7702 Authorization Signing Logic
 *
 * Based on EIP-7702 specification: EOA Code Delegation
 *
 * Authorization structure: { chainId, address (delegate target), nonce }
 * Signing hash: keccak256(0x05 || rlp([chainId, address, nonce]))
 */

import type { Address, Hex } from 'viem'
import { keccak256, concat, toHex, toRlp, numberToHex } from 'viem'
import { EIP7702_MAGIC, DELEGATION_PREFIX, ZERO_ADDRESS, DELEGATE_PRESETS } from './constants'
import type { Authorization, SignedAuthorization, DelegatePreset, DelegationStatus } from './types'

/**
 * Create authorization hash according to EIP-7702 specification
 * Hash = keccak256(0x05 || rlp([chainId, address, nonce]))
 *
 * @param authorization - Authorization structure
 * @returns Authorization hash for signing
 */
export function createAuthorizationHash(authorization: Authorization): Hex {
  // RLP encode the authorization tuple [chainId, address, nonce]
  const rlpEncoded = toRlp([
    authorization.chainId === BigInt(0) ? '0x' : numberToHex(authorization.chainId),
    authorization.address,
    authorization.nonce === BigInt(0) ? '0x' : numberToHex(authorization.nonce),
  ])

  // Prepend magic byte and hash
  const prefixedData = concat([toHex(EIP7702_MAGIC, { size: 1 }), rlpEncoded])

  return keccak256(prefixedData)
}

/**
 * Create authorization structure
 *
 * @param chainId - Chain ID
 * @param delegateAddress - Address of the contract to delegate to
 * @param nonce - Account nonce
 * @returns Authorization structure
 */
export function createAuthorization(
  chainId: number | bigint,
  delegateAddress: Address,
  nonce: number | bigint
): Authorization {
  return {
    chainId: BigInt(chainId),
    address: delegateAddress,
    nonce: BigInt(nonce),
  }
}

/**
 * Create revocation authorization (delegate to zero address)
 *
 * @param chainId - Chain ID
 * @param nonce - Account nonce
 * @returns Authorization structure for revocation
 */
export function createRevocationAuthorization(
  chainId: number | bigint,
  nonce: number | bigint
): Authorization {
  return createAuthorization(chainId, ZERO_ADDRESS, nonce)
}

/**
 * Parse signature into v, r, s components
 *
 * @param signature - Hex signature string
 * @returns Parsed signature components
 */
export function parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  // Remove 0x prefix
  const sig = signature.slice(2)

  // r = first 32 bytes, s = next 32 bytes, v = last byte
  const r = `0x${sig.slice(0, 64)}` as Hex
  const s = `0x${sig.slice(64, 128)}` as Hex
  const v = Number.parseInt(sig.slice(128, 130), 16)

  // Handle EIP-155 v values (27, 28) and convert to 0, 1 for EIP-7702
  const normalizedV = v >= 27 ? v - 27 : v

  return { v: normalizedV, r, s }
}

/**
 * Create signed authorization from authorization and signature
 *
 * @param authorization - Authorization structure
 * @param signature - ECDSA signature
 * @returns Signed authorization
 */
export function createSignedAuthorization(
  authorization: Authorization,
  signature: Hex
): SignedAuthorization {
  const { v, r, s } = parseSignature(signature)

  return {
    ...authorization,
    v,
    r,
    s,
  }
}

/**
 * Check if an address has EIP-7702 delegation
 * Delegated accounts have bytecode starting with 0xef0100 + 20 bytes address
 *
 * @param code - Account bytecode
 * @returns Whether the account is delegated
 */
export function isDelegatedAccount(code: Hex | undefined | null): boolean {
  if (!code || code === '0x' || code.length < 46) {
    return false
  }
  return code.toLowerCase().startsWith(DELEGATION_PREFIX.toLowerCase())
}

/**
 * Extract delegate address from EIP-7702 delegated account bytecode
 *
 * @param code - Account bytecode
 * @returns Delegate address or null if not delegated
 */
export function extractDelegateAddress(code: Hex | undefined | null): Address | null {
  if (!isDelegatedAccount(code)) {
    return null
  }
  // Extract 20 bytes (40 hex chars) after the 0xef0100 prefix
  return `0x${code!.slice(8, 48)}` as Address
}

/**
 * Get delegation status from account bytecode
 *
 * @param code - Account bytecode
 * @returns Delegation status
 */
export function getDelegationStatus(code: Hex | undefined | null): DelegationStatus {
  const isDelegated = isDelegatedAccount(code)
  const delegateAddress = extractDelegateAddress(code)

  return {
    isDelegated,
    delegateAddress,
    code: code ?? null,
  }
}

/**
 * Validate if an address is a valid Ethereum address
 *
 * @param address - Address to validate
 * @returns Whether the address is valid
 */
export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Get delegate presets for a chain
 *
 * @param chainId - Chain ID
 * @returns Array of delegate presets
 */
export function getDelegatePresets(chainId: number): DelegatePreset[] {
  return DELEGATE_PRESETS[chainId] || []
}

/**
 * Check if authorization is for revocation (delegate to zero address)
 *
 * @param authorization - Authorization structure
 * @returns Whether this is a revocation authorization
 */
export function isRevocationAuthorization(authorization: Authorization): boolean {
  return authorization.address === ZERO_ADDRESS
}

/**
 * Format authorization for display
 *
 * @param authorization - Authorization structure
 * @returns Formatted authorization string
 */
export function formatAuthorization(authorization: Authorization): string {
  return `chainId: ${authorization.chainId}, delegate: ${authorization.address}, nonce: ${authorization.nonce}`
}
