
import { useWalletStore } from '../hooks/useWalletStore'
import { formatEther } from 'viem'

export function Activity() {
  const { pendingTransactions, history } = useWalletStore()

  const allTransactions = [...pendingTransactions, ...history].sort(
    (a, b) => b.timestamp - a.timestamp
  )

  if (allTransactions.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-6">Activity</h2>
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
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Activity</h2>

      <div className="space-y-3">
        {allTransactions.map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  )
}

interface TransactionItemProps {
  transaction: {
    id: string
    from: string
    to: string
    value: bigint
    status: string
    timestamp: number
    txHash?: string
  }
}

function TransactionItem({ transaction }: TransactionItemProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  const statusColor = statusColors[transaction.status as keyof typeof statusColors] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600"
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
            <p className="font-medium text-sm">Send</p>
            <p className="text-xs text-gray-500">
              To: {formatAddress(transaction.to)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-sm">
            -{Number(formatEther(transaction.value)).toFixed(4)} ETH
          </p>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
            {transaction.status}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {new Date(transaction.timestamp).toLocaleString()}
      </p>
    </div>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
