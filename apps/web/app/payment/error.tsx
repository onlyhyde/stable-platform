'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/error'

export default function PaymentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Payment error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <ErrorFallback
        error={error}
        title="Payment Error"
        message="Something went wrong with the payment operation. Please try again."
        resetError={reset}
        showResetButton
        showHomeButton
        severity="error"
      />
    </div>
  )
}
