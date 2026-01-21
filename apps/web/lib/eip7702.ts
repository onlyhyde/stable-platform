/**
 * EIP-7702 Module Re-export from SDK
 *
 * This file re-exports all EIP-7702 functionality from @stablenet/core
 * for use in the web application.
 */

// Re-export everything from SDK core package
export {
  // Types
  type Authorization,
  type SignedAuthorization,
  type DelegatePreset,
  type DelegationStatus,
  type EIP7702Result,
  type SetCodeTransactionParams,
  // Constants
  EIP7702_MAGIC,
  SETCODE_TX_TYPE,
  DELEGATION_PREFIX,
  ZERO_ADDRESS,
  DELEGATE_PRESETS,
  // Functions
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
} from '@stablenet/core'
