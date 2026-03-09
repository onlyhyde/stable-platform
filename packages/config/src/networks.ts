import type { NativeCurrency, Network } from '@stablenet/types'
import {
  getAnvilConfig,
  getDefaultChainId,
  getLocalConfig,
  getMainnetConfig,
  getSepoliaConfig,
} from './env'

/**
 * Supported Chain IDs
 * Single source of truth for all chain ID references
 */
export const CHAIN_IDS = {
  /** StableNet Local / Testnet (same chain, local reproduces testnet environment) */
  LOCAL: 8283,
  /** Anvil local development node */
  ANVIL: 31337,
  /** Sepolia public testnet */
  SEPOLIA: 11155111,
  /** Ethereum mainnet */
  MAINNET: 1,
} as const

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS]

/**
 * Currency Definitions
 */

export const ETH_CURRENCY: NativeCurrency = {
  name: 'Ether',
  symbol: 'ETH',
  decimals: 18,
}

export const SEPOLIA_ETH_CURRENCY: NativeCurrency = {
  name: 'Sepolia Ether',
  symbol: 'ETH',
  decimals: 18,
}

/**
 * WKRC currency (native coin for StableNet chain 8283)
 */
export const WKRC_CURRENCY: NativeCurrency = {
  name: 'WKRC Coin',
  symbol: 'WKRC',
  decimals: 18,
}

/**
 * Network Definitions
 *
 * Each network has a factory function (reads env vars at call time)
 * and a static constant (evaluated once at module load, for backward compat).
 */

/**
 * Anvil local development node (Chain ID 31337)
 * Env overrides: STABLENET_ANVIL_RPC_URL, STABLENET_ANVIL_BUNDLER_URL, STABLENET_ANVIL_PAYMASTER_URL
 */
export function getAnvilNetwork(): Network {
  const config = getAnvilConfig()
  return {
    chainId: CHAIN_IDS.ANVIL,
    name: 'Anvil (Local)',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    currency: ETH_CURRENCY,
    isTestnet: true,
  }
}

export const ANVIL_NETWORK: Network = getAnvilNetwork()

/**
 * StableNet Local / Testnet (Chain ID 8283)
 * Local environment reproduces the testnet chain for development and testing.
 * Env overrides: STABLENET_LOCAL_RPC_URL, STABLENET_LOCAL_BUNDLER_URL, etc.
 */
export function getLocalNetwork(): Network {
  const config = getLocalConfig()
  return {
    chainId: CHAIN_IDS.LOCAL,
    name: 'StableNet Local',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: WKRC_CURRENCY,
    isTestnet: true,
  }
}

export const LOCAL_NETWORK: Network = getLocalNetwork()

/**
 * Sepolia public testnet (Chain ID 11155111)
 * Env overrides: STABLENET_SEPOLIA_RPC_URL, STABLENET_SEPOLIA_BUNDLER_URL, etc.
 */
export function getSepoliaNetwork(): Network {
  const config = getSepoliaConfig()
  return {
    chainId: CHAIN_IDS.SEPOLIA,
    name: 'Sepolia',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: SEPOLIA_ETH_CURRENCY,
    isTestnet: true,
  }
}

export const SEPOLIA_NETWORK: Network = getSepoliaNetwork()

/**
 * Ethereum Mainnet (Chain ID 1, disabled by default in POC)
 * Env overrides: STABLENET_MAINNET_RPC_URL, STABLENET_MAINNET_BUNDLER_URL, etc.
 */
export function getMainnetNetwork(): Network {
  const config = getMainnetConfig()
  return {
    chainId: CHAIN_IDS.MAINNET,
    name: 'Ethereum',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: ETH_CURRENCY,
    isTestnet: false,
  }
}

export const MAINNET_NETWORK: Network = getMainnetNetwork()

/**
 * Default networks for wallet (testnets only)
 */
export const DEFAULT_NETWORKS: readonly Network[] = [
  LOCAL_NETWORK,
  ANVIL_NETWORK,
  SEPOLIA_NETWORK,
] as const

/**
 * All supported networks (including mainnet)
 */
export const ALL_NETWORKS: readonly Network[] = [...DEFAULT_NETWORKS, MAINNET_NETWORK] as const

/**
 * Network lookup by chain ID
 */
const NETWORK_MAP = new Map<number, Network>(ALL_NETWORKS.map((n) => [n.chainId, n]))

/**
 * Get network by chain ID (O(1) lookup)
 */
export function getNetworkByChainId(chainId: number): Network | undefined {
  return NETWORK_MAP.get(chainId)
}

/**
 * Check if a chain ID is supported
 */
export function isSupportedChainId(chainId: number): boolean {
  return NETWORK_MAP.has(chainId)
}

/**
 * Check if a chain ID is a testnet
 */
export function isTestnet(chainId: number): boolean {
  return NETWORK_MAP.get(chainId)?.isTestnet ?? false
}

/**
 * Default chain ID for new wallets
 * Configurable via STABLENET_DEFAULT_CHAIN_ID environment variable
 */
export const DEFAULT_CHAIN_ID = getDefaultChainId()
