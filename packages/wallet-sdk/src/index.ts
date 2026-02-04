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
