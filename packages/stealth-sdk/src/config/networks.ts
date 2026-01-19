import type { Address } from 'viem'
import { ANNOUNCER_ADDRESSES, REGISTRY_ADDRESSES } from '../constants'

/**
 * Network configuration for stealth address functionality
 */
export interface NetworkConfig {
  /** Chain ID */
  chainId: number
  /** Network name */
  name: string
  /** Chain prefix for stealth meta address URI */
  chainPrefix: string
  /** EIP-5564 Announcer contract address */
  announcerAddress: Address
  /** EIP-6538 Registry contract address */
  registryAddress: Address
  /** RPC URL (optional) */
  rpcUrl?: string
  /** Block explorer URL (optional) */
  explorerUrl?: string
}

/**
 * Predefined network configurations
 */
export const NETWORKS: Record<number, NetworkConfig> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    chainPrefix: 'eth',
    announcerAddress: ANNOUNCER_ADDRESSES[1]!,
    registryAddress: REGISTRY_ADDRESSES[1]!,
    explorerUrl: 'https://etherscan.io',
  },
  // Sepolia Testnet
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    chainPrefix: 'sep',
    announcerAddress: ANNOUNCER_ADDRESSES[11155111]!,
    registryAddress: REGISTRY_ADDRESSES[11155111]!,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  // Base Sepolia
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    chainPrefix: 'basesep',
    announcerAddress: ANNOUNCER_ADDRESSES[84532]!,
    registryAddress: REGISTRY_ADDRESSES[84532]!,
    explorerUrl: 'https://sepolia.basescan.org',
  },
  // StableNet DevNet
  8453: {
    chainId: 8453,
    name: 'StableNet DevNet',
    chainPrefix: 'stablenet',
    announcerAddress: ANNOUNCER_ADDRESSES[8453]!,
    registryAddress: REGISTRY_ADDRESSES[8453]!,
    rpcUrl: 'http://localhost:8545',
  },
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORKS[chainId]
}

/**
 * Get network configuration by chain prefix
 */
export function getNetworkByPrefix(prefix: string): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((network) => network.chainPrefix === prefix)
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in NETWORKS
}
