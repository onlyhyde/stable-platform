'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/common/Button'
import { Card, CardContent } from '../../../components/common/Card'
import { useToast } from '../../../components/common/Toast'
import { PermissionModal } from '../../../components/subscription/PermissionModal'
import { SubscriptionPlanCard } from '../../../components/subscription/SubscriptionPlanCard'
import { useSubscription } from '../../../hooks/useSubscription'
import { useWallet } from '../../../hooks/useWallet'
import type { PlanDisplayInfo } from '../../../types/subscription'

export default function PlansPage() {
  const router = useRouter()
  const { isConnected } = useWallet()
  const {
    plans,
    mySubscriptions,
    isLoading,
    isSubscribing,
    loadPlans,
    loadMySubscriptions,
    subscribe,
    error,
  } = useSubscription()

  const { addToast } = useToast()
  const [selectedPlan, setSelectedPlan] = useState<PlanDisplayInfo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    loadPlans()
    if (isConnected) {
      loadMySubscriptions()
    }
  }, [loadPlans, loadMySubscriptions, isConnected])

  const subscribedPlanIds = new Set(mySubscriptions.map((s) => s.planId.toString()))

  const handleSubscribeClick = (plan: PlanDisplayInfo) => {
    if (!isConnected) {
      addToast({ type: 'info', title: 'Connect your wallet to subscribe' })
      return
    }
    setSelectedPlan(plan)
    setIsModalOpen(true)
  }

  const handleConfirmSubscribe = async (planId: bigint) => {
    await subscribe(planId)
    await loadMySubscriptions()
    setIsModalOpen(false)
    setSelectedPlan(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Browse Plans
          </h1>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>
            Discover subscription services powered by ERC-7715
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/subscription')}>
          <svg
            aria-hidden="true"
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          My Subscriptions
        </Button>
      </div>

      {/* Info Banner */}
      <Card
        className="border-0"
        style={{
          background: 'linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-hover)))',
        }}
      >
        <CardContent className="py-6">
          <div className="flex items-center gap-6">
            <div className="hidden md:flex w-16 h-16 rounded-full items-center justify-center bg-white/20">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div className="text-white">
              <h2 className="text-lg font-semibold mb-1">Secure On-Chain Subscriptions</h2>
              <p className="text-white/80 text-sm">
                All subscriptions use ERC-7715 permissions for secure, transparent recurring
                payments. You maintain full control and can cancel anytime.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Connection Banner */}
      {!isConnected && (
        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.05)',
            borderColor: 'rgb(var(--primary) / 0.2)',
          }}
        >
          <p style={{ color: 'rgb(var(--foreground))' }}>
            <strong>Connect your wallet</strong> to subscribe to plans
          </p>
        </div>
      )}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-96 animate-pulse">
              <CardContent className="h-full flex flex-col items-center justify-center gap-4">
                <div
                  className="w-24 h-24 rounded-full"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
                <div
                  className="h-6 rounded w-1/2"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
                <div
                  className="h-4 rounded w-3/4"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
                <div
                  className="h-10 rounded w-2/3 mt-auto"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <svg
                aria-hidden="true"
                className="w-10 h-10"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              No Plans Available
            </h3>
            <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
              There are no subscription plans available at the moment. Check back later or create
              your own as a merchant!
            </p>
            <Button variant="primary" onClick={() => router.push('/subscription/merchant')}>
              Create a Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <SubscriptionPlanCard
              key={plan.id.toString()}
              plan={plan}
              onSubscribe={() => handleSubscribeClick(plan)}
              isSubscribing={isSubscribing && selectedPlan?.id === plan.id}
              isSubscribed={subscribedPlanIds.has(plan.id.toString())}
              featured={index === 1} // Middle plan is featured
              showMerchant
            />
          ))}
        </div>
      )}

      {error && (
        <div
          className="rounded-lg p-4 text-sm border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
            color: 'rgb(var(--destructive))',
          }}
        >
          {error.message}
        </div>
      )}

      {/* Permission Modal */}
      <PermissionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPlan(null)
        }}
        plan={selectedPlan}
        onConfirm={handleConfirmSubscribe}
        isLoading={isSubscribing}
      />
    </div>
  )
}
