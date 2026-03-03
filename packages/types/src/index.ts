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
export type { Address, Hash, Hex } from 'viem'
// ============================================================================
// Account types (new)
// ============================================================================
export {
  // Constants
  ACCOUNT_TYPE,
  type Account,
  type AccountState,
  // Types
  type AccountType,
  canInstallModules,
  // Utilities
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  KEYRING_TYPE,
  type KeyringType,
  supportsSmartAccount,
} from './account'
// Bundler types
export type {
  BundlerClient,
  BundlerClientConfig,
  BundlerRpcError,
  BundlerRpcMethod,
  BundlerRpcRequest,
  BundlerRpcResponse,
  UserOperationWithTransactionHash,
  WaitForUserOperationReceiptOptions,
} from './bundler'
export { BUNDLER_ERROR_CODES } from './bundler'
// Constants
export {
  CALL_TYPE,
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  EXEC_MODE,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from './constants'
// ============================================================================
// Module types
// ============================================================================
export {
  type AuditHookConfig,
  // Validator configs
  type ECDSAValidatorConfig,
  type FieldValidation,
  getModuleTypeName,
  type InstalledModule,
  isExecutor,
  isFallback,
  isHook,
  isPolicy,
  isSigner,
  // Type guards
  isValidator,
  MODULE_STATUS,
  // Constants
  MODULE_TYPE,
  MODULE_TYPE_NAMES,
  // Module ABI
  type ModuleABI,
  type ModuleConfigField,
  type ModuleConfigSchema,
  type ModuleInstallRequest,
  type ModuleMetadata,
  type ModuleStatus,
  // Types
  type ModuleType,
  type ModuleUninstallRequest,
  type MultiSigValidatorConfig,
  type RecurringPaymentConfig,
  // Executor configs
  type SessionKeyConfig,
  type SolidityType,
  // Hook configs
  type SpendingLimitHookConfig,
  type WebAuthnValidatorConfig,
} from './module'
export * from './network'
// ============================================================================
// Paymaster types (new)
// ============================================================================
export {
  // Types
  type ExtendedPaymasterData,
  // Constants
  PAYMASTER_RPC_METHODS,
  type PaymasterClientConfig,
  type SponsorPolicy,
  type SupportedToken,
} from './paymaster'
export * from './rpc'
// Smart Account types
export type {
  AccountFactoryConfig,
  Call,
  KernelAccountConfig,
  PaymasterClient,
  PaymasterData,
  PaymasterStubData,
  SignerType,
  SmartAccount,
  SmartAccountClientConfig,
  UserOperationMiddleware,
  Validator,
} from './smartAccount'
export * from './token'
// ============================================================================
// Transaction types (new)
// ============================================================================
export {
  // EIP-7702 types
  type Authorization,
  GAS_PAYMENT_TYPE,
  type GasEstimate,
  type GasPaymentConfig,
  type GasPaymentType,
  isEIP7702Mode,
  // Type guards
  isEOAMode,
  isERC20Gas,
  isSmartAccountMode,
  isSponsoredGas,
  type MultiModeTransactionRequest,
  type SignedAuthorization,
  // Constants
  TRANSACTION_MODE,
  // Types
  type TransactionMode,
  type TransactionResult,
} from './transaction'
// User Operation types (canonical source - bigint-based)
export type {
  ExecutionCall,
  PackedUserOperation,
  PartialUserOperation,
  TransactionReceipt,
  UserOpBuilderOptions,
  UserOperation,
  UserOperationGasEstimation,
  UserOperationLog,
  UserOperationReceipt,
  UserOperationStatus,
} from './userOperation'
