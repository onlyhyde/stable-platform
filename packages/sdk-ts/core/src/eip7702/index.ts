/**
 * EIP-7702 Module
 *
 * EOA Code Delegation - allows EOAs to temporarily act as Smart Accounts
 */

// Authorization functions
export {
  classifyAccountByCode,
  createAuthorization,
  createAuthorizationHash,
  createRevocationAuthorization,
  createSignedAuthorization,
  extractDelegateAddress,
  formatAuthorization,
  getDelegatePresets,
  getDelegationStatus,
  isDelegatedAccount,
  isEIP7702InitCode,
  isRevocationAuthorization,
  isValidAddress,
  parseEIP7702InitCode,
  parseSignature,
} from './authorization'

// Constants
export {
  DELEGATE_PRESETS,
  DELEGATION_PREFIX,
  EIP7702_INIT_CODE_ADDRESS,
  EIP7702_MAGIC,
  SETCODE_TX_TYPE,
  ZERO_ADDRESS,
} from './constants'
// Types
export type {
  Authorization,
  DelegatePreset,
  DelegationStatus,
  EIP7702Result,
  SetCodeTransactionParams,
  SignedAuthorization,
} from './types'
