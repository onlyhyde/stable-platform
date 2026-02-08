'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import type { PlanDisplayInfo } from '../../types/subscription'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

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
  // Use ref to track current step for setTimeout callback (avoids stale closure)
  const stepRef = useRef<PermissionStep>(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

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
      // Use stepRef.current to avoid stale closure issue
      setTimeout(() => {
        if (stepRef.current === 'requesting_permission') {
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
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
                {plan.name}
              </h3>
              <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {plan.description}
              </p>
              <div
                className="flex justify-between items-center pt-3 border-t"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Amount</span>
                <span className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {plan.priceFormatted}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Frequency</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>{plan.intervalFormatted}</span>
              </div>
              {plan.trialPeriod > 0n && (
                <div className="flex justify-between items-center mt-2">
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>Free trial</span>
                  <span style={{ color: 'rgb(var(--success))' }}>
                    {Number(plan.trialPeriod) / 86400} days
                  </span>
                </div>
              )}
            </div>

            {/* Permission Details */}
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
              <div className="flex gap-3">
                <svg
                  aria-hidden="true"
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
              <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                What you&apos;re agreeing to:
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                <li className="flex items-start gap-2">
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 mt-0.5"
                    style={{ color: 'rgb(var(--success))' }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Automatic payments of {plan.priceFormatted} every{' '}
                    {plan.intervalFormatted.toLowerCase()}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 mt-0.5"
                    style={{ color: 'rgb(var(--success))' }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Permission can be revoked at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 mt-0.5"
                    style={{ color: 'rgb(var(--success))' }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
              <div
                className="border rounded-lg p-3 text-sm"
                style={{
                  backgroundColor: 'rgb(var(--destructive) / 0.1)',
                  borderColor: 'rgb(var(--destructive) / 0.3)',
                  color: 'rgb(var(--destructive))',
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirm}
                isLoading={isLoading}
              >
                Confirm & Subscribe
              </Button>
            </div>
          </>
        )}

        {(step === 'requesting_permission' || step === 'subscribing') && (
          <div className="text-center py-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                style={{
                  backgroundColor:
                    step === 'requesting_permission'
                      ? 'rgb(var(--primary))'
                      : 'rgb(var(--success))',
                }}
              >
                {step === 'requesting_permission' ? '1' : '✓'}
              </div>
              <div
                className="w-12 h-1 rounded"
                style={{
                  backgroundColor:
                    step === 'subscribing' ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                }}
              />
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  backgroundColor:
                    step === 'subscribing' ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                  color: step === 'subscribing' ? 'white' : 'rgb(var(--muted-foreground))',
                }}
              >
                2
              </div>
            </div>

            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                aria-hidden="true"
                className="w-8 h-8 animate-spin"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                viewBox="0 0 24 24"
              >
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
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Requesting Permission (ERC-7715)
                </h3>
                <p style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Please approve the permission request in your wallet to allow recurring payments
                </p>
              </>
            )}

            {step === 'subscribing' && (
              <>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Confirming Subscription
                </h3>
                <p style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Please confirm the subscription transaction in your wallet
                </p>
              </>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
            >
              <svg
                aria-hidden="true"
                className="w-8 h-8"
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
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Successfully Subscribed!
            </h3>
            <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
              You are now subscribed to {plan.name}. Your first payment will be processed{' '}
              {plan.trialPeriod > 0n
                ? `after your ${Number(plan.trialPeriod) / 86400}-day trial`
                : 'immediately'}
              .
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
