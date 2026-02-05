/**
 * @stablenet/types - Shared Type Definitions
 *
 * Core types used across StableNet platform:
 * - ERC-4337 UserOperation types
 * - Network configuration types
 * - RPC error codes and types
 * - Smart Account types
 * - Bundler client types
 * - Multi-mode transaction types
 * - Account types
 * - Paymaster types
 */

// Re-export viem types for convenience
export type { Address, Hex, Hash } from 'viem'

// Export original type modules
export * from './userOp'
export * from './network'
export * from './rpc'
export * from './token'

// User Operation types (from SDK)
export type {
  UserOperation,
  PartialUserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  UserOperationLog,
  UserOperationGasEstimation,
  TransactionReceipt,
} from './userOperation'

// Smart Account types
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

// Bundler types
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

// Constants
export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_ADDRESSES,
  EXEC_MODE,
  CALL_TYPE,
} from './constants'

export { BUNDLER_ERROR_CODES } from './bundler'

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
  // Module ABI
  type ModuleABI,
  // Type guards
  isValidator,
  isExecutor,
  isHook,
  isFallback,
  isPolicy,
  isSigner,
  getModuleTypeName,
} from './module'
