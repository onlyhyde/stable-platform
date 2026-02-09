import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'
import type { PendingTransaction } from '../../types'
import { useNetworkCurrency, useWalletStore } from '../hooks'

const PENDING_POLL_INTERVAL = 5000 // 5 seconds

export function Activity() {
  const { t } = useTranslation('activity')
  const { pendingTransactions, history, setPage, syncWithBackground, setSelectedTxId } =
    useWalletStore()

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

  const allTransactions = useMemo(
    () => [...pendingTransactions, ...history].sort((a, b) => b.timestamp - a.timestamp),
    [pendingTransactions, history]
  )

  // Group transactions by date
  const grouped = useMemo(() => {
    const groups: { label: string; txs: PendingTransaction[] }[] = []
    let currentLabel = ''

    for (const tx of allTransactions) {
      const label = getDateLabel(tx.timestamp, t)
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, txs: [] })
      }
      groups[groups.length - 1]!.txs.push(tx)
    }

    return groups
  }, [allTransactions, t])

  if (allTransactions.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-6" style={{ color: 'rgb(var(--foreground))' }}>
          {t('title')}
        </h2>
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
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('title')}
      </h2>

      <div className="space-y-4">
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
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onClick={() => {
                    setSelectedTxId(tx.id)
                    setPage('txDetail')
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransactionItem
// ---------------------------------------------------------------------------

function TransactionItem({
  transaction,
  onClick,
}: { transaction: PendingTransaction; onClick: () => void }) {
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
        <p className="text-xs mt-1 px-13" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
