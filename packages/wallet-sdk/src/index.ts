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
  EIP1193Provider,
  ConnectInfo,
  ProviderRpcError,
  WalletState,
  ProviderEvent,
  TransactionRequest,
  WalletSDKConfig,
} from './types'
