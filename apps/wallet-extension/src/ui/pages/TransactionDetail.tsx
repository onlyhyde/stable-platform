import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'
import { useSelectedNetwork } from '../hooks'
import { useWalletStore } from '../hooks/useWalletStore'

/**
 * Transaction Detail Page
 *
 * Shows full transaction details from the store. Auto-refreshes while pending.
 */
export function TransactionDetail() {
  const { t } = useTranslation('tx')
  const { setPage, selectedTxId, pendingTransactions, history, syncWithBackground } =
    useWalletStore()
  const currentNetwork = useSelectedNetwork()
  const [isSpeedingUp, setIsSpeedingUp] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Find transaction from store
  const tx = useMemo(() => {
    if (!selectedTxId) return null
    return (
      pendingTransactions.find((t) => t.id === selectedTxId) ??
      history.find((t) => t.id === selectedTxId) ??
      null
    )
  }, [selectedTxId, pendingTransactions, history])

  // Auto-refresh while pending
  useEffect(() => {
    if (!tx || (tx.status !== 'submitted' && tx.status !== 'pending')) return

    const timer = setInterval(() => {
      syncWithBackground().catch(() => {})
    }, 3000)

    return () => clearInterval(timer)
  }, [tx, syncWithBackground])

  function truncateHash(hash: string): string {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  async function handleSpeedUp() {
    if (!tx?.txHash) return
    setIsSpeedingUp(true)
    try {
      await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `speedup-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_speedUpTransaction',
          params: [{ hash: tx.txHash }],
        },
      })
    } catch {
      // Speed up failed
    } finally {
      setIsSpeedingUp(false)
    }
  }

  async function handleCancel() {
    if (!tx?.txHash) return
    setIsCancelling(true)
    try {
      await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `cancel-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_cancelTransaction',
          params: [{ hash: tx.txHash }],
        },
      })
    } catch {
      // Cancel failed
    } finally {
      setIsCancelling(false)
    }
  }

  if (!tx) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPage('activity')}
            className="p-1 rounded-lg"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {t('title')}
          </h1>
        </div>
        <p className="text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('noTransactionSelected')}
        </p>
      </div>
    )
  }

  const isPending = tx.status === 'pending' || tx.status === 'submitted'
  const displayHash = tx.txHash ?? tx.id
  const statusLabel =
    tx.status === 'confirmed'
      ? t('confirmed')
      : tx.status === 'failed'
        ? t('failed')
        : tx.status === 'submitted'
          ? t('submitted')
          : t('pending')

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage('activity')}
          className="p-1 rounded-lg"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('title')}
        </h1>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center">
        <span
          className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{
            backgroundColor:
              tx.status === 'confirmed'
                ? 'rgb(var(--success) / 0.1)'
                : tx.status === 'failed'
                  ? 'rgb(var(--destructive) / 0.1)'
                  : 'rgb(var(--warning) / 0.1)',
            color:
              tx.status === 'confirmed'
                ? 'rgb(var(--success))'
                : tx.status === 'failed'
                  ? 'rgb(var(--destructive))'
                  : 'rgb(var(--warning))',
          }}
        >
          {isPending && (
            <span
              className="w-2 h-2 rounded-full mr-2 animate-pulse"
              style={{
                backgroundColor: 'rgb(var(--warning))',
              }}
            />
          )}
          {statusLabel}
        </span>
      </div>

      {/* Transaction Details Card */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        {/* Transaction Hash */}
        <div>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('transactionHash')}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
              {truncateHash(displayHash)}
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(displayHash)}
              className="p-1"
              style={{ color: 'rgb(var(--primary))' }}
              title={t('copyHash')}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('from')}
            </p>
            <p className="text-sm font-mono mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
              {truncateHash(tx.from)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('to')}
            </p>
            <p className="text-sm font-mono mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
              {tx.to ? truncateHash(tx.to) : '-'}
            </p>
          </div>
        </div>

        {/* Value */}
        <div>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('value')}
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
            {`${Number(formatEther(tx.value)).toFixed(6)} ETH`}
          </p>
        </div>

        {/* Gas Info */}
        {tx.gasUsed && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('gasUsed')}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
                {tx.gasUsed.toString()}
              </p>
            </div>
            {tx.gasPrice && (
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {t('gasPrice')}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
                  {tx.gasPrice.toString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Block Number */}
        {tx.blockNumber && (
          <div>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('block')}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
              {tx.blockNumber.toString()}
            </p>
          </div>
        )}

        {/* Timestamp */}
        <div>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('timestamp')}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
            {new Date(tx.timestamp).toLocaleString()}
          </p>
        </div>

        {/* UserOp Hash */}
        {tx.userOpHash && (
          <div>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('userOpHash')}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {truncateHash(tx.userOpHash)}
              </p>
              <button
                type="button"
                onClick={() => copyToClipboard(tx.userOpHash!)}
                className="p-1"
                style={{ color: 'rgb(var(--primary))' }}
                title={t('copyUserOpHash')}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Actions: Speed Up / Cancel */}
      {isPending && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSpeedUp}
            disabled={isSpeedingUp}
            className="py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              color: 'rgb(var(--warning))',
            }}
          >
            {isSpeedingUp ? t('speedingUp') : t('speedUp')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {isCancelling ? t('cancelling') : t('cancelTx')}
          </button>
        </div>
      )}

      {/* View on Explorer */}
      {currentNetwork?.explorerUrl && tx.txHash && (
        <a
          href={`${currentNetwork.explorerUrl}/tx/${tx.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'rgb(var(--secondary))',
            color: 'rgb(var(--primary))',
          }}
        >
          {t('viewOnExplorer')}
        </a>
      )}
    </div>
  )
}
