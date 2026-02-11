/**
 * Error Handling Components and Utilities
 */

export type { ErrorBoundaryProps } from './ErrorBoundary'
// Components
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary'
export type { ErrorFallbackProps, ErrorSeverity } from './ErrorFallback'
export { ErrorFallback } from './ErrorFallback'
export type { ErrorCode } from './useErrorHandler'
// Hooks
export { createTypedError, ErrorCodes, useErrorHandler } from './useErrorHandler'
