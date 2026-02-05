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
  type PaymasterErrorDetails,
  // Classes
  SdkError,
  BundlerError,
  UserOperationError,
  TransactionError,
  GasEstimationError,
  ConfigurationError,
  ValidationError,
  PaymasterError,
  // Utilities
  isSdkError,
  isBundlerError,
  isUserOperationError,
  isTransactionError,
  isPaymasterError,
  normalizeError,
  createBundlerError,
  createUserOperationError,
  createTransactionError,
  createConfigurationError,
  createValidationError,
  createPaymasterError,
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
  // EIP-7702
  createEIP7702TransactionBuilder,
  type EIP7702TransactionBuilder,
  type EIP7702TransactionConfig,
  type AuthorizationSigner,
  type DelegationRequest,
  type BuiltEIP7702Transaction,
  // Router
  createTransactionRouter,
  type TransactionRouter,
  type TransactionRouterConfig,
  type PreparedTransaction,
  type ExecuteOptions,
} from './transaction'

// Gas Module
export {
  createGasEstimator,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  type ERC20GasEstimate,
} from './gas'

// Paymaster Client
export {
  createPaymasterClient,
  type PaymasterClientInstance,
  type PartialUserOperationForPaymaster,
  type PaymasterResponse,
  type ERC20PaymentEstimate,
} from './paymasterClient'

// Module System
export {
  createModuleRegistry,
  type ModuleRegistry,
  type ModuleRegistryEntry,
  type ModuleSearchFilters,
  type ModuleRegistryConfig,
  // Built-in modules
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  BUILT_IN_MODULES,
  // Module Client
  createModuleClient,
  type ModuleClient,
  type ModuleClientConfig,
  type ModuleInstallResult,
  type ModuleCalldata,
  // Validator Utilities
  encodeECDSAValidatorInit,
  decodeECDSAValidatorInit,
  validateECDSAValidatorConfig,
  encodeECDSASignature,
  encodeWebAuthnValidatorInit,
  decodeWebAuthnValidatorInit,
  validateWebAuthnValidatorConfig,
  encodeWebAuthnSignature,
  parseWebAuthnCredential,
  encodeMultiSigValidatorInit,
  decodeMultiSigValidatorInit,
  validateMultiSigValidatorConfig,
  encodeMultiSigSignature,
  generateSignerChangeHash,
  identifyValidatorType,
  isValidSignatureFormat,
  validatorUtils,
  type ValidatorValidationResult,
  type WebAuthnSignatureData,
  // Executor Utilities
  encodeSessionKeyInit,
  validateSessionKeyConfig,
  checkSessionKeyPermission,
  createDAppSessionKey,
  encodeRecurringPaymentInit,
  validateRecurringPaymentConfig,
  calculateRecurringPaymentStatus,
  calculateTotalRecurringCost,
  encodeExecuteRecurringPayment,
  encodeExecutorCall,
  encodeBatchExecutorCalls,
  generatePaymentId,
  executorUtils,
  type ExecutorValidationResult,
  type PermissionCheckResult,
  type RecurringPaymentStatus,
  // Hook Utilities
  encodeSpendingLimitInit,
  encodeMultipleSpendingLimitsInit,
  validateSpendingLimitConfig,
  calculateSpendingLimitStatus,
  wouldExceedLimit,
  formatSpendingLimit,
  encodeSetLimit,
  encodeAuditHookInit,
  decodeAuditEventFlags,
  validateAuditHookConfig,
  formatAuditLogEntry,
  getPeriodName,
  suggestSpendingLimit,
  PERIOD_PRESETS,
  hookUtils,
  type HookValidationResult,
  type SpendingLimitStatus,
  type AuditLogEntry,
  // Fallback Utilities
  encodeTokenReceiverInit,
  decodeTokenReceiverFlags,
  validateTokenReceiverConfig,
  getTokenReceiverHandlers,
  encodeERC721ReceivedReturn,
  encodeERC1155ReceivedReturn,
  encodeERC1155BatchReceivedReturn,
  encodeFlashLoanInit,
  validateFlashLoanConfig,
  isFlashLoanAuthorized,
  encodeFallbackHandlerRegistration,
  encodeBatchFallbackRegistration,
  calculateSelector,
  encodeSupportsInterfaceCall,
  getSupportedInterfaceIds,
  INTERFACE_SELECTORS,
  INTERFACE_IDS,
  fallbackUtils,
  type FallbackValidationResult,
  type TokenReceiverCapability,
  type FlashLoanCallbackConfig,
  type FallbackHandlerRegistration,
} from './modules'

// Contract ABIs
export {
  // Kernel Smart Account
  KERNEL_ABI,
  // Entry Point
  ENTRY_POINT_ABI,
  // Validators
  ECDSA_VALIDATOR_ABI,
  WEBAUTHN_VALIDATOR_ABI,
  MULTISIG_VALIDATOR_ABI,
  // Hooks
  SPENDING_LIMIT_HOOK_ABI,
} from './abis'

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
  // Paymaster types
  ExtendedPaymasterData,
  SupportedToken,
  SponsorPolicy,
  PaymasterClientConfig,
  // Module types
  ModuleType,
  ModuleStatus,
  ModuleMetadata,
  ModuleConfigSchema,
  ModuleConfigField,
  SolidityType,
  FieldValidation,
  InstalledModule,
  ModuleInstallRequest,
  ModuleUninstallRequest,
  ECDSAValidatorConfig,
  WebAuthnValidatorConfig,
  MultiSigValidatorConfig,
  SessionKeyConfig,
  RecurringPaymentConfig,
  SpendingLimitHookConfig,
  AuditHookConfig,
  ModuleABI,
} from '@stablenet/sdk-types'

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
  // Paymaster constants
  PAYMASTER_RPC_METHODS,
  // Module constants
  MODULE_TYPE_NAMES,
  MODULE_STATUS,
  // Module type guards
  isValidator,
  isExecutor,
  isHook,
  isFallback,
  isPolicy,
  isSigner,
  getModuleTypeName,
  // Note: BUNDLER_ERROR_CODES is exported from ./errors with extended SDK error codes
} from '@stablenet/sdk-types'
