import type { OnRampOrder } from '../../../types'
import { Badge, Card } from '../common'

interface OrderCardProps {
  order: OnRampOrder
  onViewDetails?: () => void
  onCancel?: () => void
}

export function OrderCard({ order, onViewDetails, onCancel }: OrderCardProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatCrypto = (amount: string, symbol: string) => {
    return `${Number.parseFloat(amount).toFixed(6)} ${symbol}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusConfig = (status: OnRampOrder['status']) => {
    switch (status) {
      case 'pending':
        return { variant: 'warning' as const, label: 'Pending Payment' }
      case 'processing':
        return { variant: 'info' as const, label: 'Processing' }
      case 'completed':
        return { variant: 'success' as const, label: 'Completed' }
      case 'failed':
        return { variant: 'error' as const, label: 'Failed' }
      case 'cancelled':
        return { variant: 'default' as const, label: 'Cancelled' }
      case 'refunded':
        return { variant: 'default' as const, label: 'Refunded' }
      default:
        return { variant: 'default' as const, label: status }
    }
  }

  const statusConfig = getStatusConfig(order.status)

  const getPaymentMethodLabel = (method: OnRampOrder['paymentMethod']) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer'
      case 'card':
        return 'Card Payment'
      case 'wire':
        return 'Wire Transfer'
      default:
        return method
    }
  }

  return (
    <Card padding="md" variant="outline">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">
            {formatCrypto(order.cryptoAmount, order.cryptoCurrency)}
          </p>
        </div>
        <Badge variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Amount Paid</span>
          <span className="text-gray-700">
            {formatCurrency(order.totalFiatAmount, order.fiatCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Payment Method</span>
          <span className="text-gray-700">{getPaymentMethodLabel(order.paymentMethod)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Created</span>
          <span className="text-gray-700">{formatDate(order.createdAt)}</span>
        </div>
        {order.txHash && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Tx Hash</span>
            <span className="text-gray-700 font-mono">
              {order.txHash.slice(0, 8)}...{order.txHash.slice(-6)}
            </span>
          </div>
        )}
        {order.failureReason && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
            {order.failureReason}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-xs text-indigo-600 hover:text-indigo-700"
          >
            View Details
          </button>
        )}
        {onCancel && (order.status === 'pending' || order.status === 'processing') && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Cancel
          </button>
        )}
      </div>
    </Card>
  )
}
