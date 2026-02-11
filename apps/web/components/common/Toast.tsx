'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'loading'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  txHash?: string
  duration?: number
  persistent?: boolean
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  updateToast: (id: string, updates: Partial<Toast>) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      {mounted && createPortal(<ToastContainer />, document.body)}
    </ToastContext.Provider>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onClose: () => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    if (!toast.persistent && toast.type !== 'loading') {
      const duration = toast.duration || 5000
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [toast, onClose])

  const icons: Record<ToastType, ReactNode> = {
    success: (
      <svg
        className="w-5 h-5"
        style={{ color: 'rgb(var(--success))' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg
        className="w-5 h-5"
        style={{ color: 'rgb(var(--destructive))' }}
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
    ),
    info: (
      <svg
        className="w-5 h-5"
        style={{ color: 'rgb(var(--info))' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    loading: (
      <div
        className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
      />
    ),
  }

  const bgStyles: Record<ToastType, React.CSSProperties> = {
    success: {
      backgroundColor: 'rgb(var(--success) / 0.1)',
      borderColor: 'rgb(var(--success) / 0.2)',
    },
    error: {
      backgroundColor: 'rgb(var(--destructive) / 0.1)',
      borderColor: 'rgb(var(--destructive) / 0.2)',
    },
    info: {
      backgroundColor: 'rgb(var(--info) / 0.1)',
      borderColor: 'rgb(var(--info) / 0.2)',
    },
    loading: {
      backgroundColor: 'rgb(var(--card))',
      borderColor: 'rgb(var(--border))',
    },
  }

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-in slide-in-from-right-full duration-300"
      style={bgStyles[toast.type]}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {toast.message}
          </p>
        )}
        {toast.txHash && (
          <p
            className="text-xs mt-2 font-mono truncate"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            TX: {toast.txHash.slice(0, 10)}...{toast.txHash.slice(-8)}
          </p>
        )}
      </div>
      {toast.type !== 'loading' && (
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 transition-colors"
          style={{ color: 'rgb(var(--muted-foreground))' }}
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
      )}
    </div>
  )
}
