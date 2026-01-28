'use client'

import { type FC } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../common/Card'
import { Button } from '../common/Button'
import type { PlanDisplayInfo } from '../../types/subscription'
import { cn } from '../../lib/utils'

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
      className={cn(
        'flex flex-col h-full transition-all',
        featured && 'border-primary-500 shadow-md ring-2 ring-primary-100',
        !isSubscribed && 'hover:shadow-md hover:border-primary-200',
        className
      )}
    >
      <CardHeader className="text-center pb-2">
        {featured && (
          <div className="inline-flex items-center justify-center px-3 py-1 mb-2 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
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
            <span className="text-4xl font-bold text-gray-900">{plan.priceFormatted.split(' ')[0]}</span>
            <span className="text-lg text-gray-500">{plan.tokenSymbol}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{plan.intervalFormatted}</p>
        </div>

        {/* Features */}
        <div className="space-y-3">
          {plan.trialPeriod > 0n && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-600">
                {Number(plan.trialPeriod) / 86400} day free trial
              </span>
            </div>
          )}

          {plan.gracePeriod > 0n && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-600">
                {Number(plan.gracePeriod) / 86400} day grace period
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-600">Cancel anytime</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-600">Automatic payments via ERC-7715</span>
          </div>
        </div>

        {/* Subscriber count */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            {Number(plan.subscriberCount).toLocaleString()} subscribers
          </p>
        </div>

        {showMerchant && (
          <div className="mt-2 text-xs text-gray-400 text-center font-mono">
            by {plan.merchant.slice(0, 6)}...{plan.merchant.slice(-4)}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {isSubscribed ? (
          <Button variant="secondary" className="w-full" disabled>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
