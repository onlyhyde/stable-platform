'use client'

import { createIndexerClient } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
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

  const refresh = useCallback(async () => {
    // Use external fetch if provided (DI override)
    if (externalFetch) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await externalFetch()
        setTokens(result)
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
        setError(fetchError)
        setTokens([])
      } finally {
        setIsLoading(false)
      }
      return
    }

    // No address — skip fetch
    if (!address) {
      setIsLoading(false)
      return
    }

    // Default: use IndexerClient
    setIsLoading(true)
    setError(null)
    try {
      const client = createIndexerClient(indexerUrl)
      const balances = await client.getTokenBalances(address, 'ERC20')
      const mapped: Token[] = balances.map((tb) => ({
        address: tb.address as Address,
        name: tb.name ?? 'Unknown',
        symbol: tb.symbol ?? '???',
        decimals: tb.decimals ?? 18,
        balance: BigInt(tb.balance),
      }))
      setTokens(mapped)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
      setError(fetchError)
      setTokens([])
    } finally {
      setIsLoading(false)
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
