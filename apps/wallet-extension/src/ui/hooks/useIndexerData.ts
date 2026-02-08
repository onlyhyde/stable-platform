/**
 * useIndexerData Hook
 *
 * Provides access to indexed data (token balances, transaction history)
 * from the network's indexer service.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWalletStore } from './useWalletStore'

/**
 * Token balance with metadata
 */
export interface TokenBalance {
  address: string
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
}

/**
 * Transaction from indexer
 */
export interface IndexedTransaction {
  hash: string
  from: string
  to: string
  value: string
  gasPrice: string
  gasUsed: string
  blockNumber: number
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  /** Direction relative to the account */
  direction: 'in' | 'out'
  /** Method name if available */
  methodName?: string
}

/**
 * Token transfer event
 */
export interface TokenTransfer {
  contractAddress: string
  from: string
  to: string
  value: string
  formattedValue: string
  symbol: string
  transactionHash: string
  blockNumber: number
  timestamp: number
  direction: 'in' | 'out'
}

const PAGE_SIZE = 20

interface IndexerDataState {
  /** ERC-20 token balances */
  tokenBalances: TokenBalance[]
  /** Native transaction history */
  transactions: IndexedTransaction[]
  /** Token transfer history */
  tokenTransfers: TokenTransfer[]
  /** Whether indexer is available for current network */
  isIndexerAvailable: boolean
  /** Loading states */
  isLoadingTokens: boolean
  isLoadingTransactions: boolean
  isLoadingMore: boolean
  /** Whether there are more transactions to load */
  hasMore: boolean
  /** Current page offset */
  offset: number
  /** Error state */
  error: string | null
}

interface UseIndexerDataReturn extends IndexerDataState {
  /** Refresh token balances */
  refreshTokenBalances: () => Promise<void>
  /** Refresh transaction history */
  refreshTransactions: () => Promise<void>
  /** Load next page of transactions */
  loadMoreTransactions: () => Promise<void>
  /** Refresh all indexed data */
  refreshAll: () => Promise<void>
}

/**
 * Hook for accessing indexed blockchain data
 */
export function useIndexerData(): UseIndexerDataReturn {
  const selectedAccount = useWalletStore((state) => state.selectedAccount)
  const selectedChainId = useWalletStore((state) => state.selectedChainId)
  const networks = useWalletStore((state) => state.networks)

  const [state, setState] = useState<IndexerDataState>({
    tokenBalances: [],
    transactions: [],
    tokenTransfers: [],
    isIndexerAvailable: false,
    isLoadingTokens: false,
    isLoadingTransactions: false,
    isLoadingMore: false,
    hasMore: true,
    offset: 0,
    error: null,
  })

  // Check if current network has indexer configured
  const currentNetwork = useMemo(
    () => networks.find((n) => n.chainId === selectedChainId),
    [networks, selectedChainId]
  )

  const hasIndexer = Boolean(currentNetwork?.indexerUrl)

  // Refresh token balances
  const refreshTokenBalances = useCallback(async () => {
    if (!selectedAccount || !hasIndexer) return

    setState((prev) => ({ ...prev, isLoadingTokens: true, error: null }))

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TOKEN_BALANCES',
        id: `tokens-${Date.now()}`,
        payload: { address: selectedAccount },
      })

      if (response?.payload?.success) {
        setState((prev) => ({
          ...prev,
          tokenBalances: response.payload.balances ?? [],
          isIndexerAvailable: true,
          isLoadingTokens: false,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isIndexerAvailable: false,
          isLoadingTokens: false,
          error: response?.payload?.error ?? 'Failed to fetch token balances',
        }))
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoadingTokens: false,
        error: err instanceof Error ? err.message : 'Failed to fetch token balances',
      }))
    }
  }, [selectedAccount, hasIndexer])

  // Refresh transaction history (first page)
  const refreshTransactions = useCallback(async () => {
    if (!selectedAccount || !hasIndexer) return

    setState((prev) => ({ ...prev, isLoadingTransactions: true, error: null }))

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TRANSACTION_HISTORY',
        id: `txs-${Date.now()}`,
        payload: { address: selectedAccount, limit: PAGE_SIZE, offset: 0 },
      })

      if (response?.payload?.success) {
        const txs = response.payload.transactions ?? []
        setState((prev) => ({
          ...prev,
          transactions: txs,
          tokenTransfers: response.payload.tokenTransfers ?? [],
          isIndexerAvailable: true,
          isLoadingTransactions: false,
          hasMore: txs.length >= PAGE_SIZE,
          offset: txs.length,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isIndexerAvailable: false,
          isLoadingTransactions: false,
          error: response?.payload?.error ?? 'Failed to fetch transactions',
        }))
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoadingTransactions: false,
        error: err instanceof Error ? err.message : 'Failed to fetch transactions',
      }))
    }
  }, [selectedAccount, hasIndexer])

  // Load more transactions (next page)
  const loadMoreTransactions = useCallback(async () => {
    if (!selectedAccount || !hasIndexer || state.isLoadingMore || !state.hasMore) return

    setState((prev) => ({ ...prev, isLoadingMore: true }))

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TRANSACTION_HISTORY',
        id: `txs-more-${Date.now()}`,
        payload: { address: selectedAccount, limit: PAGE_SIZE, offset: state.offset },
      })

      if (response?.payload?.success) {
        const newTxs = response.payload.transactions ?? []
        setState((prev) => ({
          ...prev,
          transactions: [...prev.transactions, ...newTxs],
          tokenTransfers: [...prev.tokenTransfers, ...(response.payload.tokenTransfers ?? [])],
          isLoadingMore: false,
          hasMore: newTxs.length >= PAGE_SIZE,
          offset: prev.offset + newTxs.length,
        }))
      } else {
        setState((prev) => ({ ...prev, isLoadingMore: false, hasMore: false }))
      }
    } catch {
      setState((prev) => ({ ...prev, isLoadingMore: false }))
    }
  }, [selectedAccount, hasIndexer, state.isLoadingMore, state.hasMore, state.offset])

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshTokenBalances(), refreshTransactions()])
  }, [refreshTokenBalances, refreshTransactions])

  // Auto-refresh when account or network changes
  useEffect(() => {
    if (selectedAccount && hasIndexer) {
      refreshAll()
    } else {
      // Reset state when indexer is not available
      setState({
        tokenBalances: [],
        transactions: [],
        tokenTransfers: [],
        isIndexerAvailable: false,
        isLoadingTokens: false,
        isLoadingTransactions: false,
        isLoadingMore: false,
        hasMore: true,
        offset: 0,
        error: null,
      })
    }
  }, [selectedAccount, hasIndexer, refreshAll])

  return {
    ...state,
    refreshTokenBalances,
    refreshTransactions,
    loadMoreTransactions,
    refreshAll,
  }
}

/**
 * Hook that only returns token balances (lighter weight)
 */
export function useTokenBalances(): {
  tokenBalances: TokenBalance[]
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const { tokenBalances, isLoadingTokens, refreshTokenBalances } = useIndexerData()

  return {
    tokenBalances,
    isLoading: isLoadingTokens,
    refresh: refreshTokenBalances,
  }
}
