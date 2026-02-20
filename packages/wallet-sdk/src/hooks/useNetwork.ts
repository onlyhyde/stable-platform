/**
 * useNetwork - Hook for network information and management
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type NetworkRegistry, networkRegistry } from '../config'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { NetworkInfo } from '../types'

interface UseNetworkOptions {
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
  /** Custom network registry (optional) */
  registry?: NetworkRegistry
}

interface UseNetworkResult {
  /** Current network info */
  network: NetworkInfo | null
  /** Current chain ID */
  chainId: number | null
  /** Is current network a testnet */
  isTestnet: boolean
  /** All available networks */
  networks: NetworkInfo[]
  /** Supported chain IDs */
  supportedChainIds: number[]
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Check if a chain is supported */
  isSupported: (chainId: number) => boolean
  /** Switch to a different network */
  switchNetwork: (chainId: number) => Promise<void>
  /** Add a custom network */
  addNetwork: (network: NetworkInfo) => Promise<void>
}

/**
 * React hook for network information and management
 *
 * @example
 * ```tsx
 * const { network, switchNetwork, isTestnet } = useNetwork({ provider })
 *
 * return (
 *   <div>
 *     <p>Network: {network?.name} {isTestnet && '(Testnet)'}</p>
 *     <button onClick={() => switchNetwork(11155111)}>
 *       Switch to Sepolia
 *     </button>
 *   </div>
 * )
 * ```
 */
export function useNetwork(options: UseNetworkOptions): UseNetworkResult {
  const contextProvider = useOptionalProvider()
  const { provider: explicitProvider, registry = networkRegistry } = options
  const provider = explicitProvider ?? contextProvider

  const [chainId, setChainId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch current chain ID
  useEffect(() => {
    if (!provider) {
      setChainId(null)
      setIsLoading(false)
      return
    }

    let mounted = true

    const fetchChainId = async () => {
      try {
        setIsLoading(true)
        const hex = await provider.getChainId()
        if (!mounted) return
        setChainId(Number.parseInt(hex, 16))
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err : new Error('Failed to get chain ID'))
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchChainId()

    // Listen for chain changes
    const handleChainChanged = (chainIdHex: string) => {
      if (!mounted) return
      setChainId(Number.parseInt(chainIdHex, 16))
    }

    const unsubChainChanged = provider.on('chainChanged', handleChainChanged)

    return () => {
      mounted = false
      unsubChainChanged()
    }
  }, [provider])

  // Get current network info
  const network = useMemo(() => {
    if (!chainId) return null
    return registry.getNetworkInfo(chainId) ?? null
  }, [chainId, registry])

  // Check if testnet
  const isTestnet = useMemo(() => {
    if (!chainId) return false
    return registry.isTestnet(chainId)
  }, [chainId, registry])

  // Get all networks
  const networks = useMemo(() => {
    return registry.getAllNetworkInfos()
  }, [registry])

  // Get supported chain IDs
  const supportedChainIds = useMemo(() => {
    return registry.getSupportedChainIds()
  }, [registry])

  // Check if chain is supported
  const isSupported = useCallback((id: number) => registry.hasNetwork(id), [registry])

  // Switch network
  const switchNetwork = useCallback(
    async (targetChainId: number) => {
      if (!provider) {
        throw new Error('Provider not available')
      }

      setError(null)

      try {
        await provider.switchChain(targetChainId)
      } catch (err) {
        const switchError = err instanceof Error ? err : new Error('Failed to switch network')
        setError(switchError)
        throw switchError
      }
    },
    [provider]
  )

  // Add network
  const addNetwork = useCallback(
    async (networkInfo: NetworkInfo) => {
      await registry.addNetwork(networkInfo)
    },
    [registry]
  )

  return {
    network,
    chainId,
    isTestnet,
    networks,
    supportedChainIds,
    isLoading,
    error,
    isSupported,
    switchNetwork,
    addNetwork,
  }
}
