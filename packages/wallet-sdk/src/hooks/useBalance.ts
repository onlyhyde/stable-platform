import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'

interface UseBalanceOptions {
  /** Address to fetch balance for (defaults to connected account) */
  address?: Address
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
  /** Connected account (used when address not specified) */
  account?: Address | null
  /** Auto-refresh on account/chain change */
  watch?: boolean
}

interface UseBalanceResult {
  /** Balance in wei */
  balance: bigint | null
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch balance */
  refetch: () => Promise<void>
}

/**
 * React hook for fetching account balance
 */
export function useBalance(options: UseBalanceOptions): UseBalanceResult {
  const contextProvider = useOptionalProvider()
  const { address, provider: explicitProvider, account, watch = true } = options
  const provider = explicitProvider ?? contextProvider
  const targetAddress = address ?? account

  const [balance, setBalance] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!provider || !targetAddress) {
      setBalance(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await provider.getBalance(targetAddress)
      setBalance(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'))
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [provider, targetAddress])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Watch for changes
  useEffect(() => {
    if (!watch || !provider) return

    const unsubAccount = provider.on('accountsChanged', () => {
      fetchBalance()
    })

    const unsubChain = provider.on('chainChanged', () => {
      fetchBalance()
    })

    return () => {
      unsubAccount()
      unsubChain()
    }
  }, [watch, provider, fetchBalance])

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  }
}
