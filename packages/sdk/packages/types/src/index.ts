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
  MODULE_TYPE,
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
// Module types (will be added in 07-MODULE-TYPES.md)
// ============================================================================
// export * from './module'
