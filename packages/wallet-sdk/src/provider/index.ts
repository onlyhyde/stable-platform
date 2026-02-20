export { detectProvider, getProvider, isWalletInstalled } from './detect'
// EIP-6963 Multi-Provider Discovery
export {
  createProviderRegistry,
  discoverProviders,
  EIP6963_EVENTS,
  getKnownProviders,
  getProviderRegistry,
  ProviderRegistry,
  resetProviderRegistry,
  type ProviderRegistryEvent,
  type ProviderRegistryListener,
  type RegisteredProvider,
} from './eip6963'
export type {
  StableNetProviderEvent,
  TransactionConfirmedEvent,
  TransactionSentEvent,
} from './StableNetProvider'
export { StableNetProvider } from './StableNetProvider'
