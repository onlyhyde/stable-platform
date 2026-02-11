import type { Chain } from 'viem'
import { defineChain } from 'viem'
import { getAppConfig, getConfigByChainId, getLocalConfig, getTestnetConfig } from './config'

// Re-export for convenience
export { getConfigByChainId }

/**
 * Anvil (Local) chain definition - chainId 31337
 */
export function getAnvilLocal(): Chain {
  return defineChain({
    id: 31337,
    name: 'Anvil (Local)',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: ['http://127.0.0.1:8545'],
      },
    },
    testnet: true,
  })
}

/**
 * StableNet Local chain definition - chainId 8283
 */
export function getStablenetLocal(): Chain {
  const config = getLocalConfig()
  return defineChain({
    id: 8283,
    name: 'StableNet Local',
    nativeCurrency: {
      decimals: 18,
      name: 'Wrapped KRW Coin',
      symbol: 'WKRC',
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
 * StableNet Testnet chain definition - chainId 82830
 */
export function getStablenetTestnet(): Chain {
  const config = getTestnetConfig()
  return defineChain({
    id: 82830,
    name: 'StableNet Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Wrapped KRW Coin',
      symbol: 'WKRC',
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
 * Anvil (Local) chain definition
 */
export const anvilLocal = getAnvilLocal()

/**
 * StableNet Local chain definition
 */
export const stablenetLocal = getStablenetLocal()

/**
 * StableNet Testnet chain definition
 */
export const stablenetTestnet = getStablenetTestnet()

/**
 * @deprecated Use stablenetLocal instead
 */
export const stablenetDevnet = stablenetLocal

/**
 * Get supported chains (with environment override support)
 */
export function getSupportedChains(): readonly [Chain, ...Chain[]] {
  return [getAnvilLocal(), getStablenetLocal(), getStablenetTestnet()]
}

/**
 * Supported chains - includes all networks supported by wallet
 */
export const supportedChains: readonly [Chain, ...Chain[]] = [
  anvilLocal, // chainId 31337
  stablenetLocal, // chainId 8283
  stablenetTestnet, // chainId 82830
]

/**
 * Get default chain (with environment override support)
 */
export function getDefaultChain(): Chain {
  const appConfig = getAppConfig()
  const chainId = appConfig.defaultChainId

  if (chainId === 82830) {
    return getStablenetTestnet()
  }
  return getStablenetLocal()
}

/**
 * Default chain
 * @deprecated Use getDefaultChain() instead for environment override support
 */
export const defaultChain = stablenetLocal
