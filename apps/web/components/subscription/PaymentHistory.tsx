'use client'

import { type FC } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import type { PaymentHistoryEntry } from '../../types/subscription'
import { cn, formatAddress } from '../../lib/utils'
import { formatUnits } from 'viem'

interface PaymentHistoryProps {
  payments: PaymentHistoryEntry[]
  isLoading?: boolean
  className?: string
}

// Token info for display
const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
  '0x322813fd9a801c5507c9de605d63cea4f2ce6c44': { symbol: 'USDC', decimals: 6 },
}

export const PaymentHistory: FC<PaymentHistoryProps> = ({
  payments,
  isLoading = false,
  className,
}) => {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (payments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-gray-400"
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
          </div>
          <p className="text-gray-500">No payment history yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {payments.map((payment, index) => (
            <PaymentHistoryItem key={`${payment.txHash}-${index}`} payment={payment} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface PaymentHistoryItemProps {
  payment: PaymentHistoryEntry
}

const PaymentHistoryItem: FC<PaymentHistoryItemProps> = ({ payment }) => {
  const tokenInfo = TOKEN_INFO[payment.token.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 }
  const amountFormatted = formatUnits(payment.amount, tokenInfo.decimals)
  const date = new Date(Number(payment.timestamp) * 1000)

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            payment.status === 'success' ? 'bg-green-100' : 'bg-red-100'
          )}
        >
          {payment.status === 'success' ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">
            Subscription Payment #{payment.subscriptionId.toString()}
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{date.toLocaleDateString()}</span>
            <span>&middot;</span>
            <a
              href={`https://etherscan.io/tx/${payment.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              {formatAddress(payment.txHash, 8)}
            </a>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('font-semibold', payment.status === 'success' ? 'text-gray-900' : 'text-red-600')}>
          {payment.status === 'success' ? '-' : ''}{amountFormatted} {tokenInfo.symbol}
        </p>
        <p className="text-sm text-gray-500 capitalize">{payment.status}</p>
      </div>
    </div>
  )
}

export default PaymentHistory
