import type { ReactNode } from 'react'
import { useCallback, useEffect } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-full mx-4',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose()
      }
    },
    [onClose, closeOnEscape]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade-in"
        style={{ backgroundColor: 'rgb(var(--overlay) / 0.6)' }}
        onClick={closeOnOverlayClick ? onClose : undefined}
        onKeyDown={undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <dialog
        open
        className={`
          relative rounded-xl shadow-xl
          w-full ${sizeStyles[size]}
          max-h-[90vh] overflow-hidden
          animate-scale-in
        `}
        style={{
          backgroundColor: 'rgb(var(--card-hover))',
          border: '1px solid rgb(var(--border))',
          padding: 0,
        }}
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className="flex items-start justify-between p-4"
            style={{ borderBottom: '1px solid rgb(var(--border))' }}
          >
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="text-sm mt-1"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg transition-all-fast hover:opacity-70"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
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
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">{children}</div>
      </dialog>
    </div>
  )
}

export interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`flex items-center justify-end gap-3 p-4 ${className}`}
      style={{ borderTop: '1px solid rgb(var(--border))' }}
    >
      {children}
    </div>
  )
}
