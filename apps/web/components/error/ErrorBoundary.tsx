'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorFallback, type ErrorSeverity } from './ErrorFallback'

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  fallbackRender?: (props: {
    error: Error
    errorInfo: ErrorInfo | null
    resetError: () => void
  }) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
  severity?: ErrorSeverity
  showResetButton?: boolean
  showHomeButton?: boolean
  showDetails?: boolean
  title?: string
  message?: string
}

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in child component tree and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })

    this.props.onReset?.()
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const {
      children,
      fallback,
      fallbackRender,
      severity = 'error',
      showResetButton = true,
      showHomeButton = true,
      showDetails = process.env.NODE_ENV === 'development',
      title,
      message,
    } = this.props

    if (hasError && error) {
      // Use custom fallback render function if provided
      if (fallbackRender) {
        return fallbackRender({
          error,
          errorInfo,
          resetError: this.resetError,
        })
      }

      // Use custom fallback component if provided
      if (fallback) {
        return fallback
      }

      // Use default ErrorFallback
      return (
        <ErrorFallback
          error={error}
          title={title}
          message={message}
          severity={severity}
          resetError={this.resetError}
          showResetButton={showResetButton}
          showHomeButton={showHomeButton}
          showDetails={showDetails}
        />
      )
    }

    return children
  }
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return ComponentWithErrorBoundary
}
