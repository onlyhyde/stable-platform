import { useEffect, useState } from 'react'

export interface ToastProps {
  id: string
  type?: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
  onDismiss: (id: string) => void
}

const typeStyles = {
  success: {
    bg: 'toast-success',
    icon: 'toast-icon-success',
    title: 'toast-title-success',
    message: 'toast-message-success',
  },
  error: {
    bg: 'toast-error',
    icon: 'toast-icon-error',
    title: 'toast-title-error',
    message: 'toast-message-error',
  },
  warning: {
    bg: 'toast-warning',
    icon: 'toast-icon-warning',
    title: 'toast-title-warning',
    message: 'toast-message-warning',
  },
  info: {
    bg: 'toast-info',
    icon: 'toast-icon-info',
    title: 'toast-title-info',
    message: 'toast-message-info',
  },
}

const icons = {
  success: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
}

export function Toast({
  id,
  type = 'info',
  title,
  message,
  duration = 5000,
  onDismiss,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const styles = typeStyles[type]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onDismiss(id), 200)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(id), 200)
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${styles.bg}
        ${isExiting ? 'animate-out fade-out slide-out-to-right' : 'animate-in fade-in slide-in-from-right'}
        duration-200
      `}
      role="alert"
    >
      <div className={styles.icon}>{icons[type]}</div>
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-medium ${styles.title}`}>{title}</p>}
        <p className={`text-sm ${styles.message} ${title ? 'mt-1' : ''}`}>{message}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className={`p-1 rounded hover:bg-black/5 ${styles.icon}`}
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}

export interface ToastContainerProps {
  toasts: Array<Omit<ToastProps, 'onDismiss'>>
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
