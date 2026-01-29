'use client'

import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { supportedChains, stablenetDevnet } from './chains'

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const isValidProjectId = walletConnectProjectId &&
  walletConnectProjectId !== 'your_project_id_here' &&
  walletConnectProjectId.length > 10

/**
 * Wagmi configuration for StableNet
 * Connectors:
 * - injected(): MetaMask, Rabby, and other browser wallets
 * - walletConnect(): WalletConnect v2 for mobile wallets
 *
 * EIP-6963 Multi Injected Provider Discovery is enabled for detecting
 * multiple wallet extensions (StableNet Wallet, MetaMask, Rabby, etc.)
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
    [stablenetDevnet.id]: http('http://localhost:8545'),
    [11155111]: http('https://testnet.stablenet.io/rpc'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
