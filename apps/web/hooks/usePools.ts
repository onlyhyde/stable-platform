'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Pool } from '@/types'

interface UsePoolsConfig {
  fetchPools?: () => Promise<Pool[]>
  autoFetch?: boolean
}

interface UsePoolsReturn {
  pools: Pool[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function usePools(config: UsePoolsConfig = {}): UsePoolsReturn {
  const { fetchPools, autoFetch = true } = config
  const [pools, setPools] = useState<Pool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!fetchPools) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchPools()
      setPools(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch pools')
      setError(fetchError)
      setPools([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchPools])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    pools,
    isLoading,
    error,
    refresh,
  }
}
