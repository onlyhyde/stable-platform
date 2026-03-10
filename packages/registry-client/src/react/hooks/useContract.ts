import { useEffect, useState } from 'react'
import type { ContractEntry } from '../../types'
import { useRegistryClient } from '../provider'

export interface UseContractResult {
  readonly address: `0x${string}` | undefined
  readonly entry: ContractEntry | undefined
  readonly isLoading: boolean
  readonly error: Error | null
  readonly refetch: () => void
}

export function useContract(chainId: number, name: string): UseContractResult {
  const client = useRegistryClient()
  const [entry, setEntry] = useState<ContractEntry | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [_fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    client
      .getContract(chainId, name)
      .then((result) => {
        if (!cancelled) {
          setEntry(result)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    const channel = `contracts:${chainId}:${name}`
    client.subscribe([channel])

    const handleUpdate = (data: ContractEntry) => {
      if (data.chainId === chainId && data.name === name) {
        setEntry(data)
      }
    }

    const handleDelete = (data: { chainId: number; name: string }) => {
      if (data.chainId === chainId && data.name === name) {
        setEntry(undefined)
      }
    }

    client.on('contract:updated', handleUpdate)
    client.on('contract:deleted', handleDelete)

    return () => {
      cancelled = true
      client.unsubscribe([channel])
      client.off('contract:updated', handleUpdate)
      client.off('contract:deleted', handleDelete)
    }
  }, [client, chainId, name])

  return {
    address: entry?.address,
    entry,
    isLoading,
    error,
    refetch: () => setFetchKey((k) => k + 1),
  }
}
