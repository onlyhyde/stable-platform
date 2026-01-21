import type { Address, Hex } from 'viem'

// Re-export from individual type files
export * from './account'
export * from './network'
export * from './transaction'
export * from './keyring'
export * from './approval'
export * from './bank'
export * from './onramp'
export * from './rpc'

/**
 * Message types for extension communication
 */
export type MessageType =
  | 'RPC_REQUEST'
  | 'RPC_RESPONSE'
  | 'STATE_UPDATE'
  | 'CONNECT_REQUEST'
  | 'CONNECT_RESPONSE'
  | 'DISCONNECT'
  | 'OPEN_POPUP'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_RESPONSE'
  | 'LOCK'
  | 'UNLOCK'

export interface ExtensionMessage<T = unknown> {
  type: MessageType
  id: string
  payload: T
  origin?: string
}

/**
 * dApp connection types
 */
export interface ConnectedSite {
  origin: string
  name?: string
  icon?: string
  accounts: Address[]
  permissions: string[]
  connectedAt: number
}

export interface ConnectionState {
  connectedSites: ConnectedSite[]
}

/**
 * UI State types
 */
export type Page =
  | 'home'
  | 'send'
  | 'receive'
  | 'activity'
  | 'settings'
  | 'connect'
  | 'bank'
  | 'buy'
  | 'onboarding'
  | 'lock'

export interface UIState {
  isLoading: boolean
  error: string | null
  currentPage: Page
}

/**
 * Complete wallet state
 */
export interface WalletState {
  accounts: import('./account').AccountState
  networks: import('./network').NetworkState
  transactions: import('./transaction').TransactionState
  connections: ConnectionState
  keyring: import('./keyring').KeyringControllerState
  ui: UIState
  isInitialized: boolean
}

/**
 * EIP-1193 Provider types
 */
export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void
  isStableNet: boolean
  chainId: string | null
  selectedAddress: string | null
}

/**
 * EIP-6963 Provider Info
 */
export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}
