'use client'

import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { anvilLocal, stablenetLocal, stablenetTestnet, supportedChains } from './chains'
import { getLocalConfig, getTestnetConfig } from './config'

/**
 * Create HTTP transport for RPC calls
 * Note: When using EIP-6963 multi-wallet discovery, the connector handles
 * provider communication directly, so we only need HTTP transport for
 * read-only RPC calls.
 */
function createRpcTransport(rpcUrl: string) {
  return http(rpcUrl)
}

/**
 * Wagmi configuration for StableNet
 * Connectors:
 * - injected(): MetaMask, Rabby, and other browser wallets
 *
 * EIP-6963 Multi Injected Provider Discovery is enabled for detecting
 * multiple wallet extensions (StableNet Wallet, MetaMask, Rabby, etc.)
 *
 * Transports use HTTP RPC endpoints for read-only calls; wallet providers
 * are used directly by connectors for signing/transactions
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  // Enable EIP-6963 multi-wallet discovery
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
  ],
  transports: {
    // Anvil (Local) - chainId 31337
    [anvilLocal.id]: createRpcTransport('http://127.0.0.1:8545'),
    // StableNet Local - chainId 8283 (from config system)
    [stablenetLocal.id]: createRpcTransport(getLocalConfig().rpcUrl),
    // StableNet Testnet - chainId 82830 (from config system)
    [stablenetTestnet.id]: createRpcTransport(getTestnetConfig().rpcUrl),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
