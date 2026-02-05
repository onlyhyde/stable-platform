/**
 * EIP-7702 Module
 *
 * EOA Code Delegation - allows EOAs to temporarily act as Smart Accounts
 */

// Types
export type {
  Authorization,
  SignedAuthorization,
  DelegatePreset,
  DelegationStatus,
  EIP7702Result,
  SetCodeTransactionParams,
} from './types'

// Constants
export {
  EIP7702_MAGIC,
  SETCODE_TX_TYPE,
  DELEGATION_PREFIX,
  ZERO_ADDRESS,
  DELEGATE_PRESETS,
} from './constants'

// Authorization functions
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
} from './authorization'
