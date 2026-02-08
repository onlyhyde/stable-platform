'use client'

import type { FC } from 'react'
import { cn } from '../../lib/utils'
import type { SubscriptionDisplayInfo } from '../../types/subscription'
import { Button } from '../common/Button'
import { Card, CardContent } from '../common/Card'

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
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <svg
              aria-hidden="true"
              className="w-8 h-8"
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
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>{emptyMessage}</p>
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

  // Status colors using CSS variables for dark mode compatibility
  const getStatusStyles = (color: string): React.CSSProperties => {
    switch (color) {
      case 'green':
        return { backgroundColor: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' }
      case 'blue':
        return { backgroundColor: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' }
      case 'yellow':
        return { backgroundColor: 'rgb(255 193 7 / 0.1)', color: 'rgb(202 138 4)' }
      case 'gray':
        return { backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--muted-foreground))' }
      case 'red':
        return {
          backgroundColor: 'rgb(var(--destructive) / 0.1)',
          color: 'rgb(var(--destructive))',
        }
      default:
        return { backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--muted-foreground))' }
    }
  }

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          {/* Left: Plan info */}
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                {plan.name}
              </h3>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {plan.priceFormatted} / {plan.intervalFormatted.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Center: Status & Next payment */}
          <div className="hidden md:flex flex-col items-center gap-1">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={getStatusStyles(statusColor)}
            >
              {statusLabel}
            </span>
            {status !== 'cancelled' && status !== 'expired' && (
              <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
                style={{ color: 'rgb(var(--destructive))' }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Mobile: Status row */}
        <div
          className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t"
          style={{ borderColor: 'rgb(var(--border) / 0.5)' }}
        >
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={getStatusStyles(statusColor)}
          >
            {statusLabel}
          </span>
          {status !== 'cancelled' && status !== 'expired' && (
            <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Next payment: {nextPaymentFormatted}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default SubscriptionList
