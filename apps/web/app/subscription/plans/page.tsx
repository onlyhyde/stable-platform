'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { SubscriptionPlanCard } from '../../../components/subscription/SubscriptionPlanCard'
import { PermissionModal } from '../../../components/subscription/PermissionModal'
import { useWallet } from '../../../hooks/useWallet'
import { useSubscription } from '../../../hooks/useSubscription'
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
      // Would trigger connect wallet modal
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
          <h1 className="text-2xl font-bold text-gray-900">Browse Plans</h1>
          <p className="text-gray-500">Discover subscription services powered by ERC-7715</p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/subscription')}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My Subscriptions
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-primary-500 to-primary-600 border-0">
        <CardContent className="py-6">
          <div className="flex items-center gap-6">
            <div className="hidden md:flex w-16 h-16 rounded-full bg-white/20 items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                All subscriptions use ERC-7715 permissions for secure, transparent recurring payments.
                You maintain full control and can cancel anytime.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-96 animate-pulse">
              <CardContent className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-full" />
                <div className="h-6 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-10 bg-gray-200 rounded w-2/3 mt-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Available</h3>
            <p className="text-gray-500 mb-6">
              There are no subscription plans available at the moment.
              Check back later or create your own as a merchant!
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
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
