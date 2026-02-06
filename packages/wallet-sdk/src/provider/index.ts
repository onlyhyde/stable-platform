export { StableNetProvider } from './StableNetProvider'
export type {
  TransactionSentEvent,
  TransactionConfirmedEvent,
  BalanceChangeEvent,
  StableNetProviderEvent,
} from './StableNetProvider'
export { detectProvider, getProvider, isWalletInstalled } from './detect'

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
} from './eip6963'
