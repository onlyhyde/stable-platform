'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PayrollEntry } from '@/types'

const STORAGE_KEY = 'stablenet:payroll'

interface UsePayrollConfig {
  fetchPayroll?: () => Promise<PayrollEntry[]>
  autoFetch?: boolean
}

interface PayrollSummary {
  totalMonthly: number
  activeEmployees: number
  nextPaymentDate: Date | null
  ytdTotal: number
}

interface UsePayrollReturn {
  payrollEntries: PayrollEntry[]
  summary: PayrollSummary
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  addEntry: (entry: PayrollEntry) => void
  updateEntry: (id: string, updates: Partial<PayrollEntry>) => void
  removeEntry: (id: string) => void
}

function serializeEntries(entries: PayrollEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      ...e,
      amount: e.amount.toString(),
      nextPaymentDate: e.nextPaymentDate.toISOString(),
      token: {
        ...e.token,
        balance: e.token.balance !== undefined ? e.token.balance.toString() : undefined,
      },
    }))
  )
}

function deserializeEntries(json: string): PayrollEntry[] {
  const raw = JSON.parse(json) as Array<Record<string, unknown>>
  return raw.map((e) => ({
    ...(e as unknown as PayrollEntry),
    amount: BigInt(e.amount as string),
    nextPaymentDate: new Date(e.nextPaymentDate as string),
    token: {
      ...(e.token as Record<string, unknown>),
      balance:
        (e.token as Record<string, unknown>).balance != null
          ? BigInt((e.token as Record<string, unknown>).balance as string)
          : undefined,
    },
  })) as PayrollEntry[]
}

function loadFromStorage(): PayrollEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return deserializeEntries(stored)
  } catch {
    return []
  }
}

function saveToStorage(entries: PayrollEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, serializeEntries(entries))
  } catch {
    // Storage full or unavailable
  }
}

export function usePayroll(config: UsePayrollConfig = {}): UsePayrollReturn {
  const { fetchPayroll, autoFetch = true } = config
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++fetchIdRef.current

    // Use external fetch if provided (DI override)
    if (fetchPayroll) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchPayroll()
        if (id !== fetchIdRef.current) return
        setPayrollEntries(result)
      } catch (err) {
        if (id !== fetchIdRef.current) return
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch payroll')
        setError(fetchError)
        setPayrollEntries([])
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // Default: load from localStorage
    const entries = loadFromStorage()
    if (id !== fetchIdRef.current) return
    setPayrollEntries(entries)
    setIsLoading(false)
  }, [fetchPayroll])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const addEntry = useCallback((entry: PayrollEntry) => {
    setPayrollEntries((prev) => {
      const next = [...prev, entry]
      saveToStorage(next)
      return next
    })
  }, [])

  const updateEntry = useCallback((id: string, updates: Partial<PayrollEntry>) => {
    setPayrollEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      saveToStorage(next)
      return next
    })
  }, [])

  const removeEntry = useCallback((id: string) => {
    setPayrollEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  const summary = useMemo<PayrollSummary>(() => {
    const activeEntries = payrollEntries.filter((e) => e.status === 'active')

    // Calculate total monthly (converting from token amount)
    const totalMonthly = activeEntries.reduce((sum, entry) => {
      const decimals = entry.token?.decimals ?? 6
      const amount = Number(entry.amount) / 10 ** decimals

      // Convert to monthly equivalent
      switch (entry.frequency) {
        case 'weekly':
          return sum + amount * 4.33 // ~4.33 weeks per month
        case 'biweekly':
          return sum + amount * 2.17 // ~2.17 bi-weeks per month
        default:
          return sum + amount
      }
    }, 0)

    // Find next payment date
    const nextPaymentDate = activeEntries.reduce<Date | null>((nearest, entry) => {
      if (!entry.nextPaymentDate) return nearest
      if (!nearest) return entry.nextPaymentDate
      return entry.nextPaymentDate < nearest ? entry.nextPaymentDate : nearest
    }, null)

    // Estimate YTD from monthly total and months elapsed this year
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const msElapsed = now.getTime() - yearStart.getTime()
    const monthsElapsed = msElapsed / (30.44 * 24 * 60 * 60 * 1000)
    const ytdTotal = totalMonthly * monthsElapsed

    return {
      totalMonthly,
      activeEmployees: activeEntries.length,
      nextPaymentDate,
      ytdTotal,
    }
  }, [payrollEntries])

  return {
    payrollEntries,
    summary,
    isLoading,
    error,
    refresh,
    addEntry,
    updateEntry,
    removeEntry,
  }
}
