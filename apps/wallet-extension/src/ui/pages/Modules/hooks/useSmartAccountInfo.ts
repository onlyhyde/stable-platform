import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSelectedNetwork } from '../../../hooks'

export interface SmartAccountInfo {
  accountType: 'eoa' | 'delegated' | 'smart'
  isDeployed: boolean
  rootValidator: Address | null
  accountId: string | null
  delegationTarget: Address | null
  isDelegated: boolean
}

interface UseSmartAccountInfoReturn {
  info: SmartAccountInfo | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching Smart Account information (root validator, delegation, module counts)
 */
export function useSmartAccountInfo(accountAddress?: Address): UseSmartAccountInfoReturn {
  const [info, setInfo] = useState<SmartAccountInfo | null>(null)
  const [isLoading, setIsLoading] = useState(!!accountAddress)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  const fetchInfo = useCallback(async () => {
    if (!accountAddress || !currentNetwork) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `sa-info-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_getSmartAccountInfo',
          params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || 'Failed to fetch smart account info')
      }

      setInfo(response?.payload?.result ?? null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch smart account info'))
    } finally {
      setIsLoading(false)
    }
  }, [accountAddress, currentNetwork])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  return {
    info,
    isLoading,
    error,
    refetch: fetchInfo,
  }
}
