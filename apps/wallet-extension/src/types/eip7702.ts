/**
 * EIP-7702 Authorization Types
 *
 * Re-exports SDK types with wallet-specific additions.
 */

import type { Address, Hex } from 'viem'

// Re-export core types from SDK
export type {
  Authorization,
  DelegatePreset,
  DelegationStatus,
  SignedAuthorization,
} from '@stablenet/core'
// Re-export constants from SDK
// Re-export functions from SDK
export {
  DELEGATION_PREFIX,
  EIP7702_MAGIC,
  extractDelegateAddress,
  isDelegatedAccount,
  isRevocationAuthorization,
  SETCODE_TX_TYPE,
  ZERO_ADDRESS,
} from '@stablenet/core'

/**
 * Authorization signature request parameters
 * Used for wallet_signAuthorization RPC method
 * (Wallet-specific type)
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
 * (Wallet-specific type)
 */
export interface AuthorizationSignatureResult {
  /** The signed authorization */
  signedAuthorization: {
    chainId: bigint
    address: Address
    nonce: bigint
    v: number
    r: Hex
    s: Hex
  }
  /** Authorization hash that was signed */
  authorizationHash: Hex
}

/**
 * Legacy EIP7702_CONSTANTS for backwards compatibility
 * @deprecated Use individual exports (ZERO_ADDRESS, DELEGATION_PREFIX, etc.) instead
 */
import { DELEGATION_PREFIX, EIP7702_MAGIC, ZERO_ADDRESS } from '@stablenet/core'
export const EIP7702_CONSTANTS = {
  /** Magic byte for authorization hash (0x05) */
  MAGIC_BYTE: EIP7702_MAGIC,
  /** SetCode transaction type */
  TX_TYPE: 0x04,
  /** Delegation prefix in bytecode */
  DELEGATION_PREFIX: DELEGATION_PREFIX,
  /** Zero address for revocation */
  ZERO_ADDRESS: ZERO_ADDRESS,
} as const

/**
 * Check if an address is the zero address (revocation)
 */
export function isRevocationAddress(address: Address): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
}

/**
 * Check if bytecode indicates a delegated account
 * @deprecated Use isDelegatedAccount from @stablenet/core
 */
export function isDelegatedBytecode(code: Hex | null): boolean {
  if (!code || code === '0x') return false
  return code.toLowerCase().startsWith(DELEGATION_PREFIX.toLowerCase())
}

/**
 * Extract delegate address from delegated account bytecode
 * @deprecated Use extractDelegateAddress from @stablenet/core
 */
export function extractDelegateFromBytecode(code: Hex): Address | null {
  if (!isDelegatedBytecode(code)) return null
  // 0xef0100 (6 chars) + address (40 chars)
  const addressHex = code.slice(8, 48)
  return `0x${addressHex}` as Address
}
