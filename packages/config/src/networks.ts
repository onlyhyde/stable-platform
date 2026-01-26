import type { Network, NativeCurrency } from '@stablenet/types'

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
 */
export const ANVIL_NETWORK: Network = {
  chainId: 31337,
  name: 'Anvil (Local)',
  rpcUrl: 'http://127.0.0.1:8545',
  bundlerUrl: 'http://127.0.0.1:4337',
  currency: ETH_CURRENCY,
  isTestnet: true,
}

/**
 * StableNet Devnet
 */
export const DEVNET_NETWORK: Network = {
  chainId: 1337,
  name: 'StableNet Devnet',
  rpcUrl: 'http://localhost:8545',
  bundlerUrl: 'http://localhost:4337',
  paymasterUrl: 'http://localhost:4338',
  currency: ETH_CURRENCY,
  isTestnet: true,
}

/**
 * Sepolia testnet
 */
export const SEPOLIA_NETWORK: Network = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://bundler.sepolia.stablenet.dev',
  paymasterUrl: 'https://paymaster.sepolia.stablenet.dev',
  explorerUrl: 'https://sepolia.etherscan.io',
  currency: SEPOLIA_ETH_CURRENCY,
  isTestnet: true,
}

/**
 * Ethereum Mainnet (disabled by default in StableNet POC)
 */
export const MAINNET_NETWORK: Network = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  bundlerUrl: 'https://bundler.mainnet.stablenet.dev',
  paymasterUrl: 'https://paymaster.mainnet.stablenet.dev',
  explorerUrl: 'https://etherscan.io',
  currency: ETH_CURRENCY,
  isTestnet: false,
}

/**
 * Default networks for wallet
 */
export const DEFAULT_NETWORKS: Network[] = [
  ANVIL_NETWORK,
  DEVNET_NETWORK,
  SEPOLIA_NETWORK,
]

/**
 * All supported networks
 */
export const ALL_NETWORKS: Network[] = [
  ...DEFAULT_NETWORKS,
  MAINNET_NETWORK,
]

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
 */
export const DEFAULT_CHAIN_ID = ANVIL_NETWORK.chainId
