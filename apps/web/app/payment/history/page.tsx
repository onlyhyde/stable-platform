'use client'

import { useWallet } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { formatAddress, formatRelativeTime } from '@/lib/utils'
import type { Transaction } from '@/types'

// Mock transactions for demo
const mockTransactions: Transaction[] = []

export default function HistoryPage() {
  const { isConnected } = useWallet()

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to view history</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
        <p className="text-gray-500">View your past transactions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {mockTransactions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
              <p className="text-gray-500">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Your transaction history will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {mockTransactions.map((tx) => (
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
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <div className="py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-primary-600"
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
          <p className="font-medium text-gray-900">
            To: {formatAddress(transaction.to)}
          </p>
          <p className="text-sm text-gray-500">
            {formatRelativeTime(transaction.timestamp)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900">
          -{(Number(transaction.value) / 1e18).toFixed(4)} ETH
        </p>
        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[transaction.status]}`}>
          {transaction.status}
        </span>
      </div>
    </div>
  )
}
