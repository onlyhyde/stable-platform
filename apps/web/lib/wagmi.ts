'use client'

import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { anvilLocal, stablenetLocal, stablenetTestnet, supportedChains } from './chains'

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const isValidProjectId =
  walletConnectProjectId &&
  walletConnectProjectId !== 'your_project_id_here' &&
  walletConnectProjectId.length > 10

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
 * - walletConnect(): WalletConnect v2 for mobile wallets
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
    ...(isValidProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'StableNet',
              description: 'StableNet - Regulatory-Compliant Stablecoin Platform',
              url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
              icons: ['https://stablenet.io/icon.png'],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    // Anvil (Local) - chainId 31337
    [anvilLocal.id]: createRpcTransport('http://127.0.0.1:8545'),
    // StableNet Local - chainId 8283
    [stablenetLocal.id]: createRpcTransport('http://127.0.0.1:8501'),
    // StableNet Testnet - chainId 82830
    [stablenetTestnet.id]: createRpcTransport('https://rpc.testnet.stablenet.dev'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
