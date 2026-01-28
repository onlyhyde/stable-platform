import { defineChain } from 'viem'
import type { Chain } from 'viem'
import { getDevnetConfig, getTestnetConfig, getAppConfig } from './config'

/**
 * Get StableNet Devnet chain definition (with environment override support)
 */
export function getStablenetDevnet(): Chain {
  const config = getDevnetConfig()
  return defineChain({
    id: 31337,
    name: 'StableNet Devnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: [config.rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: 'StableNet Explorer',
        url: config.explorerUrl,
      },
    },
    testnet: true,
  })
}

/**
 * Get StableNet Testnet chain definition (with environment override support)
 */
export function getStablenetTestnet(): Chain {
  const config = getTestnetConfig()
  return defineChain({
    id: 11155111, // Using Sepolia ID for now
    name: 'StableNet Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: [config.rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: 'StableNet Explorer',
        url: config.explorerUrl,
      },
    },
    testnet: true,
  })
}

/**
 * StableNet Devnet chain definition
 * @deprecated Use getStablenetDevnet() instead for environment override support
 */
export const stablenetDevnet = getStablenetDevnet()

/**
 * StableNet Testnet chain definition
 * @deprecated Use getStablenetTestnet() instead for environment override support
 */
export const stablenetTestnet = getStablenetTestnet()

/**
 * Get supported chains (with environment override support)
 */
export function getSupportedChains(): readonly [Chain, ...Chain[]] {
  return [getStablenetDevnet(), getStablenetTestnet()]
}

/**
 * Supported chains
 * @deprecated Use getSupportedChains() instead for environment override support
 */
export const supportedChains: readonly [Chain, ...Chain[]] = [
  stablenetDevnet,
  stablenetTestnet,
]

/**
 * Get default chain (with environment override support)
 */
export function getDefaultChain(): Chain {
  const appConfig = getAppConfig()
  const chainId = appConfig.defaultChainId

  if (chainId === 11155111) {
    return getStablenetTestnet()
  }
  return getStablenetDevnet()
}

/**
 * Default chain
 * @deprecated Use getDefaultChain() instead for environment override support
 */
export const defaultChain = stablenetDevnet
