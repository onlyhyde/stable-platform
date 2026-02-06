'use client'

import type { Expense } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ExpenseFilter {
  status?: 'pending' | 'approved' | 'rejected' | 'paid'
  category?: string
  submitter?: string
}

interface UseExpensesConfig {
  fetchExpenses?: () => Promise<Expense[]>
  filter?: ExpenseFilter
  autoFetch?: boolean
}

interface UseExpensesReturn {
  expenses: Expense[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useExpenses(config: UseExpensesConfig = {}): UseExpensesReturn {
  const { fetchExpenses, filter, autoFetch = true } = config
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!fetchExpenses) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchExpenses()
      setAllExpenses(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch expenses')
      setError(fetchError)
      setAllExpenses([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchExpenses])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const expenses = useMemo(() => {
    if (!filter) return allExpenses

    return allExpenses.filter((expense) => {
      if (filter.status && expense.status !== filter.status) return false
      if (filter.category && expense.category !== filter.category) return false
      if (filter.submitter && expense.submitter !== filter.submitter) return false
      return true
    })
  }, [allExpenses, filter])

  return {
    expenses,
    isLoading,
    error,
    refresh,
  }
}
