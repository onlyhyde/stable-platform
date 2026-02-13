'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/error'

export default function StealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Stealth error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <ErrorFallback
        error={error}
        title="Stealth Address Error"
        message="Something went wrong with the stealth address operation. Please try again."
        resetError={reset}
        showResetButton
        showHomeButton
        severity="error"
      />
    </div>
  )
}
