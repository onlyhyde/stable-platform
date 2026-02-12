'use client'

import { ErrorFallback } from '@/components/error'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <ErrorFallback
        error={error}
        resetError={reset}
        showResetButton={true}
        showHomeButton={true}
        severity="error"
      />
    </div>
  )
}
