/**
 * Network and Chain Types
 *
 * Reusable network configuration types for wallet and dApp development.
 */

/**
 * Native currency configuration for a network
 */
export interface NetworkCurrency {
  /** Currency name (e.g., "Ether", "Polygon") */
  name: string
  /** Currency symbol (e.g., "ETH", "MATIC") */
  symbol: string
  /** Number of decimals (typically 18) */
  decimals: number
}

/**
 * Network configuration
 */
export interface Network {
  /** Chain ID */
  chainId: number
  /** Human-readable network name */
  name: string
  /** Primary RPC endpoint URL */
  rpcUrl: string
  /** ERC-4337 Bundler endpoint URL */
  bundlerUrl: string
  /** Paymaster service URL (optional) */
  paymasterUrl?: string
  /** Block explorer URL (optional) */
  explorerUrl?: string
  /** Indexer GraphQL/RPC endpoint URL for token balances and transaction history */
  indexerUrl?: string
  /** Native currency configuration */
  currency: NetworkCurrency
  /** Whether this is a testnet */
  isTestnet?: boolean
  /** Whether this is a user-added custom network */
  isCustom?: boolean
}

/**
 * Network state for wallet
 */
export interface NetworkState {
  /** List of configured networks */
  networks: Network[]
  /** Currently selected chain ID */
  selectedChainId: number
}

/**
 * Common chain IDs
 */
export const CHAIN_IDS = {
  // Mainnets
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  BSC: 56,
  AVALANCHE: 43114,

  // Testnets
  SEPOLIA: 11155111,
  GOERLI: 5,
  MUMBAI: 80001,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM_SEPOLIA: 11155420,
  BASE_SEPOLIA: 84532,

  // Local
  LOCALHOST: 31337,
  HARDHAT: 31337,
  ANVIL: 31337,
} as const

export type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS]

/**
 * Default network currencies by chain ID
 */
export const DEFAULT_CURRENCIES: Record<number, NetworkCurrency> = {
  [CHAIN_IDS.ETHEREUM]: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  [CHAIN_IDS.POLYGON]: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  [CHAIN_IDS.ARBITRUM]: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  [CHAIN_IDS.OPTIMISM]: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  [CHAIN_IDS.BASE]: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  [CHAIN_IDS.BSC]: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  [CHAIN_IDS.AVALANCHE]: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  [CHAIN_IDS.SEPOLIA]: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  [CHAIN_IDS.LOCALHOST]: { name: 'Ether', symbol: 'ETH', decimals: 18 },
}

/**
 * Get default currency for a chain ID
 */
export function getDefaultCurrency(chainId: number): NetworkCurrency {
  return (
    DEFAULT_CURRENCIES[chainId] ?? {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    }
  )
}
