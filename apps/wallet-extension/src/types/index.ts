import type { Address } from 'viem'

// Re-export from individual type files
export * from './account'
export * from './approval'
export * from './asset'
export * from './bank'
export * from './eip7702'
export * from './keyring'
export * from './network'
export * from './onramp'
export * from './rpc'
export * from './transaction'

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
  // Keyring messages
  | 'GET_KEYRING_STATE'
  | 'KEYRING_STATE'
  | 'CREATE_NEW_WALLET'
  | 'WALLET_CREATED'
  | 'RESTORE_WALLET'
  | 'WALLET_RESTORED'
  | 'UNLOCK_WALLET'
  | 'WALLET_UNLOCKED'
  | 'LOCK_WALLET'
  | 'WALLET_LOCKED'
  | 'IMPORT_PRIVATE_KEY'
  | 'ACCOUNT_IMPORTED'
  | 'ADD_HD_ACCOUNT'
  | 'ACCOUNT_ADDED'
  | 'GET_MNEMONIC'
  | 'MNEMONIC'
  | 'MNEMONIC_ERROR'
  // Settings messages
  | 'SET_AUTO_LOCK_TIMEOUT'
  | 'AUTO_LOCK_TIMEOUT_SET'
  | 'GET_AUTO_LOCK_TIMEOUT'
  | 'AUTO_LOCK_TIMEOUT'
  | 'SET_METAMASK_MODE'
  | 'METAMASK_MODE_SET'
  | 'GET_METAMASK_MODE'
  | 'METAMASK_MODE'
  // Approval messages
  | 'GET_APPROVAL'
  | 'APPROVAL_DATA'
  | 'APPROVAL_RESULT'
  // Network messages
  | 'ADD_NETWORK'
  | 'NETWORK_ADDED'
  | 'NETWORK_ERROR'
  | 'REMOVE_NETWORK'
  | 'NETWORK_REMOVED'
  | 'UPDATE_NETWORK'
  | 'NETWORK_UPDATED'
  | 'SELECT_NETWORK'
  | 'NETWORK_SELECTED'
  // Private key export messages
  | 'EXPORT_PRIVATE_KEY'
  | 'PRIVATE_KEY_EXPORTED'
  | 'PRIVATE_KEY_ERROR'
  // Connected sites messages
  | 'GET_CONNECTED_SITES'
  | 'CONNECTED_SITES'
  | 'DISCONNECT_SITE'
  | 'SITE_DISCONNECTED'
  // Bank messages
  | 'GET_LINKED_BANK_ACCOUNTS'
  | 'LINK_BANK_ACCOUNT'
  | 'UNLINK_BANK_ACCOUNT'
  | 'SYNC_BANK_ACCOUNT'
  | 'BANK_TRANSFER'
  // OnRamp messages
  | 'GET_ONRAMP_ORDERS'
  | 'GET_ONRAMP_QUOTE'
  | 'CREATE_ONRAMP_ORDER'
  | 'CANCEL_ONRAMP_ORDER'
  // Approval lifecycle messages
  | 'GET_PENDING_APPROVALS'
  | 'APPROVAL_ADDED'
  | 'APPROVAL_RESOLVED'
  // Content script messages
  | 'METAMASK_MODE_CHANGED'
  // Provider events (EIP-1193)
  | 'PROVIDER_EVENT'
  // Indexer messages
  | 'GET_TOKEN_BALANCES'
  | 'TOKEN_BALANCES'
  | 'GET_TRANSACTION_HISTORY'
  | 'TRANSACTION_HISTORY'
  | 'CHECK_INDEXER_STATUS'
  | 'INDEXER_STATUS'
  // Asset management messages
  | 'GET_ASSETS'
  | 'ASSETS'
  | 'ADD_TOKEN'
  | 'TOKEN_ADDED'
  | 'REMOVE_TOKEN'
  | 'TOKEN_REMOVED'
  | 'SET_TOKEN_VISIBILITY'
  | 'TOKEN_VISIBILITY_SET'
  // Token price messages
  | 'GET_TOKEN_PRICES'
  | 'TOKEN_PRICES'
  // Ledger hardware wallet messages
  | 'LEDGER_CONNECT'
  | 'LEDGER_DISCONNECT'
  | 'LEDGER_DISCOVER_ACCOUNTS'
  | 'LEDGER_ADD_ACCOUNT'
  | 'LEDGER_CONNECTED'
  | 'LEDGER_DISCONNECTED'
  | 'LEDGER_ACCOUNTS_DISCOVERED'
  | 'LEDGER_ACCOUNT_ADDED'
  | 'LEDGER_ERROR'

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
  | 'modules'
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
  _version: number
  accounts: import('./account').AccountState
  networks: import('./network').NetworkState
  transactions: import('./transaction').TransactionState
  connections: ConnectionState
  keyring: import('./keyring').KeyringControllerState
  assets: import('./asset').AssetState
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
