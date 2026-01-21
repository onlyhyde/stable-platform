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
 * Helper to safely get contract addresses with validation
 */
function getContractAddresses(chainId: number): { announcer: Address; registry: Address } {
  const announcer = ANNOUNCER_ADDRESSES[chainId]
  const registry = REGISTRY_ADDRESSES[chainId]

  if (!announcer || !registry) {
    throw new Error(`Contract addresses not configured for chain ID ${chainId}`)
  }

  return { announcer, registry }
}

/**
 * Create network config with validated addresses
 */
function createNetworkConfig(
  chainId: number,
  name: string,
  chainPrefix: string,
  options?: { rpcUrl?: string; explorerUrl?: string }
): NetworkConfig {
  const { announcer, registry } = getContractAddresses(chainId)
  return {
    chainId,
    name,
    chainPrefix,
    announcerAddress: announcer,
    registryAddress: registry,
    ...options,
  }
}

/**
 * Predefined network configurations
 */
export const NETWORKS: Record<number, NetworkConfig> = {
  // Ethereum Mainnet
  1: createNetworkConfig(1, 'Ethereum Mainnet', 'eth', {
    explorerUrl: 'https://etherscan.io',
  }),
  // Sepolia Testnet
  11155111: createNetworkConfig(11155111, 'Sepolia', 'sep', {
    explorerUrl: 'https://sepolia.etherscan.io',
  }),
  // Base Mainnet
  8453: createNetworkConfig(8453, 'Base', 'base', {
    explorerUrl: 'https://basescan.org',
  }),
  // Base Sepolia
  84532: createNetworkConfig(84532, 'Base Sepolia', 'basesep', {
    explorerUrl: 'https://sepolia.basescan.org',
  }),
  // StableNet DevNet (local development)
  31337: createNetworkConfig(31337, 'StableNet DevNet', 'stablenet', {
    rpcUrl: 'http://localhost:8545',
  }),
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
