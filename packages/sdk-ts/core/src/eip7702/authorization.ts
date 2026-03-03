/**
 * EIP-7702 Authorization Signing Logic
 *
 * Based on EIP-7702 specification: EOA Code Delegation
 *
 * Authorization structure: { chainId, address (delegate target), nonce }
 * Signing hash: keccak256(0x05 || rlp([chainId, address, nonce]))
 */

import type { Address, Hex } from 'viem'
import { concat, keccak256, numberToHex, toHex, toRlp } from 'viem'
import {
  DELEGATE_PRESETS,
  DELEGATION_PREFIX,
  EIP7702_INIT_CODE_ADDRESS,
  EIP7702_MAGIC,
  ZERO_ADDRESS,
} from './constants'
import type { Authorization, DelegatePreset, DelegationStatus, SignedAuthorization } from './types'

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
  // EIP-7702 delegation: 0xef0100 (3 bytes) + address (20 bytes) = 23 bytes = 46 hex + "0x" = 48 chars
  if (!code || code === '0x' || code.length < 48) {
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
 * Classify account type from on-chain bytecode (pure, synchronous).
 * - No code / '0x' → 'eoa'
 * - Starts with 0xef0100 → 'delegated'
 * - Any other code → 'smart'
 *
 * @param code - Account bytecode from eth_getCode
 * @returns Account type classification
 */
export function classifyAccountByCode(
  code: Hex | undefined | null
): 'eoa' | 'delegated' | 'smart' {
  if (!code || code === '0x') return 'eoa'
  if (isDelegatedAccount(code)) return 'delegated'
  return 'smart'
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

// ============================================================================
// EIP-4337 v0.9 initCode 0x7702 Detection
// ============================================================================

/**
 * Check if initCode uses the EIP-7702 path.
 *
 * Per EIP-4337 v0.9, when initCode starts with address 0x...7702
 * (right-padded to 20 bytes), the EntryPoint skips factory deployment
 * and uses EIP-7702 authorization verification instead.
 *
 * @param initCode - The initCode field from a UserOperation
 * @returns true if initCode indicates EIP-7702 path
 */
export function isEIP7702InitCode(initCode: Hex): boolean {
  if (!initCode || initCode === '0x' || initCode.length < 42) return false
  const factoryAddress = initCode.slice(0, 42).toLowerCase()
  return factoryAddress === EIP7702_INIT_CODE_ADDRESS.toLowerCase()
}

/**
 * Parse EIP-7702 initCode into its components.
 *
 * If initCode > 20 bytes, the remaining bytes are initialization data
 * to be called via senderCreator.
 *
 * @param initCode - The initCode field from a UserOperation
 * @returns Parsed initCode components, or null if not EIP-7702 format
 */
export function parseEIP7702InitCode(
  initCode: Hex
): { isEIP7702: true; initData: Hex } | null {
  if (!isEIP7702InitCode(initCode)) return null

  const initData =
    initCode.length > 42 ? (`0x${initCode.slice(42)}` as Hex) : ('0x' as Hex)

  return { isEIP7702: true, initData }
}
