'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
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
  const { address, fetchTransactions, autoFetch = true } = config
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!address || !fetchTransactions) {
      setTransactions([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchTransactions(address)
      setTransactions(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch transactions')
      setError(fetchError)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [address, fetchTransactions])

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
