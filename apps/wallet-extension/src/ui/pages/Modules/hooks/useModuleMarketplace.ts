import { useCallback, useEffect, useState } from 'react'
import { useSelectedNetwork } from '../../../hooks'

interface RegistryModule {
  metadata: {
    address: string
    type: bigint
    name: string
    description: string
    version: string
    isVerified?: boolean
    logoUrl?: string
    tags?: string[]
  }
  configSchema: unknown
  addresses: Record<number, string>
  supportedChains: number[]
}

interface UseModuleMarketplaceReturn {
  registryModules: RegistryModule[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching all available modules from the registry (marketplace)
 */
export function useModuleMarketplace(): UseModuleMarketplaceReturn {
  const [registryModules, setRegistryModules] = useState<RegistryModule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const currentNetwork = useSelectedNetwork()

  const fetchModules = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `registry-modules-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_getRegistryModules',
          params: [{ chainId: currentNetwork?.chainId }],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || 'Failed to fetch registry modules')
      }

      setRegistryModules(response?.payload?.result?.modules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch registry modules'))
    } finally {
      setIsLoading(false)
    }
  }, [currentNetwork])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  return {
    registryModules,
    isLoading,
    error,
    refetch: fetchModules,
  }
}
