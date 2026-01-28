'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { CreatePlanForm } from '../../../components/subscription/CreatePlanForm'
import { useWallet } from '../../../hooks/useWallet'
import { useSubscription } from '../../../hooks/useSubscription'
import type { CreatePlanParams, PlanDisplayInfo } from '../../../types/subscription'
import { cn } from '../../../lib/utils'

export default function MerchantDashboardPage() {
  const router = useRouter()
  const { isConnected, address } = useWallet()
  const {
    merchantPlans,
    merchantStats,
    isLoading,
    isCreatingPlan,
    loadMerchantPlans,
    createPlan,
    error,
  } = useSubscription()

  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (isConnected && address) {
      loadMerchantPlans()
    }
  }, [isConnected, address, loadMerchantPlans])

  const handleCreatePlan = async (params: CreatePlanParams) => {
    await createPlan(params)
    await loadMerchantPlans()
    setShowCreateForm(false)
  }

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect to Continue</h2>
            <p className="text-gray-500 mb-6">
              Connect your wallet to access the merchant dashboard
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
          <h1 className="text-2xl font-bold text-gray-900">Merchant Dashboard</h1>
          <p className="text-gray-500">Create and manage your subscription plans</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/subscription')}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <Button variant="primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Plan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {merchantStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Plans</p>
                <p className="text-3xl font-bold text-gray-900">{merchantStats.totalPlans}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Subscribers</p>
                <p className="text-3xl font-bold text-gray-900">{merchantStats.totalSubscribers}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Active Subscribers</p>
                <p className="text-3xl font-bold text-green-600">{merchantStats.activeSubscribers}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Monthly Revenue</p>
                <p className="text-3xl font-bold text-primary-600">-</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Plan Form */}
      {showCreateForm && (
        <CreatePlanForm onSubmit={handleCreatePlan} isLoading={isCreatingPlan} />
      )}

      {/* Plans List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Plans</CardTitle>
          <CardDescription>Manage your subscription plans</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : merchantPlans.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">You haven&apos;t created any plans yet</p>
              <Button variant="primary" onClick={() => setShowCreateForm(true)}>
                Create Your First Plan
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {merchantPlans.map((plan) => (
                <MerchantPlanRow key={plan.id.toString()} plan={plan} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          {error.message}
        </div>
      )}
    </div>
  )
}

interface MerchantPlanRowProps {
  plan: PlanDisplayInfo
}

function MerchantPlanRow({ plan }: MerchantPlanRowProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center',
          plan.isActive ? 'bg-green-100' : 'bg-gray-100'
        )}>
          <svg
            className={cn('w-6 h-6', plan.isActive ? 'text-green-600' : 'text-gray-400')}
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
          <h3 className="font-semibold text-gray-900">{plan.name}</h3>
          <p className="text-sm text-gray-500">
            {plan.priceFormatted} / {plan.intervalFormatted.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <div className="text-center">
          <p className="text-sm text-gray-500">Subscribers</p>
          <p className="font-semibold text-gray-900">{Number(plan.subscriberCount)}</p>
        </div>

        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          )}
        >
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
          {plan.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}
