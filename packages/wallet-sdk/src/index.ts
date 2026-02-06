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

// Provider
export {
  StableNetProvider,
  detectProvider,
  getProvider,
  isWalletInstalled,
} from './provider'

// Provider event types
export type {
  TransactionSentEvent,
  TransactionConfirmedEvent,
  BalanceChangeEvent,
  StableNetProviderEvent,
} from './provider'

// EIP-6963 Multi-Provider Discovery
export {
  ProviderRegistry,
  createProviderRegistry,
  getProviderRegistry,
  discoverProviders,
  getKnownProviders,
  EIP6963_EVENTS,
  type RegisteredProvider,
  type ProviderRegistryEvent,
  type ProviderRegistryListener,
} from './provider'

// EIP-2255 Permissions
export {
  PermissionManager,
  createPermissionManager,
  PermissionRequestBuilder,
  permissionRequest,
  PERMISSION_TARGETS,
  type PermissionTarget,
  type Permission,
  type PermissionRequest,
  type PermissionCaveat,
  type AccountsCaveat,
  type ChainCaveat,
  type ExpiryCaveat,
  type PermissionCheckResult,
} from './permissions'

// StableNet Custom RPC Methods
export {
  STABLENET_RPC_METHODS,
  MODULE_TYPE,
  type StableNetRpcMethod,
  type StableNetRpcSchema,
  type RpcParams,
  type RpcResult,
  // EIP-4337 Types
  type UserOperationRequest,
  type UserOperationReceipt,
  type UserOperationGasEstimate,
  // EIP-7702 Types
  type Authorization,
  type SignedAuthorization,
  type DelegationStatus,
  // ERC-7579 Types
  type ModuleType,
  type InstalledModule,
  type ModuleInstallRequest,
  type ModuleUninstallRequest,
  // Session Key Types
  type SessionKeyPermission,
  type SessionKeyConfig,
  type SessionKeyResult,
  // EIP-5564 Stealth Types
  type StealthMetaAddress,
  type StealthAddressResult,
  type StealthPayment,
  // Paymaster Types
  type PaymasterData,
  type SponsorshipRequest,
} from './rpc'

// Types
export type {
  // Network types
  NativeCurrency,
  BlockExplorer,
  NetworkConfig,
  NetworkInfo,
  // Account types
  AccountInfo,
  BalanceInfo,
  TokenInfo,
  // Wallet types
  ConnectionStatus,
  WalletState,
  ExtendedWalletState,
  // Transaction types
  TransactionRequest,
  TransactionStatus,
  TransactionRecord,
  // Provider types
  ProviderEvent,
  ConnectInfo,
  ProviderRpcError,
  ProviderMessage,
  EIP1193Provider,
  EIP6963ProviderInfo,
  EIP6963ProviderDetail,
  // SDK types
  WalletSDKConfig,
  // Utility types
  Result,
  AsyncState,
  RpcErrorCode,
  // Re-exported viem types
  Address,
  Hash,
  Hex,
} from './types'

// Constants
export { RPC_ERROR_CODES } from './types'

// Config
export {
  DEFAULT_NETWORKS,
  NATIVE_CURRENCY_SYMBOLS,
  getNativeCurrencySymbol,
  toNetworkInfo,
  toNetworkConfig,
  NetworkRegistry,
  networkRegistry,
  LocalStorage,
  type NetworkStorage,
  type NetworkRegistryConfig,
} from './config'
