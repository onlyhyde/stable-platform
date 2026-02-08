import { useCallback, useEffect, useState } from 'react'
import type { ContractEntry, ResolvedAddressSet } from '../../types'
import { useRegistryClient } from '../provider'

export interface UseAddressSetResult {
  readonly addresses: Record<string, `0x${string}`>
  readonly entries: readonly ContractEntry[]
  readonly isLoading: boolean
  readonly error: Error | null
  readonly refetch: () => void
}

export function useAddressSet(chainId: number, setName: string): UseAddressSetResult {
  const client = useRegistryClient()
  const [resolved, setResolved] = useState<ResolvedAddressSet | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSet = useCallback(() => {
    setIsLoading(true)
    setError(null)

    client
      .getAddressSet(chainId, setName)
      .then((result) => {
        setResolved(result)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsLoading(false)
      })
  }, [client, chainId, setName])

  useEffect(() => {
    fetchSet()

    const channel = `sets:${chainId}:${setName}`
    client.subscribe([channel])

    const handleUpdate = (data: ResolvedAddressSet) => {
      if (data.chainId === chainId && data.name === setName) {
        setResolved(data)
      }
    }

    client.on('set:updated', handleUpdate)

    return () => {
      client.unsubscribe([channel])
      client.off('set:updated', handleUpdate)
    }
  }, [client, chainId, setName, fetchSet])

  const addresses: Record<string, `0x${string}`> = {}
  if (resolved) {
    for (const entry of resolved.contracts) {
      addresses[entry.name] = entry.address
    }
  }

  return {
    addresses,
    entries: resolved?.contracts ?? [],
    isLoading,
    error,
    refetch: fetchSet,
  }
}
