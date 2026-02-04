import { useWalletStore, useNetworkCurrency } from '../hooks'
import { formatEther } from 'viem'

export function Activity() {
  const { pendingTransactions, history } = useWalletStore()

  const allTransactions = [...pendingTransactions, ...history].sort(
    (a, b) => b.timestamp - a.timestamp
  )

  if (allTransactions.length === 0) {
    return (
      <div className="p-4">
        <h2
          className="text-xl font-bold mb-6"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          Activity
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
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>No transactions yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: 'rgb(var(--foreground))' }}
      >
        Activity
      </h2>

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
  const { symbol: currencySymbol } = useNetworkCurrency()
  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
    submitted: { bg: 'rgb(var(--info) / 0.1)', color: 'rgb(var(--info))' },
    confirmed: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
    failed: { bg: 'rgb(var(--destructive) / 0.1)', color: 'rgb(var(--destructive))' },
  }

  const statusStyle = statusStyles[transaction.status] ?? {
    bg: 'rgb(var(--secondary))',
    color: 'rgb(var(--muted-foreground))',
  }

  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>Send</p>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              To: {formatAddress(transaction.to)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
            -{Number(formatEther(transaction.value)).toFixed(4)} {currencySymbol}
          </p>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {transaction.status}
          </span>
        </div>
      </div>
      <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {new Date(transaction.timestamp).toLocaleString()}
      </p>
    </div>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
