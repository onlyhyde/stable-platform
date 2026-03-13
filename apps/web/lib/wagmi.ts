'use client'

import { stableNetWallet } from '@stablenet/wallet-sdk/wagmi'
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
 * - stableNetWallet(): StableNet Wallet — dedicated connector that properly
 *   bridges accountsChanged/chainChanged events from the wallet extension
 * - injected(): MetaMask, Rabby, and other generic browser wallets
 *
 * Transports use HTTP RPC endpoints for read-only calls; wallet providers
 * are used directly by connectors for signing/transactions
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  multiInjectedProviderDiscovery: true,
  connectors: [stableNetWallet(), injected()],
  transports: {
    [anvilLocal.id]: createRpcTransport('http://127.0.0.1:8545'),
    [stablenetLocal.id]: createRpcTransport(getLocalConfig().rpcUrl),
    [stablenetTestnet.id]: createRpcTransport(getTestnetConfig().rpcUrl),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
