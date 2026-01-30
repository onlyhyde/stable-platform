/**
 * EIP-7702 Authorization Types
 *
 * EIP-7702 allows EOAs to set their code for a transaction,
 * enabling smart contract functionality for regular accounts.
 */

import type { Address, Hex } from 'viem'

/**
 * EIP-7702 Authorization structure
 * Used to delegate an EOA to a smart contract implementation
 */
export interface Authorization {
  /** Chain ID where the authorization is valid */
  chainId: bigint
  /** Address of the contract to delegate to (or zero address for revocation) */
  address: Address
  /** Nonce for replay protection */
  nonce: bigint
}

/**
 * Signed EIP-7702 Authorization
 * Includes ECDSA signature components
 */
export interface SignedAuthorization extends Authorization {
  /** ECDSA recovery id (0 or 1) */
  v: number
  /** ECDSA r component */
  r: Hex
  /** ECDSA s component */
  s: Hex
}

/**
 * Authorization signature request parameters
 * Used for wallet_signAuthorization RPC method
 */
export interface AuthorizationRequest {
  /** Address of the account to sign with */
  account: Address
  /** Address of the contract to delegate to */
  contractAddress: Address
  /** Chain ID (optional, defaults to current chain) */
  chainId?: number | bigint
  /** Nonce (optional, defaults to current account nonce) */
  nonce?: number | bigint
}

// Note: AuthorizationApprovalRequest is defined in ./approval.ts to avoid duplication
// It uses the Authorization type from this file

/**
 * Authorization signature result
 */
export interface AuthorizationSignatureResult {
  /** The signed authorization */
  signedAuthorization: SignedAuthorization
  /** Authorization hash that was signed */
  authorizationHash: Hex
}

/**
 * Delegation status for an account
 */
export interface DelegationStatus {
  /** Whether the account has active delegation */
  isDelegated: boolean
  /** Address of the delegate contract (if delegated) */
  delegateAddress: Address | null
  /** Current bytecode of the account */
  code: Hex | null
}

/**
 * Known delegate contract presets
 */
export interface DelegatePreset {
  /** Display name */
  name: string
  /** Description of the contract */
  description: string
  /** Contract address */
  address: Address
  /** Supported features */
  features: string[]
  /** Chain IDs where this preset is available */
  chainIds: number[]
}

/**
 * EIP-7702 Constants
 */
export const EIP7702_CONSTANTS = {
  /** Magic byte for authorization hash (0x05) */
  MAGIC_BYTE: 0x05,
  /** SetCode transaction type */
  TX_TYPE: 0x04,
  /** Delegation prefix in bytecode */
  DELEGATION_PREFIX: '0xef0100',
  /** Zero address for revocation */
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000' as Address,
} as const

/**
 * Check if an address is the zero address (revocation)
 */
export function isRevocationAddress(address: Address): boolean {
  return address.toLowerCase() === EIP7702_CONSTANTS.ZERO_ADDRESS.toLowerCase()
}

/**
 * Check if bytecode indicates a delegated account
 */
export function isDelegatedBytecode(code: Hex | null): boolean {
  if (!code || code === '0x') return false
  return code.toLowerCase().startsWith(EIP7702_CONSTANTS.DELEGATION_PREFIX)
}

/**
 * Extract delegate address from delegated account bytecode
 */
export function extractDelegateFromBytecode(code: Hex): Address | null {
  if (!isDelegatedBytecode(code)) return null
  // 0xef0100 (6 chars) + address (40 chars)
  const addressHex = code.slice(8, 48)
  return `0x${addressHex}` as Address
}
