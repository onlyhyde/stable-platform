import type { Address, Hex } from 'viem'

/**
 * Account types
 */
export interface Account {
  address: Address
  name: string
  type: 'smart' | 'eoa'
  isDeployed?: boolean
}

export interface AccountState {
  accounts: Account[]
  selectedAccount: Address | null
}

/**
 * Network types
 */
export interface Network {
  chainId: number
  name: string
  rpcUrl: string
  bundlerUrl: string
  paymasterUrl?: string
  explorerUrl?: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
}

export interface NetworkState {
  networks: Network[]
  selectedChainId: number
}

/**
 * Transaction types
 */
export interface PendingTransaction {
  id: string
  from: Address
  to: Address
  value: bigint
  data?: Hex
  chainId: number
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  userOpHash?: Hex
  txHash?: Hex
  timestamp: number
}

export interface TransactionState {
  pendingTransactions: PendingTransaction[]
  history: PendingTransaction[]
}

/**
 * RPC Request/Response types
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown[]
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

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
 * Keyring types
 */
export interface KeyringAccount {
  address: Address
  type: 'hd' | 'privateKey' | 'hardware'
  index?: number
}

export interface KeyringState {
  isUnlocked: boolean
  accounts: KeyringAccount[]
}

/**
 * UI State types
 */
export interface UIState {
  isLoading: boolean
  error: string | null
  currentPage: 'home' | 'send' | 'receive' | 'activity' | 'settings' | 'connect'
}

/**
 * Complete wallet state
 */
export interface WalletState {
  accounts: AccountState
  networks: NetworkState
  transactions: TransactionState
  connections: ConnectionState
  keyring: KeyringState
  ui: UIState
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
 * Supported RPC methods
 */
export type SupportedMethod =
  | 'eth_accounts'
  | 'eth_requestAccounts'
  | 'eth_chainId'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain'
  | 'eth_sendUserOperation'
  | 'eth_estimateUserOperationGas'
  | 'eth_getUserOperationByHash'
  | 'eth_getUserOperationReceipt'
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'eth_getBalance'
  | 'eth_call'
  | 'eth_blockNumber'
  | 'eth_getTransactionReceipt'
