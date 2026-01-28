'use client'

import { type FC } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import { Button } from '../common/Button'
import type { SubscriptionDisplayInfo } from '../../types/subscription'
import { cn } from '../../lib/utils'

interface SubscriptionListProps {
  subscriptions: SubscriptionDisplayInfo[]
  onCancel?: (planId: bigint) => void
  onManage?: (planId: bigint) => void
  isCancelling?: boolean
  cancellingPlanId?: bigint | null
  className?: string
  emptyMessage?: string
}

export const SubscriptionList: FC<SubscriptionListProps> = ({
  subscriptions,
  onCancel,
  onManage,
  isCancelling = false,
  cancellingPlanId = null,
  className,
  emptyMessage = 'No active subscriptions',
}) => {
  if (subscriptions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
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
          <p className="text-gray-500">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {subscriptions.map((subscription) => (
        <SubscriptionListItem
          key={subscription.planId.toString()}
          subscription={subscription}
          onCancel={onCancel}
          onManage={onManage}
          isCancelling={isCancelling && cancellingPlanId === subscription.planId}
        />
      ))}
    </div>
  )
}

interface SubscriptionListItemProps {
  subscription: SubscriptionDisplayInfo
  onCancel?: (planId: bigint) => void
  onManage?: (planId: bigint) => void
  isCancelling?: boolean
}

const SubscriptionListItem: FC<SubscriptionListItemProps> = ({
  subscription,
  onCancel,
  onManage,
  isCancelling = false,
}) => {
  const { plan, status, statusLabel, statusColor, nextPaymentFormatted } = subscription

  const statusClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
  }

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          {/* Left: Plan info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Center: Status & Next payment */}
          <div className="hidden md:flex flex-col items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusClasses[statusColor]
              )}
            >
              {statusLabel}
            </span>
            {status !== 'cancelled' && status !== 'expired' && (
              <span className="text-xs text-gray-500">
                Next: {nextPaymentFormatted}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {onManage && (
              <Button variant="ghost" size="sm" onClick={() => onManage(subscription.planId)}>
                Manage
              </Button>
            )}
            {onCancel && status !== 'cancelled' && status !== 'expired' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancel(subscription.planId)}
                isLoading={isCancelling}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Mobile: Status row */}
        <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusClasses[statusColor]
            )}
          >
            {statusLabel}
          </span>
          {status !== 'cancelled' && status !== 'expired' && (
            <span className="text-xs text-gray-500">
              Next payment: {nextPaymentFormatted}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default SubscriptionList
