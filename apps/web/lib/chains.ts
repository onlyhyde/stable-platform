import { defineChain } from 'viem'
import type { Chain } from 'viem'

/**
 * StableNet Devnet chain definition
 */
export const stablenetDevnet = defineChain({
  id: 31337,
  name: 'StableNet Devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'StableNet Explorer',
      url: 'http://localhost:4000',
    },
  },
  testnet: true,
})

/**
 * StableNet Testnet chain definition
 */
export const stablenetTestnet = defineChain({
  id: 11155111, // Using Sepolia ID for now
  name: 'StableNet Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.stablenet.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'StableNet Explorer',
      url: 'https://testnet.stablenet.io/explorer',
    },
  },
  testnet: true,
})

/**
 * Supported chains
 */
export const supportedChains: readonly [Chain, ...Chain[]] = [
  stablenetDevnet,
  stablenetTestnet,
]

/**
 * Default chain
 */
export const defaultChain = stablenetDevnet
