'use client'

import { http, createConfig, custom, fallback } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { anvilLocal, stablenetLocal, stablenetTestnet, supportedChains } from './chains'

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const isValidProjectId =
  walletConnectProjectId &&
  walletConnectProjectId !== 'your_project_id_here' &&
  walletConnectProjectId.length > 10

/**
 * Create a transport that uses wallet provider first, then falls back to HTTP RPC
 * This allows wagmi to use the wallet's RPC endpoint dynamically
 */
function createWalletTransport(fallbackUrl: string) {
  // Check if window.ethereum is available (client-side only)
  if (typeof window !== 'undefined' && window.ethereum) {
    return fallback([custom(window.ethereum), http(fallbackUrl)])
  }
  return http(fallbackUrl)
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
 * Transports use wallet provider (window.ethereum) first, with HTTP fallback
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
    [anvilLocal.id]: createWalletTransport('http://127.0.0.1:8545'),
    // StableNet Local - chainId 8283
    [stablenetLocal.id]: createWalletTransport('http://127.0.0.1:8501'),
    // StableNet Testnet - chainId 82830
    [stablenetTestnet.id]: createWalletTransport('https://rpc.testnet.stablenet.dev'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
