/**
 * @stablenet/wallet-sdk Types
 *
 * Comprehensive type definitions for wallet integration
 */

// Re-export viem types for convenience
export type {
  Address,
  Hash,
  Hex,
  EIP1193Provider,
  ProviderConnectInfo,
  ProviderRpcError,
} from 'viem'

import type { Address, EIP1193Provider, Hash, Hex, ProviderConnectInfo } from 'viem'

// ============================================================================
// Network & Chain Types
// ============================================================================

/**
 * Native currency configuration for a network
 */
export interface NativeCurrency {
  name: string
  symbol: string
  decimals: number
}

/**
 * Block explorer configuration
 */
export interface BlockExplorer {
  name: string
  url: string
  apiUrl?: string
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  id: number
  name: string
  nativeCurrency: NativeCurrency
  rpcUrls: {
    default: { http: readonly string[]; webSocket?: readonly string[] }
    public?: { http: readonly string[]; webSocket?: readonly string[] }
  }
  blockExplorers?: {
    default: BlockExplorer
    [key: string]: BlockExplorer
  }
  contracts?: {
    [key: string]: {
      address: Address
      blockCreated?: number
    }
  }
  testnet?: boolean
  isCustom?: boolean
  addedAt?: number
  iconUrl?: string
}

/**
 * Minimal network info for UI display
 */
export interface NetworkInfo {
  chainId: number
  name: string
  symbol: string
  rpcUrl: string
  explorerUrl?: string
  isTestnet?: boolean
  iconUrl?: string
}

// ============================================================================
// Account & Wallet Types
// ============================================================================

/**
 * Account information
 */
export interface AccountInfo {
  address: Address
  name?: string
  type: 'hd' | 'imported' | 'hardware'
  index?: number
  derivationPath?: string
}

/**
 * Balance information
 */
export interface BalanceInfo {
  raw: bigint
  formatted: string
  symbol: string
  decimals: number
  usdValue?: string
}

/**
 * Token information
 */
export interface TokenInfo {
  address: Address
  name: string
  symbol: string
  decimals: number
  chainId: number
  logoURI?: string
  balance?: BalanceInfo
}

/**
 * Wallet connection state
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/**
 * Wallet state
 */
export interface WalletState {
  isConnected: boolean
  account: Address | null
  chainId: number | null
  isConnecting: boolean
}

/**
 * Extended wallet state with network info
 */
export interface ExtendedWalletState extends WalletState {
  accounts: Address[]
  network: NetworkInfo | null
  status: ConnectionStatus
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction request (pre-submission)
 */
export interface TransactionRequest {
  from?: Address
  to?: Address
  value?: bigint | string
  data?: Hex
  gas?: bigint | string
  gasPrice?: bigint | string
  maxFeePerGas?: bigint | string
  maxPriorityFeePerGas?: bigint | string
  nonce?: number
  chainId?: number
}

/**
 * Transaction status
 */
export type TransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'cancelled'

/**
 * Transaction record (post-submission)
 */
export interface TransactionRecord {
  hash: Hash
  from: Address
  to?: Address
  value: bigint
  data?: Hex
  nonce: number
  gasLimit: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  chainId: number
  status: TransactionStatus
  blockNumber?: number
  blockHash?: Hash
  timestamp?: number
  gasUsed?: bigint
  effectiveGasPrice?: bigint
}

// ============================================================================
// EIP-1193 Provider Types (re-exported from viem for type safety)
// ============================================================================

/**
 * EIP-1193 Provider events
 */
export type ProviderEvent =
  | 'connect'
  | 'disconnect'
  | 'chainChanged'
  | 'accountsChanged'
  | 'message'

/**
 * Backward-compatible alias for viem's ProviderConnectInfo
 */
export type ConnectInfo = ProviderConnectInfo

/**
 * EIP-6963 Provider info
 */
export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

/**
 * EIP-6963 Provider detail
 */
export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

// ============================================================================
// SDK Configuration
// ============================================================================

/**
 * Wallet SDK configuration
 */
export interface WalletSDKConfig {
  /** Auto-connect on initialization */
  autoConnect?: boolean
  /** Provider detection timeout in ms */
  timeout?: number
  /** Custom networks to add */
  networks?: NetworkConfig[]
}

// ============================================================================
// RPC Error Codes
// ============================================================================

/**
 * RPC error codes (EIP-1474, EIP-1193)
 */
export const RPC_ERROR_CODES = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Provider errors (EIP-1193)
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  CHAIN_NOT_ADDED: 4902,
} as const

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES]

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for async operations
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

/**
 * Async state
 */
export interface AsyncState<T> {
  data: T | null
  isLoading: boolean
  isError: boolean
  error: Error | null
}
