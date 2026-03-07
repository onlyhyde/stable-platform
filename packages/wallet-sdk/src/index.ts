/**
 * @stablenet/wallet-sdk
 *
 * SDK for integrating dApps with StableNet Wallet
 *
 * @example
 * ```typescript
 * import { detectProvider, StableNetProvider } from '@stablenet/wallet-sdk'
 *
 * const provider = await detectProvider()
 * if (provider) {
 *   const accounts = await provider.connect()
 *   console.log('Connected:', accounts[0])
 * }
 * ```
 */

// Config
export {
  DEFAULT_NETWORKS,
  getNativeCurrencySymbol,
  LocalStorage,
  NATIVE_CURRENCY_SYMBOLS,
  NetworkRegistry,
  type NetworkRegistryConfig,
  type NetworkStorage,
  networkRegistry,
  toNetworkConfig,
  toNetworkInfo,
} from './config'
// EIP-4337 AA Error Framework
export {
  AAError,
  type AAErrorInfo,
  type AAErrorSeverity,
  // Core SDK error types
  BundlerError,
  type BundlerErrorCode,
  type ErrorContext,
  extractAAErrorCode,
  extractRevertReason,
  getAAErrorInfo,
  PaymasterError,
  parseAAError,
  SdkError,
  type SdkErrorCode,
  UserOperationError,
} from './errors'
// EIP-2255 Permissions
export {
  type AccountsCaveat,
  type ChainCaveat,
  createPermissionManager,
  type ExpiryCaveat,
  PERMISSION_TARGETS,
  type Permission,
  type PermissionCaveat,
  type PermissionCheckResult,
  PermissionManager,
  type PermissionRequest,
  PermissionRequestBuilder,
  type PermissionTarget,
  permissionRequest,
} from './permissions'
// Provider event types
export type {
  StableNetProviderEvent,
  TransactionConfirmedEvent,
  TransactionSentEvent,
} from './provider'
// Provider
// EIP-6963 Multi-Provider Discovery
export {
  createProviderRegistry,
  detectProvider,
  discoverProviders,
  EIP6963_EVENTS,
  getKnownProviders,
  getProvider,
  getProviderRegistry,
  isWalletInstalled,
  ProviderRegistry,
  type ProviderRegistryEvent,
  type ProviderRegistryListener,
  type RegisteredProvider,
  StableNetProvider,
} from './provider'
// StableNet Custom RPC Methods
export {
  // EIP-4337 AA Error Codes
  AA_ERROR_CODES,
  type AAErrorCode,
  // EIP-7702 Types
  type Authorization,
  type DelegationStatus,
  type InstalledModule,
  MODULE_TYPE,
  type ModuleInstallRequest,
  // ERC-7579 Types
  type ModuleType,
  type ModuleUninstallRequest,
  // Paymaster Types
  type PaymasterData,
  type RpcParams,
  type RpcResult,
  type SessionKeyConfig,
  // Session Key Types
  type SessionKeyPermission,
  type SessionKeyResult,
  type SignedAuthorization,
  type SponsorshipRequest,
  STABLENET_RPC_METHODS,
  type StableNetRpcMethod,
  type StableNetRpcSchema,
  type StealthAddressResult,
  // EIP-5564 Stealth Types
  type StealthMetaAddress,
  type StealthPayment,
  type UserOperationGasEstimate,
  type UserOperationReceipt,
  // EIP-4337 Types
  type UserOperationRequest,
} from './rpc'
// Types
export type {
  // Account types
  AccountInfo,
  // Re-exported viem types
  Address,
  AsyncState,
  BalanceInfo,
  BlockExplorer,
  ConnectInfo,
  // Wallet types
  ConnectionStatus,
  EIP1193Provider,
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
  ExtendedWalletState,
  Hash,
  Hex,
  // Network types
  NativeCurrency,
  NetworkConfig,
  NetworkInfo,
  ProviderConnectInfo,
  // Provider types
  ProviderEvent,
  ProviderRpcError,
  // Utility types
  Result,
  RpcErrorCode,
  TokenInfo,
  TransactionRecord,
  // Transaction types
  TransactionRequest,
  TransactionStatus,
  // SDK types
  WalletSDKConfig,
  WalletState,
} from './types'
// Constants
export { RPC_ERROR_CODES } from './types'
// EIP-4337 UserOperation utilities
export {
  computeUserOpHash,
  type FactoryConfig,
  type GasFeesConfig,
  type GasLimitsConfig,
  getUserOperationHash,
  type PackedUserOperation,
  type PaymasterConfig,
  packUserOperation,
  type UserOperation,
  UserOperationBuilder,
  UserOperationValidationError,
  unpackUserOperation,
} from './userOp'

// ============================================================================
// New ERC-4337 Modules (from @stablenet/core integration)
// ============================================================================

// Bundler Client
export {
  type BundlerClient,
  type BundlerClientConfig,
  createBundlerClient,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  type UserOperationGasEstimation,
  type WaitForUserOperationReceiptOptions,
} from './bundler'
// EntryPoint
export {
  ENTRY_POINT_ABI,
  getEntryPointVersion,
  isEntryPointV06,
  isEntryPointV07,
} from './entrypoint'
// Factory / Counterfactual
export {
  getSenderAddress,
  KERNEL_V3_1_FACTORY_ADDRESS,
  predictCounterfactualAddress,
} from './factory'

// Gas Estimation
export {
  createGasEstimator,
  createSmartAccountGasStrategy,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  type ERC20GasEstimate,
  estimateUserOperationGas,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  PAYMASTER_POST_OP_GAS,
  PAYMASTER_VERIFICATION_GAS,
} from './gas'
// Nonce Management
export { encodeNonceKey, getNonce, parseNonce } from './nonce'
// Paymaster Client
export {
  createPaymasterClient,
  type ERC20PaymentEstimate,
  getPaymasterData,
  getPaymasterStubData,
  type PartialUserOperationForPaymaster,
  type PaymasterClientConfig,
  type PaymasterClientInstance,
  type PaymasterDataResponse,
  type PaymasterResponse,
  type PaymasterStubDataResponse,
  type PaymasterUserOpContext,
  type SponsorPolicy,
  type SupportedToken,
} from './paymaster'

// ERC-1271 Signature Verification
export {
  isSmartContractAccount,
  isValidSignature,
  type SignatureVerificationResult,
  verifySignature,
} from './signature'

// Simulation
export {
  type HandleOpSimulationResult,
  type ReturnInfo,
  type SimulationResult,
  type StakeInfo,
  simulateHandleOp,
  simulateValidation,
} from './simulation'
