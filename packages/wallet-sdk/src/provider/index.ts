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
// Internal modules (exported for advanced usage and testing)
export { ChainManager } from './ChainManager'
export { ConnectionManager, type ConnectionManagerCallbacks } from './ConnectionManager'
export { createLogger, setLoggerSilent, type Logger } from './logger'
export { ReadOnlyTransport } from './ReadOnlyTransport'
export { routeRpcMethod, type RpcRoute } from './rpcRouter'
export { SessionManager, type SessionData, type SessionManagerConfig } from './SessionManager'
