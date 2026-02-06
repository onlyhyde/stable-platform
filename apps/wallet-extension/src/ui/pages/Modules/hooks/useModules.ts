import type { InstalledModule } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSelectedNetwork } from '../../../hooks'

interface UseModulesReturn {
  installedModules: InstalledModule[] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching installed modules for a Smart Account
 */
export function useModules(accountAddress?: Address): UseModulesReturn {
  const [installedModules, setInstalledModules] = useState<InstalledModule[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  const fetchModules = useCallback(async () => {
    if (!accountAddress || !currentNetwork) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `get-modules-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_getInstalledModules',
          params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || 'Failed to fetch modules')
      }

      setInstalledModules(response?.payload?.result?.modules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch modules'))
    } finally {
      setIsLoading(false)
    }
  }, [accountAddress, currentNetwork])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  return {
    installedModules,
    isLoading,
    error,
    refetch: fetchModules,
  }
}
