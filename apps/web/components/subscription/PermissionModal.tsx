'use client'

import { type FC, useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import type { PlanDisplayInfo } from '../../types/subscription'
import { cn } from '../../lib/utils'

interface PermissionModalProps {
  isOpen: boolean
  onClose: () => void
  plan: PlanDisplayInfo | null
  onConfirm: (planId: bigint) => Promise<void>
  isLoading?: boolean
}

type PermissionStep = 'review' | 'requesting_permission' | 'subscribing' | 'success'

export const PermissionModal: FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  plan,
  onConfirm,
  isLoading = false,
}) => {
  const [step, setStep] = useState<PermissionStep>('review')
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!plan) return

    setStep('requesting_permission')
    setError(null)

    try {
      // The onConfirm now handles:
      // 1. ERC-7715 permission request (wallet_grantPermissions)
      // 2. Subscribe transaction with permissionId
      // We track this as two conceptual steps for better UX

      // Short delay to show permission step before it transitions
      setTimeout(() => {
        if (step === 'requesting_permission') {
          setStep('subscribing')
        }
      }, 1500)

      await onConfirm(plan.id)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete subscription')
      setStep('review')
    }
  }

  const handleClose = () => {
    setStep('review')
    setError(null)
    onClose()
  }

  if (!plan) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? 'Subscription Confirmed!' : 'Confirm Subscription'}
      size="md"
    >
      <div className="space-y-6">
        {step === 'review' && (
          <>
            {/* Plan Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold text-gray-900">{plan.priceFormatted}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">Frequency</span>
                <span className="text-gray-900">{plan.intervalFormatted}</span>
              </div>
              {plan.trialPeriod > 0n && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-600">Free trial</span>
                  <span className="text-green-600">{Number(plan.trialPeriod) / 86400} days</span>
                </div>
              )}
            </div>

            {/* Permission Details */}
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h4 className="font-medium text-yellow-800">Permission Request (ERC-7715)</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You are granting permission for automatic recurring payments. This allows the
                    subscription manager to charge your account {plan.priceFormatted}{' '}
                    {plan.intervalFormatted.toLowerCase()}.
                  </p>
                </div>
              </div>
            </div>

            {/* What you're agreeing to */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">What you&apos;re agreeing to:</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Automatic payments of {plan.priceFormatted} every {plan.intervalFormatted.toLowerCase()}</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Permission can be revoked at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Payments are processed on-chain with full transparency</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleConfirm} isLoading={isLoading}>
                Confirm & Subscribe
              </Button>
            </div>
          </>
        )}

        {(step === 'requesting_permission' || step === 'subscribing') && (
          <div className="text-center py-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === 'requesting_permission'
                  ? "bg-primary-600 text-white"
                  : "bg-green-600 text-white"
              )}>
                {step === 'requesting_permission' ? '1' : '✓'}
              </div>
              <div className={cn(
                "w-12 h-1 rounded",
                step === 'subscribing' ? "bg-primary-600" : "bg-gray-200"
              )} />
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === 'subscribing'
                  ? "bg-primary-600 text-white"
                  : "bg-gray-200 text-gray-500"
              )}>
                2
              </div>
            </div>

            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            {step === 'requesting_permission' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Requesting Permission (ERC-7715)
                </h3>
                <p className="text-gray-500">
                  Please approve the permission request in your wallet to allow recurring payments
                </p>
              </>
            )}

            {step === 'subscribing' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirming Subscription
                </h3>
                <p className="text-gray-500">
                  Please confirm the subscription transaction in your wallet
                </p>
              </>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Successfully Subscribed!</h3>
            <p className="text-gray-500 mb-6">
              You are now subscribed to {plan.name}. Your first payment will be processed{' '}
              {plan.trialPeriod > 0n ? `after your ${Number(plan.trialPeriod) / 86400}-day trial` : 'immediately'}.
            </p>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default PermissionModal
