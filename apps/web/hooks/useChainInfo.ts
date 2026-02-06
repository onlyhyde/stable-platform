'use client'

import { useMemo } from 'react'
import type { Chain } from 'viem'
import { useChainId, useChains } from 'wagmi'

export interface ChainInfo {
  id: number
  name: string
  symbol: string
  isTestnet: boolean
  explorerUrl?: string
  iconColor: string
}

// Chain icon colors for visual distinction
const CHAIN_COLORS: Record<number, string> = {
  1: 'rgb(var(--info))', // Ethereum Mainnet - blue
  31337: 'rgb(var(--primary))', // Anvil - primary (indigo)
  8283: 'rgb(var(--success))', // StableNet Local - green
  82830: 'rgb(var(--success))', // StableNet Testnet - green
  11155111: 'rgb(var(--warning))', // Sepolia - warning
  137: 'rgb(var(--accent))', // Polygon - purple
  42161: 'rgb(var(--info))', // Arbitrum - blue
  10: 'rgb(var(--error))', // Optimism - red
}

/**
 * Hook to get information about the currently connected chain
 * Automatically updates when chain changes via wallet events
 */
export function useChainInfo(): ChainInfo | null {
  const chainId = useChainId()
  const chains = useChains()

  const chainInfo = useMemo(() => {
    if (!chainId) return null

    // Find chain in configured chains
    const chain = chains.find((c: Chain) => c.id === chainId)

    if (!chain) {
      // Return basic info for unknown chains
      return {
        id: chainId,
        name: `Chain ${chainId}`,
        symbol: 'ETH',
        isTestnet: false,
        iconColor: 'rgb(var(--muted-foreground))',
      }
    }

    return {
      id: chain.id,
      name: chain.name,
      symbol: chain.nativeCurrency?.symbol ?? 'ETH',
      isTestnet: chain.testnet ?? false,
      explorerUrl: chain.blockExplorers?.default?.url,
      iconColor: CHAIN_COLORS[chain.id] ?? 'rgb(var(--muted-foreground))',
    }
  }, [chainId, chains])

  return chainInfo
}
