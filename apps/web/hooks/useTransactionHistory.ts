'use client'

import { createIndexerClient } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useStableNetContext } from '@/providers/StableNetProvider'
import type { Transaction } from '@/types'

interface UseTransactionHistoryConfig {
  address?: Address
  fetchTransactions?: (address: Address) => Promise<Transaction[]>
  autoFetch?: boolean
}

interface UseTransactionHistoryReturn {
  transactions: Transaction[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTransactionHistory(
  config: UseTransactionHistoryConfig = {}
): UseTransactionHistoryReturn {
  const { address, fetchTransactions: externalFetch, autoFetch = true } = config
  const { indexerUrl, chainId } = useStableNetContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setTransactions([])
      return
    }

    // Use external fetch if provided (DI override)
    if (externalFetch) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await externalFetch(address)
        setTransactions(result)
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch transactions')
        setError(fetchError)
        setTransactions([])
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Default: use IndexerClient
    setIsLoading(true)
    setError(null)
    try {
      const client = createIndexerClient(indexerUrl)
      const result = await client.getTransactionsByAddress(address, 50)
      const mapped: Transaction[] = result.nodes.map((tx) => ({
        hash: tx.hash as Hex,
        from: tx.from as Address,
        to: tx.to as Address,
        value: BigInt(tx.value),
        chainId,
        status: tx.status === 1 ? ('confirmed' as const) : ('failed' as const),
        timestamp: tx.timestamp,
      }))
      setTransactions(mapped)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch transactions')
      setError(fetchError)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [address, externalFetch, indexerUrl, chainId])

  useEffect(() => {
    if (autoFetch && address) {
      refresh()
    }
  }, [autoFetch, address, refresh])

  return {
    transactions,
    isLoading,
    error,
    refresh,
  }
}
