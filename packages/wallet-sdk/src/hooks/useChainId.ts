/**
 * useChainId - Hook for tracking the current chain ID
 */

import { useEffect, useState } from 'react'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'

interface UseChainIdOptions {
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
}

interface UseChainIdResult {
  /** Current chain ID (decimal) */
  chainId: number | null
  /** Current chain ID (hex) */
  chainIdHex: string | null
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
}

/**
 * React hook for tracking the current chain ID
 *
 * @example
 * ```tsx
 * const { chainId, chainIdHex } = useChainId({ provider })
 *
 * return <div>Chain ID: {chainId} ({chainIdHex})</div>
 * ```
 */
export function useChainId(options: UseChainIdOptions): UseChainIdResult {
  const contextProvider = useOptionalProvider()
  const provider = options.provider ?? contextProvider

  const [chainId, setChainId] = useState<number | null>(null)
  const [chainIdHex, setChainIdHex] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!provider) {
      setChainId(null)
      setChainIdHex(null)
      setIsLoading(false)
      return
    }

    let mounted = true

    const fetchChainId = async () => {
      try {
        setIsLoading(true)
        const hex = await provider.getChainId()
        if (!mounted) return

        setChainIdHex(hex)
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
    const handleChainChanged = (newChainIdHex: string) => {
      if (!mounted) return
      setChainIdHex(newChainIdHex)
      setChainId(Number.parseInt(newChainIdHex, 16))
    }

    const unsubChainChanged = provider.on('chainChanged', handleChainChanged)

    return () => {
      mounted = false
      unsubChainChanged()
    }
  }, [provider])

  return {
    chainId,
    chainIdHex,
    isLoading,
    error,
  }
}
