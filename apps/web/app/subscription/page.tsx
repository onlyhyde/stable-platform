'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { Button } from '../../components/common/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/common/Card'
import { PaymentHistory } from '../../components/subscription/PaymentHistory'
import { SubscriptionList } from '../../components/subscription/SubscriptionList'
import { useSubscription } from '../../hooks/useSubscription'
import { useWallet } from '../../hooks/useWallet'
import type { PaymentHistoryEntry } from '../../types/subscription'

export default function SubscriptionPage() {
  const router = useRouter()
  const { isConnected, address } = useWallet()
  const {
    mySubscriptions,
    isLoading,
    isCancelling,
    loadMySubscriptions,
    cancelSubscription,
    error,
  } = useSubscription()

  const [cancellingPlanId, setCancellingPlanId] = useState<bigint | null>(null)

  // Payment history (in production, this would come from events/indexer)
  const [paymentHistory] = useState<PaymentHistoryEntry[]>([])

  // Calculate total spent from active subscriptions
  const totalSpent = useMemo(() => {
    if (mySubscriptions.length === 0) return '-'
    // Sum up all plan prices for subscriptions that have had at least one payment
    const total = mySubscriptions.reduce((sum, sub) => {
      if (sub.lastPaymentTime > 0n) {
        return sum + sub.plan.price
      }
      return sum
    }, BigInt(0))
    if (total === BigInt(0)) return '-'
    // Use the first subscription's token decimals (assumes same token)
    const decimals = mySubscriptions[0]?.plan.tokenDecimals ?? 18
    const symbol = mySubscriptions[0]?.plan.tokenSymbol ?? ''
    return `${formatUnits(total, decimals)} ${symbol}`.trim()
  }, [mySubscriptions])

  useEffect(() => {
    if (isConnected && address) {
      loadMySubscriptions()
    }
  }, [isConnected, address, loadMySubscriptions])

  const handleCancel = async (planId: bigint) => {
    setCancellingPlanId(planId)
    try {
      await cancelSubscription(planId)
      await loadMySubscriptions()
    } finally {
      setCancellingPlanId(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                aria-hidden="true"
                className="w-8 h-8"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Connect Your Wallet
            </h2>
            <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Connect your wallet to view and manage your subscriptions
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            My Subscriptions
          </h1>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>
            Manage your active subscriptions and payment history
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push('/subscription/plans')}>
          <svg
            aria-hidden="true"
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Browse Plans
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
              >
                <svg
                  aria-hidden="true"
                  className="w-6 h-6"
                  style={{ color: 'rgb(var(--success))' }}
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
              </div>
              <div>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Active Subscriptions
                </p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                  {
                    mySubscriptions.filter((s) => s.status === 'active' || s.status === 'trial')
                      .length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--warning) / 0.1)' }}
              >
                <svg
                  aria-hidden="true"
                  className="w-6 h-6"
                  style={{ color: 'rgb(var(--warning))' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Upcoming Payments
                </p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                  {mySubscriptions.filter((s) => s.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
              >
                <svg
                  aria-hidden="true"
                  className="w-6 h-6"
                  style={{ color: 'rgb(var(--primary))' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Total Spent
                </p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                  {totalSpent}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscriptions List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>Your current recurring payments</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg"
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
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  <SubscriptionList
                    subscriptions={mySubscriptions}
                    onCancel={handleCancel}
                    onManage={(planId) => {
                      router.push(`/subscription/plans?planId=${planId.toString()}`)
                    }}
                    isCancelling={isCancelling}
                    cancellingPlanId={cancellingPlanId}
                    emptyMessage="No active subscriptions. Browse plans to get started!"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <div
              className="mt-4 rounded-lg p-4 text-sm border"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                borderColor: 'rgb(var(--destructive) / 0.3)',
                color: 'rgb(var(--destructive))',
              }}
            >
              {error.message}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div className="lg:col-span-1">
          <PaymentHistory payments={paymentHistory} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          hover
          onClick={() => router.push('/subscription/plans')}
        >
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
              >
                <svg
                  aria-hidden="true"
                  className="w-6 h-6"
                  style={{ color: 'rgb(var(--primary))' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  Browse Plans
                </h3>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Discover new subscription services
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          hover
          onClick={() => router.push('/subscription/merchant')}
        >
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
              >
                <svg
                  aria-hidden="true"
                  className="w-6 h-6"
                  style={{ color: 'rgb(var(--success))' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  Merchant Dashboard
                </h3>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Create and manage subscription plans
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
