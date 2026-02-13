'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/error'

export default function DeFiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('DeFi error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <ErrorFallback
        error={error}
        title="DeFi Error"
        message="Something went wrong with the DeFi operation. Please try again."
        resetError={reset}
        showResetButton
        showHomeButton
        severity="error"
      />
    </div>
  )
}
