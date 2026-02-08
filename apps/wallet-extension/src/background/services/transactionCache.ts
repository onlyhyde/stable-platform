/**
 * TransactionCache
 *
 * Caches transaction history in chrome.storage.local for instant loading
 * when the extension popup opens. The cache is keyed by account + chainId
 * and automatically evicts old entries.
 */

import type { PendingTransaction } from '../../types'

const STORAGE_KEY_PREFIX = 'txHistory'
const MAX_CACHED_PER_ACCOUNT = 100
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CachedHistory {
  transactions: SerializedTransaction[]
  timestamp: number
  chainId: number
}

/** JSON-safe transaction representation (bigint → string) */
interface SerializedTransaction {
  id: string
  from: string
  to: string
  value: string
  data?: string
  chainId: number
  status: string
  type: string
  userOpHash?: string
  txHash?: string
  timestamp: number
  gasUsed?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  methodName?: string
  tokenTransfer?: {
    tokenAddress: string
    symbol: string
    decimals: number
    amount: string
    direction: 'in' | 'out'
  }
  error?: string
}

function getCacheKey(account: string, chainId: number): string {
  return `${STORAGE_KEY_PREFIX}_${account.toLowerCase()}_${chainId}`
}

function serializeTransaction(tx: PendingTransaction): SerializedTransaction {
  return {
    id: tx.id,
    from: tx.from,
    to: tx.to,
    value: tx.value.toString(),
    data: tx.data,
    chainId: tx.chainId,
    status: tx.status,
    type: tx.type,
    userOpHash: tx.userOpHash,
    txHash: tx.txHash,
    timestamp: tx.timestamp,
    gasUsed: tx.gasUsed?.toString(),
    gasPrice: tx.gasPrice?.toString(),
    maxFeePerGas: tx.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
    methodName: tx.methodName,
    tokenTransfer: tx.tokenTransfer
      ? {
          tokenAddress: tx.tokenTransfer.tokenAddress,
          symbol: tx.tokenTransfer.symbol,
          decimals: tx.tokenTransfer.decimals,
          amount: tx.tokenTransfer.amount.toString(),
          direction: tx.tokenTransfer.direction,
        }
      : undefined,
    error: tx.error,
  }
}

function deserializeTransaction(stx: SerializedTransaction): PendingTransaction {
  return {
    id: stx.id,
    from: stx.from as PendingTransaction['from'],
    to: stx.to as PendingTransaction['to'],
    value: BigInt(stx.value),
    data: stx.data as PendingTransaction['data'],
    chainId: stx.chainId,
    status: stx.status as PendingTransaction['status'],
    type: stx.type as PendingTransaction['type'],
    userOpHash: stx.userOpHash as PendingTransaction['userOpHash'],
    txHash: stx.txHash as PendingTransaction['txHash'],
    timestamp: stx.timestamp,
    gasUsed: stx.gasUsed ? BigInt(stx.gasUsed) : undefined,
    gasPrice: stx.gasPrice ? BigInt(stx.gasPrice) : undefined,
    maxFeePerGas: stx.maxFeePerGas ? BigInt(stx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: stx.maxPriorityFeePerGas ? BigInt(stx.maxPriorityFeePerGas) : undefined,
    methodName: stx.methodName,
    tokenTransfer: stx.tokenTransfer
      ? {
          tokenAddress: stx.tokenTransfer.tokenAddress as PendingTransaction['from'],
          symbol: stx.tokenTransfer.symbol,
          decimals: stx.tokenTransfer.decimals,
          amount: BigInt(stx.tokenTransfer.amount),
          direction: stx.tokenTransfer.direction,
        }
      : undefined,
    error: stx.error,
  }
}

export const transactionCache = {
  /**
   * Save transaction history to local storage.
   */
  async save(account: string, chainId: number, transactions: PendingTransaction[]): Promise<void> {
    const key = getCacheKey(account, chainId)
    const truncated = transactions.slice(0, MAX_CACHED_PER_ACCOUNT)
    const cached: CachedHistory = {
      transactions: truncated.map(serializeTransaction),
      timestamp: Date.now(),
      chainId,
    }
    await chrome.storage.local.set({ [key]: cached })
  },

  /**
   * Load cached transaction history. Returns null if cache is missing or expired.
   */
  async load(account: string, chainId: number): Promise<PendingTransaction[] | null> {
    const key = getCacheKey(account, chainId)
    const result = await chrome.storage.local.get(key)
    const cached = result[key] as CachedHistory | undefined

    if (!cached) return null
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null

    return cached.transactions.map(deserializeTransaction)
  },

  /**
   * Clear cache for a specific account+chain, or all transaction caches.
   */
  async clear(account?: string, chainId?: number): Promise<void> {
    if (account && chainId !== undefined) {
      const key = getCacheKey(account, chainId)
      await chrome.storage.local.remove(key)
      return
    }

    // Clear all transaction caches
    const allKeys = await chrome.storage.local.get(null)
    const txKeys = Object.keys(allKeys).filter((k) => k.startsWith(STORAGE_KEY_PREFIX))
    if (txKeys.length > 0) {
      await chrome.storage.local.remove(txKeys)
    }
  },
}
