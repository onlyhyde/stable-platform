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
  createAuthorization,
  // Functions
  createAuthorizationHash,
  createRevocationAuthorization,
  createSignedAuthorization,
  DELEGATE_PRESETS,
  DELEGATION_PREFIX,
  type DelegatePreset,
  type DelegationStatus,
  // Constants
  EIP7702_MAGIC,
  type EIP7702Result,
  extractDelegateAddress,
  formatAuthorization,
  getDelegatePresets,
  getDelegationStatus,
  isDelegatedAccount,
  isRevocationAuthorization,
  isValidAddress,
  parseSignature,
  SETCODE_TX_TYPE,
  type SetCodeTransactionParams,
  type SignedAuthorization,
  ZERO_ADDRESS,
} from '@stablenet/core'
