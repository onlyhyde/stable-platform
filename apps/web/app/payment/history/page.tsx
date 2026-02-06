'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { useWallet } from '@/hooks'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { formatAddress, formatRelativeTime } from '@/lib/utils'
import type { Transaction } from '@/types'

export default function HistoryPage() {
  const { isConnected, address } = useWallet()
  const { transactions, isLoading, error } = useTransactionHistory({ address })

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
            <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {transactions.map((tx) => (
                <TransactionItem key={tx.hash} transaction={tx} />
              ))}
            </div>
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
  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
    confirmed: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
    failed: { bg: 'rgb(var(--destructive) / 0.1)', color: 'rgb(var(--destructive))' },
  }

  const currentStatus = statusStyles[transaction.status] || statusStyles.pending

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
          -{(Number(transaction.value) / 1e18).toFixed(4)} ETH
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
