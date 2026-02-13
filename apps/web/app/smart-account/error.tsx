'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/error'

export default function SmartAccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Smart account error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <ErrorFallback
        error={error}
        title="Smart Account Error"
        message="Something went wrong with the smart account operation. Please try again."
        resetError={reset}
        showResetButton
        showHomeButton
        severity="error"
      />
    </div>
  )
}
