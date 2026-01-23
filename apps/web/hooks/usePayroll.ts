'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PayrollEntry } from '@/types'

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
}

export function usePayroll(config: UsePayrollConfig = {}): UsePayrollReturn {
  const { fetchPayroll, autoFetch = true } = config
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!fetchPayroll) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchPayroll()
      setPayrollEntries(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch payroll')
      setError(fetchError)
      setPayrollEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchPayroll])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const summary = useMemo<PayrollSummary>(() => {
    const activeEntries = payrollEntries.filter(e => e.status === 'active')

    // Calculate total monthly (converting from token amount)
    const totalMonthly = activeEntries.reduce((sum, entry) => {
      const decimals = entry.token?.decimals ?? 6
      const amount = Number(entry.amount) / (10 ** decimals)

      // Convert to monthly equivalent
      switch (entry.frequency) {
        case 'weekly':
          return sum + (amount * 4.33) // ~4.33 weeks per month
        case 'biweekly':
          return sum + (amount * 2.17) // ~2.17 bi-weeks per month
        case 'monthly':
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

    return {
      totalMonthly,
      activeEmployees: activeEntries.length,
      nextPaymentDate,
      ytdTotal: 0, // Would need historical data
    }
  }, [payrollEntries])

  return {
    payrollEntries,
    summary,
    isLoading,
    error,
    refresh,
  }
}
