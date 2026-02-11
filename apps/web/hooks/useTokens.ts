'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Token } from '@/types'

interface UseTokensConfig {
  fetchTokens?: () => Promise<Token[]>
  autoFetch?: boolean
}

interface UseTokensReturn {
  tokens: Token[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTokens(config: UseTokensConfig = {}): UseTokensReturn {
  const { fetchTokens, autoFetch = true } = config
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!fetchTokens) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchTokens()
      setTokens(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
      setError(fetchError)
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchTokens])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    tokens,
    isLoading,
    error,
    refresh,
  }
}
