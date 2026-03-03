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

// EIP-4337 AA Error Framework
export {
  AAError,
  extractAAErrorCode,
  extractRevertReason,
  getAAErrorInfo,
  parseAAError,
  type AAErrorInfo,
  type AAErrorSeverity,
  // Core SDK error types
  BundlerError,
  PaymasterError,
  SdkError,
  UserOperationError,
  type BundlerErrorCode,
  type ErrorContext,
  type SdkErrorCode,
} from './errors'
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
  // Provider types
  ProviderEvent,
  ProviderConnectInfo,
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
  getUserOperationHash,
  packUserOperation,
  unpackUserOperation,
  UserOperationBuilder,
  UserOperationValidationError,
  type FactoryConfig,
  type GasFeesConfig,
  type GasLimitsConfig,
  type PackedUserOperation,
  type PaymasterConfig,
  type UserOperation,
} from './userOp'

// ============================================================================
// New ERC-4337 Modules (from @stablenet/core integration)
// ============================================================================

// Bundler Client
export {
  createBundlerClient,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  type BundlerClient,
  type BundlerClientConfig,
  type UserOperationGasEstimation,
  type WaitForUserOperationReceiptOptions,
} from './bundler'

// Paymaster Client
export {
  createPaymasterClient,
  getPaymasterStubData,
  getPaymasterData,
  type ERC20PaymentEstimate,
  type PartialUserOperationForPaymaster,
  type PaymasterClientInstance,
  type PaymasterResponse,
  type PaymasterClientConfig,
  type SponsorPolicy,
  type SupportedToken,
  type PaymasterStubDataResponse,
  type PaymasterDataResponse,
  type PaymasterUserOpContext,
} from './paymaster'

// Nonce Management
export { getNonce, parseNonce, encodeNonceKey } from './nonce'

// Gas Estimation
export {
  createGasEstimator,
  createSmartAccountGasStrategy,
  estimateUserOperationGas,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  PAYMASTER_VERIFICATION_GAS,
  PAYMASTER_POST_OP_GAS,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  type ERC20GasEstimate,
} from './gas'

// Factory / Counterfactual
export {
  getSenderAddress,
  predictCounterfactualAddress,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from './factory'

// EntryPoint
export {
  ENTRY_POINT_ABI,
  getEntryPointVersion,
  isEntryPointV07,
  isEntryPointV06,
} from './entrypoint'

// ERC-1271 Signature Verification
export {
  isValidSignature,
  verifySignature,
  isSmartContractAccount,
  type SignatureVerificationResult,
} from './signature'

// Simulation
export {
  simulateValidation,
  simulateHandleOp,
  type SimulationResult,
  type HandleOpSimulationResult,
  type ReturnInfo,
  type StakeInfo,
} from './simulation'
