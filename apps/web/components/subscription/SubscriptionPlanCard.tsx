'use client'

import type { FC } from 'react'
import { cn } from '../../lib/utils'
import type { PlanDisplayInfo } from '../../types/subscription'
import { Button } from '../common/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../common/Card'

interface SubscriptionPlanCardProps {
  plan: PlanDisplayInfo
  onSubscribe?: (planId: bigint) => void
  isSubscribing?: boolean
  isSubscribed?: boolean
  className?: string
  showMerchant?: boolean
  featured?: boolean
}

export const SubscriptionPlanCard: FC<SubscriptionPlanCardProps> = ({
  plan,
  onSubscribe,
  isSubscribing = false,
  isSubscribed = false,
  className,
  showMerchant = false,
  featured = false,
}) => {
  const handleSubscribe = () => {
    if (onSubscribe && !isSubscribed && !isSubscribing) {
      onSubscribe(plan.id)
    }
  }

  return (
    <Card
      className={cn('flex flex-col h-full transition-all hover:shadow-md', className)}
      style={{
        borderColor: featured ? 'rgb(var(--primary))' : undefined,
        boxShadow: featured ? '0 0 0 2px rgb(var(--primary) / 0.1)' : undefined,
      }}
    >
      <CardHeader className="text-center pb-2">
        {featured && (
          <div
            className="inline-flex items-center justify-center px-3 py-1 mb-2 text-xs font-medium rounded-full"
            style={{ backgroundColor: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' }}
          >
            Popular
          </div>
        )}
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription className="mt-1">{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {plan.priceFormatted.split(' ')[0]}
            </span>
            <span className="text-lg" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {plan.tokenSymbol}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {plan.intervalFormatted}
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3">
          {plan.trialPeriod > 0n && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                aria-hidden="true"
                className="w-5 h-5 flex-shrink-0"
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
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                {Number(plan.trialPeriod) / 86400} day free trial
              </span>
            </div>
          )}

          {plan.gracePeriod > 0n && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                aria-hidden="true"
                className="w-5 h-5 flex-shrink-0"
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
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                {Number(plan.gracePeriod) / 86400} day grace period
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <svg
              aria-hidden="true"
              className="w-5 h-5 flex-shrink-0"
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
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Cancel anytime</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <svg
              aria-hidden="true"
              className="w-5 h-5 flex-shrink-0"
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
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>
              Automatic payments via ERC-7715
            </span>
          </div>
        </div>

        {/* Subscriber count */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(var(--border) / 0.5)' }}>
          <p
            className="text-xs text-center"
            style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}
          >
            {Number(plan.subscriberCount).toLocaleString()} subscribers
          </p>
        </div>

        {showMerchant && (
          <div
            className="mt-2 text-xs text-center font-mono"
            style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}
          >
            by {plan.merchant.slice(0, 6)}...{plan.merchant.slice(-4)}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {isSubscribed ? (
          <Button variant="secondary" className="w-full" disabled>
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            Subscribed
          </Button>
        ) : (
          <Button
            variant={featured ? 'primary' : 'secondary'}
            className="w-full"
            onClick={handleSubscribe}
            isLoading={isSubscribing}
          >
            {plan.trialPeriod > 0n ? 'Start Free Trial' : 'Subscribe'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default SubscriptionPlanCard
