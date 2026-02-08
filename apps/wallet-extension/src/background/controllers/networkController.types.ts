/**
 * NetworkController Types
 * Manages network configuration and switching
 */

import type { Hex } from 'viem'

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number
  chainIdHex: Hex
  name: string
  rpcUrl: string
  /** Backup RPC URLs for automatic failover */
  fallbackRpcUrls?: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  blockExplorerUrl?: string
  isTestnet?: boolean
  isCustom?: boolean
}

/**
 * Network status
 */
export type NetworkStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

/**
 * Network state for a specific chain
 */
export interface NetworkState {
  config: NetworkConfig
  status: NetworkStatus
  latestBlock?: number
  lastError?: string
  /** Timestamp of last successful health check */
  lastHealthCheck?: number
  /** Current active RPC URL (may differ from config.rpcUrl if failover occurred) */
  activeRpcUrl?: string
  /** Number of consecutive failures for the active RPC */
  consecutiveFailures?: number
}

/**
 * Network controller state
 */
export interface NetworkControllerState {
  selectedChainId: number
  networks: Record<number, NetworkState>
  customNetworks: number[]
}

/**
 * Network controller events
 */
export type NetworkControllerEvent =
  | { type: 'network:added'; network: NetworkConfig }
  | { type: 'network:removed'; chainId: number }
  | { type: 'network:switched'; chainId: number }
  | { type: 'network:statusChanged'; chainId: number; status: NetworkStatus }
  | { type: 'chainChanged'; chainId: Hex }

/**
 * Network controller options
 */
export interface NetworkControllerOptions {
  defaultChainId: number
  defaultNetworks: NetworkConfig[]
}

/**
 * Add network request params (EIP-3085)
 */
export interface AddNetworkParams {
  chainId: Hex
  chainName: string
  rpcUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  blockExplorerUrls?: string[]
}

/**
 * Switch network request params (EIP-3326)
 */
export interface SwitchNetworkParams {
  chainId: Hex
}
