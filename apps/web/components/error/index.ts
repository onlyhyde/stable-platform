/**
 * Error Handling Components and Utilities
 */

// Components
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary'
export type { ErrorBoundaryProps } from './ErrorBoundary'

export { ErrorFallback } from './ErrorFallback'
export type { ErrorFallbackProps, ErrorSeverity } from './ErrorFallback'

// Hooks
export { useErrorHandler, createTypedError, ErrorCodes } from './useErrorHandler'
export type { ErrorCode } from './useErrorHandler'
