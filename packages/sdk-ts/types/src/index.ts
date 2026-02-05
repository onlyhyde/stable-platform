// ============================================================================
// Existing exports (User Operation types)
// ============================================================================
export type {
  UserOperation,
  PartialUserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  UserOperationLog,
  UserOperationGasEstimation,
  TransactionReceipt,
  UserOpBuilderOptions,
  ExecutionCall,
} from './userOperation'

// ============================================================================
// Network types
// ============================================================================
export type { Network, NetworkCurrency, NetworkState, ChainId } from './network'

export { CHAIN_IDS, DEFAULT_CURRENCIES, getDefaultCurrency } from './network'

// ============================================================================
// Smart Account types
// ============================================================================
export type {
  SmartAccount,
  Call,
  SmartAccountClientConfig,
  PaymasterClient,
  PaymasterStubData,
  PaymasterData,
  UserOperationMiddleware,
  Validator,
  KernelAccountConfig,
  SignerType,
  AccountFactoryConfig,
} from './smartAccount'

// ============================================================================
// Bundler types
// ============================================================================
export type {
  BundlerRpcMethod,
  BundlerClientConfig,
  BundlerClient,
  UserOperationWithTransactionHash,
  WaitForUserOperationReceiptOptions,
  BundlerRpcRequest,
  BundlerRpcResponse,
  BundlerRpcError,
} from './bundler'

export { BUNDLER_ERROR_CODES } from './bundler'

// ============================================================================
// Constants
// ============================================================================
export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_ADDRESSES,
  // MODULE_TYPE is exported from ./module with complete 6 types
  EXEC_MODE,
  CALL_TYPE,
} from './constants'

// ============================================================================
// Transaction types (new)
// ============================================================================
export {
  // Constants
  TRANSACTION_MODE,
  GAS_PAYMENT_TYPE,
  // Types
  type TransactionMode,
  type GasPaymentType,
  type GasPaymentConfig,
  type MultiModeTransactionRequest,
  type GasEstimate,
  type TransactionResult,
  // EIP-7702 types
  type Authorization,
  type SignedAuthorization,
  // Type guards
  isEOAMode,
  isEIP7702Mode,
  isSmartAccountMode,
  isSponsoredGas,
  isERC20Gas,
} from './transaction'

// ============================================================================
// Account types (new)
// ============================================================================
export {
  // Constants
  ACCOUNT_TYPE,
  KEYRING_TYPE,
  // Types
  type AccountType,
  type KeyringType,
  type Account,
  type AccountState,
  // Utilities
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  supportsSmartAccount,
  canInstallModules,
} from './account'

// ============================================================================
// Paymaster types (new)
// ============================================================================
export {
  // Types
  type ExtendedPaymasterData,
  type SupportedToken,
  type SponsorPolicy,
  type PaymasterClientConfig,
  // Constants
  PAYMASTER_RPC_METHODS,
} from './paymaster'

// ============================================================================
// RPC Error types
// ============================================================================
export {
  JSON_RPC_ERROR_CODES,
  PROVIDER_ERROR_CODES,
  BUNDLER_ERROR_CODES as RPC_BUNDLER_ERROR_CODES,
  STABLENET_ERROR_CODES,
  RPC_ERROR_CODES,
  PROVIDER_EVENTS,
  RpcError,
  RPC_ERRORS,
  type RpcErrorCode,
  type RpcErrorData,
  type ProviderEvent,
} from './rpc'

// ============================================================================
// Module types
// ============================================================================
export {
  // Constants
  MODULE_TYPE,
  MODULE_TYPE_NAMES,
  MODULE_STATUS,
  // Types
  type ModuleType,
  type ModuleStatus,
  type ModuleMetadata,
  type ModuleConfigSchema,
  type ModuleConfigField,
  type SolidityType,
  type FieldValidation,
  type InstalledModule,
  type ModuleInstallRequest,
  type ModuleUninstallRequest,
  // Validator configs
  type ECDSAValidatorConfig,
  type WebAuthnValidatorConfig,
  type MultiSigValidatorConfig,
  // Executor configs
  type SessionKeyConfig,
  type RecurringPaymentConfig,
  // Hook configs
  type SpendingLimitHookConfig,
  type AuditHookConfig,
  // Fallback configs
  type TokenReceiverConfig,
  type FlashLoanConfig,
  // Type guards
  isValidator,
  isExecutor,
  isHook,
  isFallback,
  isPolicy,
  isSigner,
  getModuleTypeName,
  // ABI types
  type ModuleABI,
} from './module'
