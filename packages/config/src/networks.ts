import type { NativeCurrency, Network } from '@stablenet/types'
import {
  getAnvilConfig,
  getDefaultChainId,
  getDevnetConfig,
  getLocalConfig,
  getMainnetConfig,
  getSepoliaConfig,
} from './env'

/**
 * Network Configuration
 * Default networks supported by StableNet
 */

/**
 * Standard ETH currency definition
 */
export const ETH_CURRENCY: NativeCurrency = {
  name: 'Ether',
  symbol: 'ETH',
  decimals: 18,
}

/**
 * Sepolia ETH currency definition
 */
export const SEPOLIA_ETH_CURRENCY: NativeCurrency = {
  name: 'Sepolia Ether',
  symbol: 'ETH',
  decimals: 18,
}

/**
 * Local Anvil network for development
 * URLs configurable via environment variables:
 * - STABLENET_ANVIL_RPC_URL
 * - STABLENET_ANVIL_BUNDLER_URL
 * - STABLENET_ANVIL_PAYMASTER_URL
 */
export function getAnvilNetwork(): Network {
  const config = getAnvilConfig()
  return {
    chainId: 31337,
    name: 'Anvil (Local)',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    currency: ETH_CURRENCY,
    isTestnet: true,
  }
}

/**
 * Static Anvil network (for backward compatibility)
 */
export const ANVIL_NETWORK: Network = getAnvilNetwork()

/**
 * WKRC currency definition (for StableNet Local/Testnet)
 */
export const WKRC_CURRENCY: NativeCurrency = {
  name: 'WKRC Coin',
  symbol: 'WKRC',
  decimals: 18,
}

/**
 * StableNet Local network for development (Chain ID 8283)
 * URLs configurable via environment variables:
 * - STABLENET_LOCAL_RPC_URL
 * - STABLENET_LOCAL_BUNDLER_URL
 * - STABLENET_LOCAL_PAYMASTER_URL
 * - STABLENET_LOCAL_STEALTH_SERVER_URL
 * - STABLENET_LOCAL_EXPLORER_URL
 */
export function getLocalNetwork(): Network {
  const config = getLocalConfig()
  return {
    chainId: 8283,
    name: 'StableNet Local',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: WKRC_CURRENCY,
    isTestnet: true,
  }
}

/**
 * Static StableNet Local network (for backward compatibility)
 */
export const LOCAL_NETWORK: Network = getLocalNetwork()

/**
 * StableNet Devnet
 * URLs configurable via environment variables:
 * - STABLENET_DEVNET_RPC_URL
 * - STABLENET_DEVNET_BUNDLER_URL
 * - STABLENET_DEVNET_PAYMASTER_URL
 */
export function getDevnetNetwork(): Network {
  const config = getDevnetConfig()
  return {
    chainId: 1337,
    name: 'StableNet Devnet',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    currency: ETH_CURRENCY,
    isTestnet: true,
  }
}

/**
 * Static Devnet network (for backward compatibility)
 */
export const DEVNET_NETWORK: Network = getDevnetNetwork()

/**
 * Sepolia testnet
 * URLs configurable via environment variables:
 * - STABLENET_SEPOLIA_RPC_URL
 * - STABLENET_SEPOLIA_BUNDLER_URL
 * - STABLENET_SEPOLIA_PAYMASTER_URL
 * - STABLENET_SEPOLIA_EXPLORER_URL
 */
export function getSepoliaNetwork(): Network {
  const config = getSepoliaConfig()
  return {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: SEPOLIA_ETH_CURRENCY,
    isTestnet: true,
  }
}

/**
 * Static Sepolia network (for backward compatibility)
 */
export const SEPOLIA_NETWORK: Network = getSepoliaNetwork()

/**
 * Ethereum Mainnet (disabled by default in StableNet POC)
 * URLs configurable via environment variables:
 * - STABLENET_MAINNET_RPC_URL
 * - STABLENET_MAINNET_BUNDLER_URL
 * - STABLENET_MAINNET_PAYMASTER_URL
 * - STABLENET_MAINNET_EXPLORER_URL
 */
export function getMainnetNetwork(): Network {
  const config = getMainnetConfig()
  return {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl,
    currency: ETH_CURRENCY,
    isTestnet: false,
  }
}

/**
 * Static Mainnet network (for backward compatibility)
 */
export const MAINNET_NETWORK: Network = getMainnetNetwork()

/**
 * Default networks for wallet
 */
export const DEFAULT_NETWORKS: Network[] = [
  LOCAL_NETWORK,
  ANVIL_NETWORK,
  DEVNET_NETWORK,
  SEPOLIA_NETWORK,
]

/**
 * All supported networks
 */
export const ALL_NETWORKS: Network[] = [...DEFAULT_NETWORKS, MAINNET_NETWORK]

/**
 * Get network by chain ID
 */
export function getNetworkByChainId(chainId: number): Network | undefined {
  return ALL_NETWORKS.find((n) => n.chainId === chainId)
}

/**
 * Check if a chain ID is supported
 */
export function isSupportedChainId(chainId: number): boolean {
  return ALL_NETWORKS.some((n) => n.chainId === chainId)
}

/**
 * Check if a chain ID is a testnet
 */
export function isTestnet(chainId: number): boolean {
  const network = getNetworkByChainId(chainId)
  return network?.isTestnet ?? false
}

/**
 * Default chain ID for new wallets
 * Configurable via STABLENET_DEFAULT_CHAIN_ID environment variable
 */
export const DEFAULT_CHAIN_ID = getDefaultChainId()
