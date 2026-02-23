'use client'

import { createIndexerClient } from '@stablenet/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { useWallet } from '@/hooks/useWallet'
import { useStableNetContext } from '@/providers/StableNetProvider'
import type { Token } from '@/types'

interface UseTokensConfig {
  fetchTokens?: () => Promise<Token[]>
  autoFetch?: boolean
}

interface UseTokensReturn {
  tokens: Token[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTokens(config: UseTokensConfig = {}): UseTokensReturn {
  const { fetchTokens: externalFetch, autoFetch = true } = config
  const { indexerUrl } = useStableNetContext()
  const { address } = useWallet()
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    // Use external fetch if provided (DI override)
    if (externalFetch) {
      const id = ++fetchIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        const result = await externalFetch()
        if (id !== fetchIdRef.current) return
        setTokens(result)
      } catch (err) {
        if (id !== fetchIdRef.current) return
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
        setError(fetchError)
        setTokens([])
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // No address — skip fetch
    if (!address) {
      setIsLoading(false)
      return
    }

    // Default: use IndexerClient
    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const client = createIndexerClient(indexerUrl)
      const balances = await client.getTokenBalances(address, 'ERC20')
      if (id !== fetchIdRef.current) return
      const mapped: Token[] = balances.map((tb) => ({
        address: tb.address as Address,
        name: tb.name ?? 'Unknown',
        symbol: tb.symbol ?? '???',
        decimals: tb.decimals ?? 18,
        balance: BigInt(tb.balance),
      }))
      setTokens(mapped)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
      setError(fetchError)
      setTokens([])
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [externalFetch, address, indexerUrl])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    tokens,
    isLoading,
    error,
    refresh,
  }
}
