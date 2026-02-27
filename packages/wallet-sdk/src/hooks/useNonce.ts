/**
 * React hook for EntryPoint nonce management.
 *
 * Queries the current nonce for a smart account with optional auto-refresh.
 */

import { useCallback, useEffect, useState } from 'react'
import { getNonce, parseNonce } from '../nonce'
import type { Address } from 'viem'
import type { PublicClient } from 'viem'

export interface UseNonceConfig {
  publicClient: PublicClient | null
  sender: Address | null
  nonceKey?: bigint
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface UseNonceResult {
  nonce: bigint | null
  key: bigint | null
  sequence: bigint | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * React hook for querying the current nonce from EntryPoint.
 *
 * @example
 * ```tsx
 * const { nonce, sequence, refetch } = useNonce({
 *   publicClient,
 *   sender: accountAddress,
 * })
 * ```
 */
export function useNonce(config: UseNonceConfig): UseNonceResult {
  const { publicClient, sender, nonceKey = 0n, autoRefresh = false, refreshInterval = 10000 } = config
  const [nonce, setNonce] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchNonce = useCallback(async () => {
    if (!publicClient || !sender) {
      setNonce(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await getNonce(publicClient, sender, nonceKey)
      setNonce(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch nonce'))
      setNonce(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, sender, nonceKey])

  useEffect(() => {
    fetchNonce()
  }, [fetchNonce])

  useEffect(() => {
    if (!autoRefresh || !publicClient || !sender) return

    const interval = setInterval(fetchNonce, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchNonce, publicClient, sender])

  const parsed = nonce !== null ? parseNonce(nonce) : null

  return {
    nonce,
    key: parsed?.key ?? null,
    sequence: parsed?.sequence ?? null,
    isLoading,
    error,
    refetch: fetchNonce,
  }
}
