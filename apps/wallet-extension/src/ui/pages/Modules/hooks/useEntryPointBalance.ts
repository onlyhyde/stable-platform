import { useCallback, useEffect, useState } from 'react'
import { useSelectedNetwork } from '../../../hooks'

interface UseEntryPointBalanceReturn {
  deposit: bigint
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching the EntryPoint deposit balance for an account
 */
export function useEntryPointBalance(account?: string): UseEntryPointBalanceReturn {
  const [deposit, setDeposit] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  const fetchBalance = useCallback(async () => {
    if (!account || !currentNetwork) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `ep-balance-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_getEntryPointBalance',
          params: [account],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || 'Failed to fetch EntryPoint balance')
      }

      const result = response?.payload?.result
      setDeposit(result?.deposit ? BigInt(result.deposit) : 0n)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch EntryPoint balance'))
    } finally {
      setIsLoading(false)
    }
  }, [account, currentNetwork])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    deposit,
    isLoading,
    error,
    refetch: fetchBalance,
  }
}
