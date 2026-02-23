'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Expense } from '@/types'

const STORAGE_KEY = 'stablenet:expenses'

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
  addExpense: (expense: Expense) => void
  updateExpense: (id: string, updates: Partial<Expense>) => void
  removeExpense: (id: string) => void
}

function serializeExpenses(expenses: Expense[]): string {
  return JSON.stringify(
    expenses.map((e) => ({
      ...e,
      amount: e.amount.toString(),
      submittedAt: e.submittedAt.toISOString(),
      token: {
        ...e.token,
        balance: e.token.balance !== undefined ? e.token.balance.toString() : undefined,
      },
    }))
  )
}

function deserializeExpenses(json: string): Expense[] {
  const raw = JSON.parse(json) as Array<Record<string, unknown>>
  return raw.map((e) => ({
    ...(e as unknown as Expense),
    amount: BigInt(e.amount as string),
    submittedAt: new Date(e.submittedAt as string),
    token: {
      ...(e.token as Record<string, unknown>),
      balance:
        (e.token as Record<string, unknown>).balance != null
          ? BigInt((e.token as Record<string, unknown>).balance as string)
          : undefined,
    },
  })) as Expense[]
}

function loadFromStorage(): Expense[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return deserializeExpenses(stored)
  } catch {
    return []
  }
}

function saveToStorage(expenses: Expense[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, serializeExpenses(expenses))
  } catch {
    // Storage full or unavailable
  }
}

export function useExpenses(config: UseExpensesConfig = {}): UseExpensesReturn {
  const { fetchExpenses, filter, autoFetch = true } = config
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++fetchIdRef.current

    // Use external fetch if provided (DI override)
    if (fetchExpenses) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchExpenses()
        if (id !== fetchIdRef.current) return
        setAllExpenses(result)
      } catch (err) {
        if (id !== fetchIdRef.current) return
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch expenses')
        setError(fetchError)
        setAllExpenses([])
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // Default: load from localStorage
    const expenses = loadFromStorage()
    if (id !== fetchIdRef.current) return
    setAllExpenses(expenses)
    setIsLoading(false)
  }, [fetchExpenses])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const addExpense = useCallback((expense: Expense) => {
    setAllExpenses((prev) => {
      const next = [...prev, expense]
      saveToStorage(next)
      return next
    })
  }, [])

  const updateExpense = useCallback((id: string, updates: Partial<Expense>) => {
    setAllExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      saveToStorage(next)
      return next
    })
  }, [])

  const removeExpense = useCallback((id: string) => {
    setAllExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

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
    addExpense,
    updateExpense,
    removeExpense,
  }
}
