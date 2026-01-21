'use client'

import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { supportedChains, stablenetDevnet } from './chains'

/**
 * Wagmi configuration for StableNet
 * Using injected() connector which works with MetaMask, Rabby, and other browser wallets
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
  ],
  transports: {
    [stablenetDevnet.id]: http(),
    [11155111]: http('https://testnet.stablenet.io/rpc'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
