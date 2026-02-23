'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Chain } from 'viem'
import { useAccount, useChainId, useChains, useSwitchChain } from 'wagmi'

/**
 * Network information from wallet
 */
export interface WalletNetwork {
  chainId: string // hex
  chainIdDecimal: number
  name: string
  rpcUrl: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
  explorerUrl?: string
  isTestnet: boolean
  isCustom: boolean
  isSelected: boolean
}

interface UseWalletNetworksReturn {
  /** List of networks supported by the wallet */
  networks: WalletNetwork[]
  /** Currently selected network */
  selectedNetwork: WalletNetwork | null
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Whether wallet supports wallet_getNetworks */
  supportsWalletNetworks: boolean
  /** Refresh networks list */
  refresh: () => Promise<void>
  /** Switch to a different network */
  switchNetwork: (chainId: number) => Promise<boolean>
}

/**
 * Convert wagmi Chain to WalletNetwork format (fallback only)
 */
function chainToWalletNetwork(chain: Chain, isSelected: boolean): WalletNetwork {
  return {
    chainId: `0x${chain.id.toString(16)}`,
    chainIdDecimal: chain.id,
    name: chain.name,
    rpcUrl: chain.rpcUrls.default.http[0] ?? '',
    currency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
    },
    explorerUrl: chain.blockExplorers?.default?.url,
    isTestnet: chain.testnet ?? false,
    isCustom: false,
    isSelected,
  }
}

/**
 * Hook to get networks from the connected wallet
 *
 * Data Source Priority:
 * 1. wallet_getNetworks RPC (StableNet Wallet) - Primary source
 * 2. wagmi config chains (Fallback for MetaMask, etc.)
 *
 * The wallet is the source of truth for available networks.
 * wagmi config is only used when the wallet doesn't support wallet_getNetworks.
 */
export function useWalletNetworks(): UseWalletNetworksReturn {
  const { isConnected } = useAccount()
  const currentChainId = useChainId()
  const configuredChains = useChains()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()

  const [walletNetworks, setWalletNetworks] = useState<WalletNetwork[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supportsWalletNetworks, setSupportsWalletNetworks] = useState<boolean | null>(null)
  const fetchIdRef = useRef(0)

  // Fetch networks from wallet via wallet_getNetworks RPC
  const fetchWalletNetworks = useCallback(async () => {
    if (!isConnected || typeof window === 'undefined') {
      setWalletNetworks([])
      setSupportsWalletNetworks(null)
      return
    }

    const provider = (
      window as unknown as {
        ethereum?: { request?: (...args: unknown[]) => Promise<unknown> }
      }
    ).ethereum

    if (!provider?.request) {
      setSupportsWalletNetworks(false)
      return
    }

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      // Call wallet_getNetworks RPC - StableNet Wallet specific
      const result = await provider.request({
        method: 'wallet_getNetworks',
      })

      if (id !== fetchIdRef.current) return

      if (Array.isArray(result) && result.length > 0) {
        // Wallet supports wallet_getNetworks - use wallet data as primary source
        setWalletNetworks(result as WalletNetwork[])
        setSupportsWalletNetworks(true)
      } else {
        // Empty result - wallet may not have networks configured
        setWalletNetworks([])
        setSupportsWalletNetworks(true)
      }
    } catch {
      if (id !== fetchIdRef.current) return
      // wallet_getNetworks not supported (e.g., MetaMask)
      // Fall back to wagmi config
      setWalletNetworks([])
      setSupportsWalletNetworks(false)
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [isConnected])

  // Fetch wallet networks on mount and when connection changes
  useEffect(() => {
    fetchWalletNetworks()
  }, [fetchWalletNetworks])

  // Listen for chain changes from wallet
  useEffect(() => {
    if (typeof window === 'undefined') return

    const provider = (
      window as unknown as {
        ethereum?: {
          on?: (...args: unknown[]) => void
          removeListener?: (...args: unknown[]) => void
        }
      }
    ).ethereum

    if (!provider?.on) return

    const handleChainChanged = () => {
      // Re-fetch networks to update isSelected state
      fetchWalletNetworks()
    }

    provider.on('chainChanged', handleChainChanged)

    return () => {
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [fetchWalletNetworks])

  // Build fallback networks from wagmi config (only used when wallet doesn't support wallet_getNetworks)
  const fallbackNetworks = useMemo((): WalletNetwork[] => {
    return configuredChains.map((chain) => chainToWalletNetwork(chain, chain.id === currentChainId))
  }, [configuredChains, currentChainId])

  // Determine which networks to use:
  // 1. If wallet supports wallet_getNetworks: use wallet data (with updated selection state)
  // 2. If wallet doesn't support: use wagmi config as fallback
  const networks = useMemo(() => {
    if (supportsWalletNetworks && walletNetworks.length > 0) {
      // Use wallet networks, but update isSelected based on current chain
      return walletNetworks.map((n) => ({
        ...n,
        isSelected: n.chainIdDecimal === currentChainId,
      }))
    }
    // Fallback to wagmi config
    return fallbackNetworks
  }, [walletNetworks, fallbackNetworks, currentChainId, supportsWalletNetworks])

  // Switch network - use wagmi's switchChain which handles both EIP-3326 and EIP-3085
  const switchNetwork = useCallback(
    async (chainId: number): Promise<boolean> => {
      try {
        await switchChainAsync({ chainId })
        return true
      } catch (err) {
        console.error('[useWalletNetworks] Failed to switch network:', err)
        setError('Failed to switch network')
        return false
      }
    },
    [switchChainAsync]
  )

  // Get selected network from the networks list
  const selectedNetwork = useMemo(() => {
    return networks.find((n) => n.isSelected) ?? null
  }, [networks])

  return {
    networks,
    selectedNetwork,
    isLoading: isLoading || isSwitching,
    error,
    supportsWalletNetworks: supportsWalletNetworks ?? false,
    refresh: fetchWalletNetworks,
    switchNetwork,
  }
}
