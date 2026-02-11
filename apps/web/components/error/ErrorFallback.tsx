'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/common/Button'
import { cn } from '@/lib/utils'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * Props for the ErrorFallback component
 */
export interface ErrorFallbackProps {
  error?: Error | null
  title?: string
  message?: string
  severity?: ErrorSeverity
  resetError?: () => void
  showResetButton?: boolean
  showHomeButton?: boolean
  showDetails?: boolean
  children?: ReactNode
  className?: string
}

/**
 * Get user-friendly error message from error object
 */
function getUserFriendlyMessage(error: Error | null | undefined): string {
  if (!error) {
    return 'An unexpected error occurred.'
  }

  // Check for common error patterns
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.'
  }

  if (error.message.includes('timeout')) {
    return 'The request timed out. Please try again.'
  }

  if (error.message.includes('unauthorized') || error.message.includes('401')) {
    return 'Your session has expired. Please reconnect your wallet.'
  }

  if (error.message.includes('forbidden') || error.message.includes('403')) {
    return 'You do not have permission to perform this action.'
  }

  if (error.message.includes('not found') || error.message.includes('404')) {
    return 'The requested resource was not found.'
  }

  // Return generic message for unknown errors
  return 'Something went wrong. Please try again.'
}

/**
 * ErrorFallback Component
 * Displays a user-friendly error message with optional recovery actions
 */
export function ErrorFallback({
  error,
  title,
  message,
  severity = 'error',
  resetError,
  showResetButton = true,
  showHomeButton = true,
  showDetails = false,
  children,
  className,
}: ErrorFallbackProps) {
  const severityStyles = {
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-500',
      title: 'text-blue-800',
      message: 'text-blue-700',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-500',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-500',
      title: 'text-red-800',
      message: 'text-red-700',
    },
    critical: {
      container: 'bg-red-100 border-red-300',
      icon: 'text-red-600',
      title: 'text-red-900',
      message: 'text-red-800',
    },
  }

  const styles = severityStyles[severity]

  const displayTitle =
    title ?? (severity === 'critical' ? 'Critical Error' : 'Something went wrong')
  const displayMessage = message ?? getUserFriendlyMessage(error)

  const handleReset = () => {
    resetError?.()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <div
      className={cn('rounded-lg border p-6', styles.container, className)}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center text-center">
        {/* Error Icon */}
        <div className={cn('mb-4', styles.icon)}>
          <svg
            className="h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {severity === 'info' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : severity === 'warning' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </div>

        {/* Title */}
        <h2 className={cn('text-xl font-semibold mb-2', styles.title)}>{displayTitle}</h2>

        {/* Message */}
        <p className={cn('mb-6 max-w-md', styles.message)}>{displayMessage}</p>

        {/* Custom content */}
        {children}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {showResetButton && resetError && (
            <Button variant="primary" onClick={handleReset}>
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button variant="secondary" onClick={handleGoHome}>
              Go to Home
            </Button>
          )}
        </div>

        {/* Error Details (Development) */}
        {showDetails && error && (
          <details className="mt-6 w-full max-w-lg text-left">
            <summary className={cn('cursor-pointer text-sm', styles.message)}>
              Show technical details
            </summary>
            <pre
              className="mt-2 overflow-auto rounded p-4 text-xs"
              style={{ backgroundColor: 'rgb(17 24 39)', color: 'rgb(243 244 246)' }}
            >
              <code>
                {error.name}: {error.message}
                {error.stack && `\n\n${error.stack}`}
              </code>
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
