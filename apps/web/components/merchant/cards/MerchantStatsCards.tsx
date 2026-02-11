'use client'

import { Card, CardContent } from '@/components/common/Card'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
}

function StatCard({ title, value, change, changeLabel, icon }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.1)',
            color: 'rgb(var(--primary))',
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {title}
          </p>
          <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {value}
          </p>
          {change !== undefined && (
            <p
              className="text-sm"
              style={{ color: isPositive ? 'rgb(var(--success))' : 'rgb(var(--destructive))' }}
            >
              {isPositive ? '+' : ''}
              {change}% {changeLabel || 'from last month'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface MerchantStatsCardsProps {
  stats: {
    totalRevenue: number
    revenueChange: number
    activeSubscriptions: number
    subscriptionChange: number
    successfulPayments: number
    paymentSuccessRate: number
    avgTransactionValue: number
    avgValueChange: number
  }
}

export function MerchantStatsCards({ stats }: MerchantStatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Revenue"
        value={formatCurrency(stats.totalRevenue)}
        change={stats.revenueChange}
        icon={
          <svg
            aria-hidden="true"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      />
      <StatCard
        title="Active Subscriptions"
        value={stats.activeSubscriptions.toLocaleString()}
        change={stats.subscriptionChange}
        icon={
          <svg
            aria-hidden="true"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
      />
      <StatCard
        title="Successful Payments"
        value={stats.successfulPayments.toLocaleString()}
        change={stats.paymentSuccessRate}
        changeLabel="success rate"
        icon={
          <svg
            aria-hidden="true"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      />
      <StatCard
        title="Avg Transaction"
        value={formatCurrency(stats.avgTransactionValue)}
        change={stats.avgValueChange}
        icon={
          <svg
            aria-hidden="true"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        }
      />
    </div>
  )
}
