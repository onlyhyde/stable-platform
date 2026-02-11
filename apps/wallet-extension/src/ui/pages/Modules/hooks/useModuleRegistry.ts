import {
  createModuleRegistry,
  type ModuleRegistry,
  type ModuleRegistryEntry,
} from '@stablenet/core'
import { useEffect, useState } from 'react'
import { useSelectedNetwork } from '../../../hooks'

interface UseModuleRegistryReturn {
  registry: ModuleRegistry | null
  availableModules: ModuleRegistryEntry[] | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook for accessing the module registry
 */
export function useModuleRegistry(): UseModuleRegistryReturn {
  const [registry, setRegistry] = useState<ModuleRegistry | null>(null)
  const [availableModules, setAvailableModules] = useState<ModuleRegistryEntry[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  useEffect(() => {
    if (!currentNetwork) return

    setIsLoading(true)
    setError(null)

    try {
      // Create registry (built-in modules are included by default)
      const moduleRegistry = createModuleRegistry({
        chainId: currentNetwork.chainId,
      })

      setRegistry(moduleRegistry)

      // Get all available modules
      const modules = moduleRegistry.getAll()
      setAvailableModules(modules)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load module registry'))
    } finally {
      setIsLoading(false)
    }
  }, [currentNetwork])

  return {
    registry,
    availableModules,
    isLoading,
    error,
  }
}
