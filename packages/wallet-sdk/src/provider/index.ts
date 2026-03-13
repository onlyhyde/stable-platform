// Internal modules (exported for advanced usage and testing)
export { ChainManager } from './ChainManager'
export { ConnectionManager, type ConnectionManagerCallbacks } from './ConnectionManager'
export { detectProvider, getProvider, isWalletInstalled } from './detect'
// EIP-6963 Multi-Provider Discovery
export {
  createProviderRegistry,
  discoverProviders,
  EIP6963_EVENTS,
  getKnownProviders,
  getProviderRegistry,
  ProviderRegistry,
  type ProviderRegistryEvent,
  type ProviderRegistryListener,
  type RegisteredProvider,
  resetProviderRegistry,
} from './eip6963'
export { createLogger, type Logger, setLoggerSilent } from './logger'
export { ReadOnlyTransport } from './ReadOnlyTransport'
export { type RpcRoute, routeRpcMethod } from './rpcRouter'
export { type SessionData, SessionManager, type SessionManagerConfig } from './SessionManager'
export type {
  AddTokenParams,
  AddTokenResult,
  AssetsChangedEvent,
  StableNetProviderConfig,
  StableNetProviderEvent,
  TransactionConfirmedEvent,
  TransactionSentEvent,
  WalletAsset,
  WalletAssetsResponse,
  WalletNativeAsset,
} from './StableNetProvider'
export { StableNetProvider } from './StableNetProvider'
