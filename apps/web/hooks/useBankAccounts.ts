'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BankAccountType, BankTransfer, LinkedBankAccount } from '@/types/bank'

// ============================================================================
// Config
// ============================================================================

const BANK_API_BASE = 'http://localhost:3001/api/v1'
const STORAGE_KEY = 'stablenet:linked-bank-accounts'

// ============================================================================
// Types
// ============================================================================

export interface UseBankAccountsReturn {
  accounts: LinkedBankAccount[]
  isLoading: boolean
  isTransferring: boolean
  error: string | null
  linkAccount: (
    accountNo: string,
    type: BankAccountType,
    ownerName: string
  ) => Promise<LinkedBankAccount | null>
  unlinkAccount: (accountNo: string) => Promise<boolean>
  syncAccount: (accountNo: string) => Promise<LinkedBankAccount | null>
  transfer: (
    from: string,
    to: string,
    amount: number,
    description?: string
  ) => Promise<BankTransfer | null>
  refresh: () => Promise<void>
  clearError: () => void
}

// ============================================================================
// localStorage helpers
// ============================================================================

function loadAccounts(): LinkedBankAccount[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: LinkedBankAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Helper
// ============================================================================

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BANK_API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `API error: ${res.status}`)
  }
  return res.json()
}

// ============================================================================
// Hook
// ============================================================================

export function useBankAccounts(): UseBankAccountsReturn {
  const [accounts, setAccounts] = useState<LinkedBankAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  // Load linked accounts from localStorage on mount
  useEffect(() => {
    setAccounts(loadAccounts())
  }, [])

  const linkAccount = useCallback(
    async (
      accountNo: string,
      type: BankAccountType,
      ownerName: string
    ): Promise<LinkedBankAccount | null> => {
      const id = ++fetchIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        // Verify account exists via bank simulator
        const bankData = await apiCall<{ accountNo: string; balance?: number }>(
          `/accounts/${accountNo}`
        )

        if (id !== fetchIdRef.current) return null

        const account: LinkedBankAccount = {
          id: `bank-${Date.now()}`,
          accountNo: bankData.accountNo || accountNo,
          accountType: type,
          ownerName,
          linkedAt: Date.now(),
          lastSynced: Date.now(),
          balance: bankData.balance,
        }

        setAccounts((prev) => {
          // Don't add duplicates
          if (prev.some((a) => a.accountNo === accountNo)) {
            return prev
          }
          const next = [...prev, account]
          saveAccounts(next)
          return next
        })

        return account
      } catch (err) {
        if (id !== fetchIdRef.current) return null
        const msg = err instanceof Error ? err.message : 'Failed to link account'
        setError(msg)
        return null
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    []
  )

  const unlinkAccount = useCallback(async (accountNo: string): Promise<boolean> => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.accountNo !== accountNo)
      saveAccounts(next)
      return next
    })
    return true
  }, [])

  const syncAccount = useCallback(
    async (accountNo: string): Promise<LinkedBankAccount | null> => {
      setError(null)
      try {
        const bankData = await apiCall<{ balance?: number }>(`/accounts/${accountNo}`)

        let updated: LinkedBankAccount | null = null
        setAccounts((prev) => {
          const next = prev.map((a) => {
            if (a.accountNo === accountNo) {
              updated = { ...a, balance: bankData.balance, lastSynced: Date.now() }
              return updated
            }
            return a
          })
          saveAccounts(next)
          return next
        })

        return updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to sync account'
        setError(msg)
        return null
      }
    },
    []
  )

  const transfer = useCallback(
    async (
      from: string,
      to: string,
      amount: number,
      description?: string
    ): Promise<BankTransfer | null> => {
      setIsTransferring(true)
      setError(null)
      try {
        const result = await apiCall<BankTransfer>('/transfers', {
          method: 'POST',
          body: JSON.stringify({
            fromAccount: from,
            toAccount: to,
            amount,
            currency: 'KRW',
            description,
          }),
        })
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transfer failed'
        setError(msg)
        return null
      } finally {
        setIsTransferring(false)
      }
    },
    []
  )

  const refresh = useCallback(async () => {
    const id = ++fetchIdRef.current
    setIsLoading(true)
    try {
      const current = loadAccounts()
      // Sync balances for all linked accounts
      const updated = await Promise.all(
        current.map(async (a) => {
          try {
            const bankData = await apiCall<{ balance?: number }>(`/accounts/${a.accountNo}`)
            return { ...a, balance: bankData.balance, lastSynced: Date.now() }
          } catch {
            return a
          }
        })
      )
      if (id !== fetchIdRef.current) return
      saveAccounts(updated)
      setAccounts(updated)
    } catch {
      // Keep existing data
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  return {
    accounts,
    isLoading,
    isTransferring,
    error,
    linkAccount,
    unlinkAccount,
    syncAccount,
    transfer,
    refresh,
    clearError: () => setError(null),
  }
}
