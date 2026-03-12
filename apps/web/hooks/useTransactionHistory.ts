'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex, PublicClient } from 'viem'
import { erc20Abi, parseAbiItem } from 'viem'
import { getDefaultTokens } from '@stablenet/contracts'
import { useStableNetContext } from '@/providers/StableNetProvider'
import type { Transaction } from '@/types'

/**
 * Number of recent blocks to scan for Transfer events.
 */
const BLOCK_SCAN_RANGE = 5000n

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

interface TokenMeta {
  symbol: string
  decimals: number
}

/**
 * Build a token metadata lookup from known tokens for a chain.
 */
function buildTokenMeta(chainId: number): Map<string, TokenMeta> {
  const tokens = getDefaultTokens(chainId)
  const meta = new Map<string, TokenMeta>()
  for (const t of tokens) {
    if (t.address !== '0x0000000000000000000000000000000000000000') {
      meta.set(t.address.toLowerCase(), { symbol: t.symbol, decimals: t.decimals })
    }
  }
  return meta
}

/**
 * Resolve token metadata on-chain for contracts not in the known list.
 * Reads symbol() and decimals() directly from the ERC-20 contract.
 */
async function resolveUnknownTokens(
  publicClient: PublicClient,
  unknownAddresses: string[],
  meta: Map<string, TokenMeta>
): Promise<void> {
  if (unknownAddresses.length === 0) return

  const results = await Promise.allSettled(
    unknownAddresses.map(async (addr) => {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: addr as Address,
          abi: erc20Abi,
          functionName: 'symbol',
        }).catch(() => null),
        publicClient.readContract({
          address: addr as Address,
          abi: erc20Abi,
          functionName: 'decimals',
        }).catch(() => null),
      ])
      return { addr, symbol, decimals }
    })
  )

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { addr, symbol, decimals } = result.value
    meta.set(addr.toLowerCase(), {
      symbol: symbol ?? addr.slice(0, 8),
      decimals: decimals ?? 18,
    })
  }
}

export function useTransactionHistory(
  config: UseTransactionHistoryConfig = {}
): UseTransactionHistoryReturn {
  const { address, fetchTransactions: externalFetch, autoFetch = true } = config
  const { publicClient, chainId } = useStableNetContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

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
      if (externalFetch) {
        const result = await externalFetch(address)
        if (id !== fetchIdRef.current) return
        setTransactions(result)
      } else {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > BLOCK_SCAN_RANGE ? latestBlock - BLOCK_SCAN_RANGE : 0n

        const transferEvent = parseAbiItem(
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        )

        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            event: transferEvent,
            fromBlock,
            toBlock: 'latest',
            args: { from: address },
          }),
          publicClient.getLogs({
            event: transferEvent,
            fromBlock,
            toBlock: 'latest',
            args: { to: address },
          }),
        ])

        if (id !== fetchIdRef.current) return

        // Deduplicate by txHash+logIndex
        const seen = new Set<string>()
        const allLogs = [...sentLogs, ...receivedLogs].filter((log) => {
          const key = `${log.transactionHash}:${log.logIndex}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        // Build token metadata from known list, then resolve unknowns on-chain
        const tokenMeta = buildTokenMeta(chainId)
        const unknownAddresses = [
          ...new Set(
            allLogs
              .map((log) => log.address.toLowerCase())
              .filter((addr) => !tokenMeta.has(addr))
          ),
        ]
        await resolveUnknownTokens(publicClient, unknownAddresses, tokenMeta)

        if (id !== fetchIdRef.current) return

        // Fetch block timestamps
        const uniqueBlocks = [...new Set(allLogs.map((l) => l.blockNumber))]
        const blockTimestamps = new Map<bigint, number>()

        const batchSize = 10
        for (let i = 0; i < uniqueBlocks.length; i += batchSize) {
          const batch = uniqueBlocks.slice(i, i + batchSize)
          const blocks = await Promise.all(
            batch.map((bn) =>
              publicClient.getBlock({ blockNumber: bn }).catch(() => null)
            )
          )
          for (let j = 0; j < batch.length; j++) {
            const block = blocks[j]
            if (block) {
              blockTimestamps.set(batch[j], Number(block.timestamp) * 1000)
            }
          }
        }

        if (id !== fetchIdRef.current) return

        // Map logs → Transaction objects
        const mapped: Transaction[] = allLogs.map((log) => {
          const meta = tokenMeta.get(log.address.toLowerCase())
          const from = (log.args.from ?? '0x0') as Address
          const to = (log.args.to ?? '0x0') as Address
          const value = log.args.value ?? 0n

          return {
            hash: log.transactionHash as Hex,
            from,
            to,
            value: 0n,
            chainId,
            status: 'confirmed' as const,
            timestamp: blockTimestamps.get(log.blockNumber!) ?? Date.now(),
            tokenTransfer: {
              contractAddress: log.address as Address,
              symbol: meta?.symbol,
              decimals: meta?.decimals,
              value,
            },
          }
        })

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
  }, [address, externalFetch, publicClient, chainId])

  // Refetch when address or chainId changes
  useEffect(() => {
    if (autoFetch && address) {
      refresh()
    }
  }, [autoFetch, address, chainId, refresh])

  return {
    transactions,
    isLoading,
    error,
    refresh,
  }
}
