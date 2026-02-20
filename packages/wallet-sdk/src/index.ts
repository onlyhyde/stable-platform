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
