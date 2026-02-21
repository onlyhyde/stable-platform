import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Hex } from 'viem'
import { formatEther } from 'viem'
import type { PendingTransaction } from '../../types'
import { useNetworkCurrency, useWalletStore } from '../hooks'
import { type IndexedTransaction, useIndexerData } from '../hooks/useIndexerData'

const PENDING_POLL_INTERVAL = 5000 // 5 seconds

/**
 * Convert an IndexedTransaction from the indexer into a PendingTransaction-compatible
 * shape so the same TransactionItem component can render both local and on-chain txs.
 */
function toDisplayTransaction(tx: IndexedTransaction): PendingTransaction {
  return {
    id: tx.hash,
    from: tx.from as PendingTransaction['from'],
    to: tx.to as PendingTransaction['to'],
    value: BigInt(tx.value),
    chainId: 0, // not used for display
    status: tx.status === 'success' ? 'confirmed' : tx.status === 'failed' ? 'failed' : 'pending',
    type: tx.direction === 'in' ? 'receive' : 'send',
    txHash: tx.hash as Hex,
    timestamp: tx.timestamp,
    gasUsed: tx.gasUsed ? BigInt(tx.gasUsed) : undefined,
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
    blockNumber: tx.blockNumber ? BigInt(tx.blockNumber) : undefined,
    methodName: tx.methodName,
  }
}

export function Activity() {
  const { t } = useTranslation('activity')
  const { pendingTransactions, history, setPage, syncWithBackground, setSelectedTxId } =
    useWalletStore()

  const {
    transactions: indexedTransactions,
    isIndexerAvailable,
    isLoadingTransactions,
    isLoadingMore,
    hasMore,
    error: indexerError,
    loadMoreTransactions,
    refreshTransactions,
  } = useIndexerData()

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto-refresh when pending transactions exist
  useEffect(() => {
    const hasPending = pendingTransactions.some(
      (tx) => tx.status === 'submitted' || tx.status === 'pending'
    )
    if (!hasPending) return

    const timer = setInterval(() => {
      syncWithBackground().catch(() => {})
    }, PENDING_POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [pendingTransactions, syncWithBackground])

  // Merge local pending txs with indexer history, deduplicating by txHash
  const allTransactions = useMemo(() => {
    const localTxs = [...pendingTransactions, ...history]
    const indexedDisplayTxs = indexedTransactions.map(toDisplayTransaction)

    // Build a set of txHashes from local txs so local versions take priority
    const localHashes = new Set(
      localTxs.filter((tx) => tx.txHash).map((tx) => tx.txHash!.toLowerCase())
    )

    const deduplicatedIndexed = indexedDisplayTxs.filter(
      (tx) => !tx.txHash || !localHashes.has(tx.txHash.toLowerCase())
    )

    return [...localTxs, ...deduplicatedIndexed].sort((a, b) => b.timestamp - a.timestamp)
  }, [pendingTransactions, history, indexedTransactions])

  // Separate pending from confirmed for sectioned display
  const pendingTxs = useMemo(
    () => allTransactions.filter((tx) => tx.status === 'pending' || tx.status === 'submitted'),
    [allTransactions]
  )

  const confirmedTxs = useMemo(
    () => allTransactions.filter((tx) => tx.status !== 'pending' && tx.status !== 'submitted'),
    [allTransactions]
  )

  // Group confirmed transactions by date
  const grouped = useMemo(() => {
    const groups: { label: string; txs: PendingTransaction[] }[] = []
    let currentLabel = ''

    for (const tx of confirmedTxs) {
      const label = getDateLabel(tx.timestamp, t)
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, txs: [] })
      }
      groups[groups.length - 1]!.txs.push(tx)
    }

    return groups
  }, [confirmedTxs, t])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([syncWithBackground(), refreshTransactions()])
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false)
    }
  }, [syncWithBackground, refreshTransactions])

  const handleTxClick = useCallback(
    (tx: PendingTransaction) => {
      setSelectedTxId(tx.id)
      setPage('txDetail')
    },
    [setSelectedTxId, setPage]
  )

  const isEmpty = allTransactions.length === 0 && !isLoadingTransactions && !isRefreshing

  return (
    <div className="flex flex-col flex-1 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'rgb(var(--muted-foreground))' }}
          aria-label="Refresh"
        >
          <svg
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Indexer unavailable info */}
      {!isIndexerAvailable && !isLoadingTransactions && (
        <div
          className="rounded-lg px-3 py-2 mb-4 text-xs"
          style={{
            backgroundColor: 'rgb(var(--info) / 0.1)',
            color: 'rgb(var(--info))',
          }}
        >
          {t('indexerUnavailable')}
        </div>
      )}

      {/* Error state */}
      {indexerError && (
        <div
          className="rounded-lg px-3 py-2 mb-4 text-xs flex items-center justify-between"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            color: 'rgb(var(--destructive))',
          }}
        >
          <span>{t('errorLoadingHistory')}</span>
          <button
            type="button"
            onClick={refreshTransactions}
            className="font-medium underline ml-2"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoadingTransactions && allTransactions.length === 0 && (
        <div className="text-center py-12">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('loading')}
          </p>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>{t('noTransactions')}</p>
        </div>
      )}

      {/* Transaction list */}
      {allTransactions.length > 0 && (
        <div className="space-y-4 flex-1">
          {/* Pending section */}
          {pendingTxs.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 px-1" style={{ color: 'rgb(var(--warning))' }}>
                {t('pendingTransactions')}
              </p>
              <div className="space-y-2">
                {pendingTxs.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} onClick={() => handleTxClick(tx)} />
                ))}
              </div>
            </div>
          )}

          {/* Confirmed grouped by date */}
          {grouped.map((group) => (
            <div key={group.label}>
              <p
                className="text-xs font-medium mb-2 px-1"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {group.label}
              </p>
              <div className="space-y-2">
                {group.txs.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} onClick={() => handleTxClick(tx)} />
                ))}
              </div>
            </div>
          ))}

          {/* Load More button */}
          {isIndexerAvailable && hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={loadMoreTransactions}
                disabled={isLoadingMore}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{
                  color: 'rgb(var(--primary))',
                  backgroundColor: 'rgb(var(--primary) / 0.1)',
                }}
              >
                {isLoadingMore ? t('loadingMore') : t('loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransactionItem
// ---------------------------------------------------------------------------

function TransactionItem({
  transaction,
  onClick,
}: {
  transaction: PendingTransaction
  onClick: () => void
}) {
  const { t } = useTranslation('activity')
  const { symbol: currencySymbol } = useNetworkCurrency()

  const isReceive = transaction.type === 'receive'
  const label = getTransactionLabel(transaction, t)
  const counterparty = isReceive ? transaction.from : transaction.to

  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
    submitted: { bg: 'rgb(var(--info) / 0.1)', color: 'rgb(var(--info))' },
    confirmed: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
    failed: { bg: 'rgb(var(--destructive) / 0.1)', color: 'rgb(var(--destructive))' },
    cancelled: { bg: 'rgb(var(--muted-foreground) / 0.1)', color: 'rgb(var(--muted-foreground))' },
  }

  const statusStyle = statusStyles[transaction.status] ?? {
    bg: 'rgb(var(--secondary))',
    color: 'rgb(var(--muted-foreground))',
  }

  const iconColor = isReceive ? 'rgb(var(--success))' : 'rgb(var(--primary))'
  const iconBg = isReceive ? 'rgb(var(--success) / 0.1)' : 'rgb(var(--primary) / 0.1)'

  // Display value: token transfer amount or native value
  const hasTokenTransfer = transaction.tokenTransfer != null
  const valueDisplay = hasTokenTransfer
    ? `${isReceive ? '+' : '-'}${formatTokenAmount(transaction.tokenTransfer!.amount, transaction.tokenTransfer!.decimals)} ${transaction.tokenTransfer!.symbol}`
    : `${isReceive ? '+' : '-'}${Number(formatEther(transaction.value)).toFixed(4)} ${currencySymbol}`

  const valueColor = isReceive ? 'rgb(var(--success))' : 'rgb(var(--foreground))'

  return (
    <button
      type="button"
      onClick={onClick}
      className="card rounded-xl p-4 w-full text-left cursor-pointer transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: iconBg }}
          >
            {isReceive ? (
              <svg
                className="w-5 h-5"
                style={{ color: iconColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                style={{ color: iconColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              {label}
            </p>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {isReceive ? t('from') : t('to')}: {formatAddress(counterparty)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-sm" style={{ color: valueColor }}>
            {valueDisplay}
          </p>
          <span
            className="inline-flex items-center text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {(transaction.status === 'pending' || transaction.status === 'submitted') && (
              <span
                className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse"
                style={{ backgroundColor: statusStyle.color }}
              />
            )}
            {transaction.status}
          </span>
        </div>
      </div>

      {/* Method name for contract interactions */}
      {transaction.methodName && transaction.type === 'contract' && (
        <p className="text-xs mt-1 pl-[52px]" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {transaction.methodName}()
        </p>
      )}

      <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {new Date(transaction.timestamp).toLocaleTimeString()}
      </p>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10 ** decimals
  return (Number(amount) / divisor).toFixed(4)
}

function getTransactionLabel(tx: PendingTransaction, t: (key: string) => string): string {
  switch (tx.type) {
    case 'receive':
      return t('receive')
    case 'send':
      return t('send')
    case 'swap':
      return t('swap')
    case 'approve':
      return tx.tokenTransfer ? `${t('approve')} ${tx.tokenTransfer.symbol}` : t('approve')
    case 'contract':
      return tx.methodName ?? t('contractInteraction')
    case 'userOp':
      return t('userOperation')
    default:
      return t('transaction')
  }
}

function getDateLabel(timestamp: number, t: (key: string) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const txDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (txDate.getTime() === today.getTime()) return t('today')
  if (txDate.getTime() === yesterday.getTime()) return t('yesterday')
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
