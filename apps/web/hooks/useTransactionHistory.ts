'use client'

import { createIndexerClient } from '@stablenet/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useStableNetContext } from '@/providers/StableNetProvider'
import type { Transaction } from '@/types'

interface UseTransactionHistoryConfig {
  address?: Address
  fetchTransactions?: (address: Address) => Promise<Transaction[]>
  autoFetch?: boolean
}

interface UseTransactionHistoryReturn {
  transactions: Transaction[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTransactionHistory(
  config: UseTransactionHistoryConfig = {}
): UseTransactionHistoryReturn {
  const { address, fetchTransactions: externalFetch, autoFetch = true } = config
  const { indexerUrl, chainId } = useStableNetContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Monotonically increasing fetch ID to discard stale responses
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!address) {
      setTransactions([])
      setIsLoading(false)
      return
    }

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      // Use external fetch if provided (DI override)
      if (externalFetch) {
        const result = await externalFetch(address)
        if (id !== fetchIdRef.current) return
        setTransactions(result)
      } else {
        // Default: use IndexerClient
        const client = createIndexerClient(indexerUrl)

        // Fetch native transactions and ERC-20 transfers in parallel
        const [nativeResult, erc20Transfers] = await Promise.all([
          client.getTransactionsByAddress(address, 50),
          client.getAllERC20Transfers(address, 50).catch(() => []),
        ])

        if (id !== fetchIdRef.current) return

        // Build a map of txHash → ERC-20 transfer for enrichment
        const erc20ByHash = new Map<string, (typeof erc20Transfers)[number]>()
        for (const transfer of erc20Transfers) {
          erc20ByHash.set(transfer.transactionHash, transfer)
        }

        // Map native transactions, enriching with ERC-20 info when matched
        const mapped: Transaction[] = nativeResult.nodes.map((tx) => {
          const base: Transaction = {
            hash: tx.hash as Hex,
            from: tx.from as Address,
            to: tx.to as Address,
            value: BigInt(tx.value),
            chainId,
            status: tx.status === 1 ? ('confirmed' as const) : ('failed' as const),
            timestamp: tx.timestamp,
          }
          const erc20 = erc20ByHash.get(tx.hash)
          if (erc20) {
            base.tokenTransfer = {
              contractAddress: erc20.contractAddress as Address,
              symbol: undefined,
              decimals: undefined,
              value: BigInt(erc20.value),
            }
            erc20ByHash.delete(tx.hash)
          }
          return base
        })

        // Add ERC-20 transfers that don't have a matching native tx
        const nativeHashes = new Set(nativeResult.nodes.map((n) => n.hash))
        for (const transfer of erc20Transfers) {
          if (!nativeHashes.has(transfer.transactionHash)) {
            mapped.push({
              hash: transfer.transactionHash as Hex,
              from: transfer.from as Address,
              to: transfer.to as Address,
              value: 0n,
              chainId,
              status: 'confirmed',
              timestamp: transfer.timestamp,
              tokenTransfer: {
                contractAddress: transfer.contractAddress as Address,
                symbol: undefined,
                decimals: undefined,
                value: BigInt(transfer.value),
              },
            })
          }
        }

        // Sort by timestamp descending (newest first)
        mapped.sort((a, b) => b.timestamp - a.timestamp)

        setTransactions(mapped.slice(0, 50))
      }
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to fetch transactions'))
      setTransactions([])
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [address, externalFetch, indexerUrl, chainId])

  useEffect(() => {
    if (autoFetch && address) {
      refresh()
    }
  }, [autoFetch, address, refresh])

  return {
    transactions,
    isLoading,
    error,
    refresh,
  }
}
