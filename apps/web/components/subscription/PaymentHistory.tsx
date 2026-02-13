'use client'

import type { FC } from 'react'
import { formatUnits } from 'viem'
import { useChainId } from 'wagmi'
import { formatAddress, getBlockExplorerUrl } from '../../lib/utils'
import type { PaymentHistoryEntry } from '../../types/subscription'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'

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
                <div
                  className="w-10 h-10 rounded-full"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 rounded w-1/3"
                    style={{ backgroundColor: 'rgb(var(--secondary))' }}
                  />
                  <div
                    className="h-3 rounded w-1/4"
                    style={{ backgroundColor: 'rgb(var(--secondary))' }}
                  />
                </div>
                <div
                  className="h-4 rounded w-20"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
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
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <svg
              aria-hidden="true"
              className="w-6 h-6"
              style={{ color: 'rgb(var(--muted-foreground))' }}
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
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>No payment history yet</p>
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
        <div className="divide-y" style={{ borderColor: 'rgb(var(--border) / 0.5)' }}>
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
  const chainId = useChainId()
  const tokenInfo = TOKEN_INFO[payment.token.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 }
  const amountFormatted = formatUnits(payment.amount, tokenInfo.decimals)
  const date = new Date(Number(payment.timestamp) * 1000)

  return (
    <div className="flex items-center justify-between px-6 py-4 transition-colors hover:opacity-80">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            backgroundColor:
              payment.status === 'success'
                ? 'rgb(var(--success) / 0.1)'
                : 'rgb(var(--destructive) / 0.1)',
          }}
        >
          {payment.status === 'success' ? (
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              style={{ color: 'rgb(var(--success))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              style={{ color: 'rgb(var(--destructive))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Subscription Payment #{payment.subscriptionId.toString()}
          </p>
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            <span>{date.toLocaleDateString()}</span>
            <span>&middot;</span>
            <a
              href={getBlockExplorerUrl(chainId, { txHash: payment.txHash })}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: 'rgb(var(--primary))' }}
            >
              {formatAddress(payment.txHash, 8)}
            </a>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p
          className="font-semibold"
          style={{
            color:
              payment.status === 'success' ? 'rgb(var(--foreground))' : 'rgb(var(--destructive))',
          }}
        >
          {payment.status === 'success' ? '-' : ''}
          {amountFormatted} {tokenInfo.symbol}
        </p>
        <p className="text-sm capitalize" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {payment.status}
        </p>
      </div>
    </div>
  )
}

export default PaymentHistory
