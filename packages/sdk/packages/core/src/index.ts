// Errors
export {
  // Types
  SDK_ERROR_CODES,
  BUNDLER_ERROR_CODES,
  type SdkErrorCode,
  type BundlerErrorCode,
  type ErrorContext,
  type SdkErrorDetails,
  type BundlerErrorDetails,
  type UserOperationErrorDetails,
  type TransactionErrorDetails,
  type GasEstimationErrorDetails,
  // Classes
  SdkError,
  BundlerError,
  UserOperationError,
  TransactionError,
  GasEstimationError,
  ConfigurationError,
  ValidationError,
  // Utilities
  isSdkError,
  isBundlerError,
  isUserOperationError,
  isTransactionError,
  normalizeError,
  createBundlerError,
  createUserOperationError,
  createTransactionError,
  createConfigurationError,
  createValidationError,
  withErrorHandling,
  assertCondition,
  assertDefined,
} from './errors'

// Clients
export { createBundlerClient } from './clients/bundlerClient'
export {
  createSmartAccountClient,
  type SmartAccountClientActions,
  type SendUserOperationArgs,
  type SendTransactionArgs,
} from './clients/smartAccountClient'

// Indexer Client
export {
  IndexerClient,
  createIndexerClient,
  formatTokenBalance,
  parseTokenAmount,
  type IndexerClientConfig,
  type GasStats,
  type TokenBalance,
  type TokenTransfer,
  type IndexedTransaction,
  type PaginatedResult,
} from './clients/indexerClient'

// Utils
export {
  packUserOperation,
  unpackUserOperation,
  getUserOperationHash,
} from './utils/userOperation'

// EIP-7702 Module
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
} from './eip7702'

// Transaction Module
export {
  createEOATransactionBuilder,
  type EOATransactionBuilder,
  type EOATransactionConfig,
  type TransactionSigner,
  type BuiltEOATransaction,
} from './transaction'

// Re-export types for convenience
export type {
  UserOperation,
  PartialUserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  UserOperationGasEstimation,
  SmartAccount,
  Call,
  SmartAccountClientConfig,
  PaymasterClient,
  PaymasterStubData,
  PaymasterData,
  Validator,
  BundlerClient,
  BundlerClientConfig,
  // Network types
  Network,
  NetworkCurrency,
  NetworkState,
  ChainId,
  // Transaction types
  TransactionMode,
  GasPaymentType,
  GasPaymentConfig,
  MultiModeTransactionRequest,
  GasEstimate,
  TransactionResult,
  // Account types
  AccountType,
  KeyringType,
  Account,
  AccountState,
} from '@stablenet/types'

export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_ADDRESSES,
  MODULE_TYPE,
  EXEC_MODE,
  CALL_TYPE,
  // Network constants
  CHAIN_IDS,
  DEFAULT_CURRENCIES,
  getDefaultCurrency,
  // Transaction constants
  TRANSACTION_MODE,
  GAS_PAYMENT_TYPE,
  // Transaction type guards
  isEOAMode,
  isEIP7702Mode,
  isSmartAccountMode,
  isSponsoredGas,
  isERC20Gas,
  // Account constants
  ACCOUNT_TYPE,
  KEYRING_TYPE,
  // Account utilities
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  supportsSmartAccount,
  canInstallModules,
  // Note: BUNDLER_ERROR_CODES is exported from ./errors with extended SDK error codes
} from '@stablenet/types'
