'use client'

import { getNativeCurrencySymbol } from '@stablenet/wallet-sdk'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { Hex } from 'viem'
import { formatEther, formatUnits } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Pagination,
  useToast,
} from '@/components/common'
import { useWallet } from '@/hooks'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useTransactionManager } from '@/hooks/useTransactionManager'
import type { PendingUserOp } from '@/hooks/useUserOp'
import { useUserOp } from '@/hooks/useUserOp'
import { formatAddress, formatRelativeTime } from '@/lib/utils'
import type { Transaction } from '@/types'

const ITEMS_PER_PAGE = 10

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const _showPending = searchParams.get('pending') === 'true'
  const { isConnected, address } = useWallet()
  const { transactions, isLoading, error } = useTransactionHistory({ address })
  const { recheckUserOp, getPendingUserOps, removePendingUserOp } = useUserOp()
  const { addToast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const { speedUpTransaction, cancelTransaction, isSpeedingUp, isCancelling } =
    useTransactionManager()
  const [pendingOps, setPendingOps] = useState<PendingUserOp[]>([])
  const [recheckingHash, setRecheckingHash] = useState<Hex | null>(null)
  const [actionHash, setActionHash] = useState<Hex | null>(null)

  // Load pending ops on mount and when showPending changes
  useEffect(() => {
    setPendingOps(getPendingUserOps())
  }, [getPendingUserOps])

  const handleRecheck = useCallback(
    async (userOpHash: Hex) => {
      setRecheckingHash(userOpHash)
      try {
        const result = await recheckUserOp(userOpHash)
        if (result.status === 'confirmed') {
          addToast({
            type: 'success',
            title: 'Confirmed',
            message: 'Transaction confirmed on-chain',
          })
          setPendingOps((prev) => prev.filter((op) => op.userOpHash !== userOpHash))
        } else if (result.status === 'failed') {
          addToast({ type: 'error', title: 'Failed', message: 'Transaction failed on-chain' })
          setPendingOps((prev) => prev.filter((op) => op.userOpHash !== userOpHash))
        } else {
          addToast({
            type: 'info',
            title: 'Still Pending',
            message: 'Transaction is still being processed',
          })
        }
      } catch {
        addToast({ type: 'error', title: 'Error', message: 'Failed to recheck transaction' })
      } finally {
        setRecheckingHash(null)
      }
    },
    [recheckUserOp, addToast]
  )

  const handleDismissPending = useCallback(
    (userOpHash: Hex) => {
      removePendingUserOp(userOpHash)
      setPendingOps((prev) => prev.filter((op) => op.userOpHash !== userOpHash))
    },
    [removePendingUserOp]
  )

  const handleSpeedUp = useCallback(
    async (txHash: Hex) => {
      setActionHash(txHash)
      try {
        const newHash = await speedUpTransaction(txHash)
        addToast({
          type: 'success',
          title: 'Transaction Speed Up',
          message: `Replacement submitted: ${newHash.slice(0, 10)}...`,
          txHash: newHash,
        })
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Speed Up Failed',
          message: err instanceof Error ? err.message : 'Failed to speed up',
        })
      } finally {
        setActionHash(null)
      }
    },
    [speedUpTransaction, addToast]
  )

  const handleCancel = useCallback(
    async (txHash: Hex) => {
      setActionHash(txHash)
      try {
        const cancelHash = await cancelTransaction(txHash)
        addToast({
          type: 'success',
          title: 'Transaction Cancelled',
          message: `Cancel submitted: ${cancelHash.slice(0, 10)}...`,
          txHash: cancelHash,
        })
        // Remove from pending ops since we replaced it
        removePendingUserOp(txHash)
        setPendingOps((prev) => prev.filter((op) => op.userOpHash !== txHash))
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Cancel Failed',
          message: err instanceof Error ? err.message : 'Failed to cancel',
        })
      } finally {
        setActionHash(null)
      }
    },
    [cancelTransaction, addToast, removePendingUserOp]
  )

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to view history
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading transactions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--destructive))' }}>Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Transaction History
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>View your past transactions</p>
      </div>

      {/* Pending Operations Banner */}
      {pendingOps.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'rgb(var(--warning))' }}
              />
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--warning))' }}>
                {pendingOps.length} pending operation{pendingOps.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {pendingOps.map((op) => (
                <div
                  key={op.userOpHash}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: 'rgb(var(--warning) / 0.05)',
                    border: '1px solid rgb(var(--warning) / 0.2)',
                  }}
                >
                  <div>
                    <p className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                      {op.userOpHash.slice(0, 10)}...{op.userOpHash.slice(-8)}
                    </p>
                    <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      Submitted {formatRelativeTime(op.timestamp)}
                      {op.to ? ` to ${op.to.slice(0, 8)}...` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleSpeedUp(op.userOpHash)}
                      isLoading={actionHash === op.userOpHash && isSpeedingUp}
                      disabled={actionHash !== null}
                      className="text-xs px-3 py-1"
                    >
                      Speed Up
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleCancel(op.userOpHash)}
                      isLoading={actionHash === op.userOpHash && isCancelling}
                      disabled={actionHash !== null}
                      className="text-xs px-3 py-1"
                      style={{ color: 'rgb(var(--destructive))' }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleRecheck(op.userOpHash)}
                      isLoading={recheckingHash === op.userOpHash}
                      disabled={actionHash !== null}
                      className="text-xs px-3 py-1"
                    >
                      Recheck
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDismissPending(op.userOpHash)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
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
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>No transactions yet</p>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}>
                Your transaction history will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {transactions
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((tx) => (
                    <TransactionItem key={tx.hash} transaction={tx} />
                  ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(transactions.length / ITEMS_PER_PAGE)}
                onPageChange={setCurrentPage}
                className="pt-4"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface TransactionItemProps {
  transaction: Transaction
}

function TransactionItem({ transaction }: TransactionItemProps) {
  const nativeSymbol = getNativeCurrencySymbol(transaction.chainId)

  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
    confirmed: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
    failed: { bg: 'rgb(var(--destructive) / 0.1)', color: 'rgb(var(--destructive))' },
  }

  const currentStatus = statusStyles[transaction.status] || statusStyles.pending

  const displayAmount = transaction.tokenTransfer
    ? `${formatUnits(transaction.tokenTransfer.value, transaction.tokenTransfer.decimals ?? 18)} ${transaction.tokenTransfer.symbol ?? formatAddress(transaction.tokenTransfer.contractAddress, 3)}`
    : `${formatEther(transaction.value)} ${nativeSymbol}`

  return (
    <div className="py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: 'rgb(var(--primary))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </div>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            To: {formatAddress(transaction.to)}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {formatRelativeTime(transaction.timestamp)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          -{displayAmount}
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: currentStatus.bg, color: currentStatus.color }}
        >
          {transaction.status}
        </span>
      </div>
    </div>
  )
}
