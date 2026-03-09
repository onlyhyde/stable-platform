import { useEffect, useMemo, useState } from 'react'
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
  const [fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    client
      .getAddressSet(chainId, setName)
      .then((result) => {
        if (!cancelled) {
          setResolved(result)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    const channel = `sets:${chainId}:${setName}`
    client.subscribe([channel])

    const handleUpdate = (data: ResolvedAddressSet) => {
      if (data.chainId === chainId && data.name === setName) {
        setResolved(data)
      }
    }

    const handleDelete = (data: { chainId: number; name: string }) => {
      if (data.chainId === chainId && data.name === setName) {
        setResolved(undefined)
      }
    }

    client.on('set:updated', handleUpdate)
    client.on('set:deleted', handleDelete)

    return () => {
      cancelled = true
      client.unsubscribe([channel])
      client.off('set:updated', handleUpdate)
      client.off('set:deleted', handleDelete)
    }
  }, [client, chainId, setName, fetchKey])

  const addresses = useMemo(() => {
    const result: Record<string, `0x${string}`> = {}
    if (resolved) {
      for (const entry of resolved.contracts) {
        result[entry.name] = entry.address
      }
    }
    return result
  }, [resolved])

  return {
    addresses,
    entries: resolved?.contracts ?? [],
    isLoading,
    error,
    refetch: () => setFetchKey((k) => k + 1),
  }
}
