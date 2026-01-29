import type { Address } from 'viem'

/**
 * EIP-1193 Provider interface
 */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: string, listener: (...args: unknown[]) => void): void
  removeListener(event: string, listener: (...args: unknown[]) => void): void
}

/**
 * Connect info returned with connect event
 */
export interface ConnectInfo {
  chainId: string
}

/**
 * Provider RPC error
 */
export interface ProviderRpcError extends Error {
  code: number
  data?: unknown
}

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
 * Provider event types
 */
export type ProviderEvent =
  | 'connect'
  | 'disconnect'
  | 'accountsChanged'
  | 'chainChanged'

/**
 * Transaction request
 */
export interface TransactionRequest {
  from?: Address
  to?: Address
  value?: bigint | string
  data?: `0x${string}`
  gas?: bigint | string
  gasPrice?: bigint | string
  maxFeePerGas?: bigint | string
  maxPriorityFeePerGas?: bigint | string
  nonce?: number
}

/**
 * Wallet SDK configuration
 */
export interface WalletSDKConfig {
  /** Auto-connect on initialization */
  autoConnect?: boolean
  /** Provider detection timeout in ms */
  timeout?: number
}
