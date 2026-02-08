/**
 * EIP-7702 Authorization Utilities
 *
 * Re-exports from @stablenet/core SDK with additional wallet-specific utilities.
 * The SDK provides correct RLP encoding for authorization hash generation.
 */

import type { Address } from 'viem'

// Re-export core EIP-7702 functions from SDK
// These use proper RLP encoding as per EIP-7702 specification:
// Hash = keccak256(0x05 || rlp([chainId, address, nonce]))
export {
  createAuthorizationHash,
  createAuthorization,
  createRevocationAuthorization,
  parseSignature,
  createSignedAuthorization,
  isDelegatedAccount,
  extractDelegateAddress,
  getDelegationStatus,
  isValidAddress,
  getDelegatePresets,
  isRevocationAuthorization,
  formatAuthorization,
  // Constants
  EIP7702_MAGIC,
  SETCODE_TX_TYPE,
  DELEGATION_PREFIX,
  ZERO_ADDRESS,
  DELEGATE_PRESETS,
  // Types
  type Authorization,
  type SignedAuthorization,
  type DelegatePreset,
  type DelegationStatus,
} from '@stablenet/core'

// Re-import ZERO_ADDRESS for local helper function
import { ZERO_ADDRESS as SDK_ZERO_ADDRESS } from '@stablenet/core'

/**
 * Check if an address is the zero address (revocation)
 * Wallet-specific helper function
 */
export function isRevocationAddress(address: Address): boolean {
  return address.toLowerCase() === SDK_ZERO_ADDRESS.toLowerCase()
}

/**
 * Validate authorization parameters
 * Wallet-specific validation for RPC requests
 */
export function validateAuthorizationParams(params: {
  account?: Address
  contractAddress?: Address
  chainId?: number | bigint
  nonce?: number | bigint
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!params.account) {
    errors.push('Account address is required')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(params.account)) {
    errors.push('Invalid account address format')
  }

  if (!params.contractAddress) {
    errors.push('Contract address is required')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(params.contractAddress)) {
    errors.push('Invalid contract address format')
  }

  if (params.chainId !== undefined) {
    const chainId = Number(params.chainId)
    if (Number.isNaN(chainId) || chainId <= 0) {
      errors.push('Invalid chain ID')
    }
  }

  if (params.nonce !== undefined) {
    const nonce = Number(params.nonce)
    if (Number.isNaN(nonce) || nonce < 0) {
      errors.push('Invalid nonce')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
