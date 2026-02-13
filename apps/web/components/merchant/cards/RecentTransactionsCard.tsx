'use client'

import { useChainId } from 'wagmi'
import { Button } from '@/components/common/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card'
import { getBlockExplorerUrl } from '@/lib/utils'

type TransactionStatus = 'success' | 'failed' | 'pending' | 'refunded'

interface Transaction {
  id: string
  subscriptionId: string
  subscriberAddress: string
  amount: number
  token: string
  status: TransactionStatus
  txHash?: string
  createdAt: Date
  errorMessage?: string
}

interface RecentTransactionsCardProps {
  transactions: Transaction[]
  onViewAll: () => void
  onRetry?: (id: string) => Promise<void>
}

const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const getStyles = () => {
    switch (status) {
      case 'success':
        return {
          backgroundColor: 'rgb(var(--success) / 0.1)',
          color: 'rgb(var(--success))',
        }
      case 'failed':
        return {
          backgroundColor: 'rgb(var(--destructive) / 0.1)',
          color: 'rgb(var(--destructive))',
        }
      case 'pending':
        return {
          backgroundColor: 'rgb(var(--warning) / 0.1)',
          color: 'rgb(var(--warning))',
        }
      case 'refunded':
        return {
          backgroundColor: 'rgb(var(--secondary))',
          color: 'rgb(var(--foreground))',
        }
    }
  }

  const labels = {
    success: 'Success',
    failed: 'Failed',
    pending: 'Pending',
    refunded: 'Refunded',
  }

  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full" style={getStyles()}>
      {labels[status]}
    </span>
  )
}

export function RecentTransactionsCard({
  transactions,
  onViewAll,
  onRetry,
}: RecentTransactionsCardProps) {
  const chainId = useChainId()

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatAmount = (amount: number, token: string) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${token}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Button variant="secondary" size="sm" onClick={onViewAll}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <svg
              aria-hidden="true"
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid rgb(var(--border))',
                    backgroundColor: 'rgb(var(--secondary))',
                  }}
                >
                  <th
                    className="text-left py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    ID
                  </th>
                  <th
                    className="text-left py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Subscriber
                  </th>
                  <th
                    className="text-left py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Amount
                  </th>
                  <th
                    className="text-left py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Status
                  </th>
                  <th
                    className="text-left py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Time
                  </th>
                  <th
                    className="text-right py-3 px-4 text-xs font-medium uppercase"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:opacity-80"
                    style={{ borderBottom: '1px solid rgb(var(--border) / 0.5)' }}
                  >
                    <td className="py-3 px-4">
                      <code
                        className="text-xs font-mono"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {tx.id.slice(0, 8)}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-sm font-mono"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {formatAddress(tx.subscriberAddress)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {formatAmount(tx.amount, tx.token)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={tx.status} />
                      {tx.errorMessage && (
                        <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
                          {tx.errorMessage}
                        </p>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-sm"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {tx.createdAt.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {tx.txHash && (
                          <a
                            href={getBlockExplorerUrl(chainId, { txHash: tx.txHash })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs"
                            style={{ color: 'rgb(var(--primary))' }}
                          >
                            View
                          </a>
                        )}
                        {tx.status === 'failed' && onRetry && (
                          <button
                            type="button"
                            onClick={() => onRetry(tx.id)}
                            className="text-xs"
                            style={{ color: 'rgb(var(--primary))' }}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
