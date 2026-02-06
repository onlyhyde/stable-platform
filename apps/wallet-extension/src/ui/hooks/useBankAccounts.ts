import { useCallback, useEffect, useState } from 'react'
import type { BankTransfer, LinkedBankAccount } from '../../types'

interface UseBankAccountsResult {
  accounts: LinkedBankAccount[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  linkAccount: (
    accountNo: string,
    accountType: 'checking' | 'savings',
    ownerName: string
  ) => Promise<LinkedBankAccount | null>
  unlinkAccount: (accountNo: string) => Promise<boolean>
  syncAccount: (accountNo: string) => Promise<LinkedBankAccount | null>
  transfer: (
    fromAccount: string,
    toAccount: string,
    amount: number,
    description?: string
  ) => Promise<BankTransfer | null>
}

export function useBankAccounts(): UseBankAccountsResult {
  const [accounts, setAccounts] = useState<LinkedBankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINKED_BANK_ACCOUNTS',
      })
      if (response?.accounts) {
        setAccounts(response.accounts)
      } else if (response?.error) {
        setError(response.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const linkAccount = useCallback(
    async (
      accountNo: string,
      accountType: 'checking' | 'savings',
      ownerName: string
    ): Promise<LinkedBankAccount | null> => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'LINK_BANK_ACCOUNT',
          payload: { accountNo, accountType, ownerName },
        })
        if (response?.account) {
          setAccounts((prev) => [...prev, response.account])
          return response.account
        }
        if (response?.error) {
          setError(response.error)
        }
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link account')
        return null
      }
    },
    []
  )

  const unlinkAccount = useCallback(async (accountNo: string): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UNLINK_BANK_ACCOUNT',
        payload: { accountNo },
      })
      if (response?.success) {
        setAccounts((prev) => prev.filter((a) => a.accountNo !== accountNo))
        return true
      }
      if (response?.error) {
        setError(response.error)
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink account')
      return false
    }
  }, [])

  const syncAccount = useCallback(async (accountNo: string): Promise<LinkedBankAccount | null> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_BANK_ACCOUNT',
        payload: { accountNo },
      })
      if (response?.account) {
        setAccounts((prev) => prev.map((a) => (a.accountNo === accountNo ? response.account : a)))
        return response.account
      }
      if (response?.error) {
        setError(response.error)
      }
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync account')
      return null
    }
  }, [])

  const transfer = useCallback(
    async (
      fromAccount: string,
      toAccount: string,
      amount: number,
      description?: string
    ): Promise<BankTransfer | null> => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'BANK_TRANSFER',
          payload: { fromAccount, toAccount, amount, description },
        })
        if (response?.transfer) {
          // Refresh accounts to get updated balances
          await refresh()
          return response.transfer
        }
        if (response?.error) {
          setError(response.error)
        }
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transfer failed')
        return null
      }
    },
    [refresh]
  )

  return {
    accounts,
    isLoading,
    error,
    refresh,
    linkAccount,
    unlinkAccount,
    syncAccount,
    transfer,
  }
}
