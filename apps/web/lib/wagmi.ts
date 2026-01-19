'use client'

import { createConfig, http } from 'wagmi'
import { injected, metaMask } from 'wagmi/connectors'
import { supportedChains, stablenetDevnet } from './chains'

/**
 * Wagmi configuration for StableNet
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
    metaMask(),
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
