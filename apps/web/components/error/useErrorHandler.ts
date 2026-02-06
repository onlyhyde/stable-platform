'use client'

import { useCallback, useState } from 'react'

/**
 * Error handler state
 */
interface ErrorHandlerState {
  error: Error | null
  hasError: boolean
}

/**
 * Error handler hook return type
 */
interface UseErrorHandlerReturn extends ErrorHandlerState {
  handleError: (error: unknown) => void
  clearError: () => void
  wrapAsync: <T>(asyncFn: () => Promise<T>) => Promise<T | undefined>
}

/**
 * Options for the useErrorHandler hook
 */
interface UseErrorHandlerOptions {
  onError?: (error: Error) => void
  defaultErrorMessage?: string
}

/**
 * Normalize unknown error to Error object
 */
function normalizeError(error: unknown, defaultMessage: string): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message))
  }

  return new Error(defaultMessage)
}

/**
 * Custom hook for handling errors in functional components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { error, hasError, handleError, clearError, wrapAsync } = useErrorHandler()
 *
 *   const fetchData = async () => {
 *     await wrapAsync(async () => {
 *       const response = await fetch('/api/data')
 *       return response.json()
 *     })
 *   }
 *
 *   if (hasError) {
 *     return <ErrorFallback error={error} resetError={clearError} />
 *   }
 *
 *   return <div>...</div>
 * }
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const { onError, defaultErrorMessage = 'An unexpected error occurred' } = options

  const [state, setState] = useState<ErrorHandlerState>({
    error: null,
    hasError: false,
  })

  const handleError = useCallback(
    (error: unknown) => {
      const normalizedError = normalizeError(error, defaultErrorMessage)

      setState({
        error: normalizedError,
        hasError: true,
      })

      // Log error
      console.error('Error handled:', normalizedError)

      // Call optional error handler
      onError?.(normalizedError)
    },
    [defaultErrorMessage, onError]
  )

  const clearError = useCallback(() => {
    setState({
      error: null,
      hasError: false,
    })
  }, [])

  const wrapAsync = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await asyncFn()
      } catch (error) {
        handleError(error)
        return undefined
      }
    },
    [handleError]
  )

  return {
    ...state,
    handleError,
    clearError,
    wrapAsync,
  }
}

/**
 * Create a typed error for specific error conditions
 */
export function createTypedError(
  code: string,
  message: string,
  cause?: unknown
): Error & { code: string } {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  error.cause = cause
  return error
}

/**
 * Common error codes for the application
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_REJECTED: 'WALLET_REJECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',

  // Transaction errors
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED: 'TRANSACTION_REJECTED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
