/**
 * Default network configurations for StableNet platform
 */

import type { NetworkConfig, NetworkInfo } from '../types'

/**
 * Default networks
 */
export const DEFAULT_NETWORKS: readonly NetworkConfig[] = [
  {
    id: 31337,
    name: 'Anvil (Local)',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ['http://127.0.0.1:8545'] },
    },
    testnet: true,
  },
  {
    id: 8283,
    name: 'StableNet Local',
    nativeCurrency: {
      name: 'Wrapped KRW Coin',
      symbol: 'WKRC',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ['http://127.0.0.1:8501'] },
    },
    blockExplorers: {
      default: {
        name: 'StableNet Explorer',
        url: 'http://127.0.0.1:3001',
      },
    },
    testnet: true,
  },
  {
    id: 82830,
    name: 'StableNet Testnet',
    nativeCurrency: {
      name: 'Wrapped KRW Coin',
      symbol: 'WKRC',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ['https://rpc.testnet.stablenet.dev'] },
      public: { http: ['https://rpc.testnet.stablenet.dev'] },
    },
    blockExplorers: {
      default: {
        name: 'StableNet Explorer',
        url: 'https://explorer.testnet.stablenet.dev',
      },
    },
    testnet: true,
  },
] as const

/**
 * Native currency symbol mapping by chain ID
 */
export const NATIVE_CURRENCY_SYMBOLS: Record<number, string> = {
  // Ethereum mainnet and L2s
  1: 'ETH',
  10: 'ETH', // Optimism
  42161: 'ETH', // Arbitrum
  8453: 'ETH', // Base
  // Other chains
  137: 'MATIC', // Polygon
  56: 'BNB', // BSC
  43114: 'AVAX', // Avalanche
  // Testnets
  11155111: 'ETH', // Sepolia
  31337: 'ETH', // Anvil/Hardhat
  // StableNet
  8283: 'WKRC', // StableNet Local
  82830: 'WKRC', // StableNet Testnet
}

/**
 * Get native currency symbol for a chain
 */
export function getNativeCurrencySymbol(chainId: number): string {
  return NATIVE_CURRENCY_SYMBOLS[chainId] ?? 'ETH'
}

/**
 * Convert NetworkConfig to minimal NetworkInfo
 */
export function toNetworkInfo(config: NetworkConfig): NetworkInfo {
  return {
    chainId: config.id,
    name: config.name,
    symbol: config.nativeCurrency.symbol,
    rpcUrl: config.rpcUrls.default.http[0],
    explorerUrl: config.blockExplorers?.default?.url,
    isTestnet: config.testnet,
    iconUrl: config.iconUrl,
  }
}

/**
 * Convert NetworkInfo to NetworkConfig
 */
export function toNetworkConfig(info: NetworkInfo): NetworkConfig {
  return {
    id: info.chainId,
    name: info.name,
    nativeCurrency: {
      name: info.symbol,
      symbol: info.symbol,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [info.rpcUrl] },
    },
    blockExplorers: info.explorerUrl
      ? {
          default: {
            name: 'Explorer',
            url: info.explorerUrl,
          },
        }
      : undefined,
    testnet: info.isTestnet,
    iconUrl: info.iconUrl,
    isCustom: true,
    addedAt: Date.now(),
  }
}
