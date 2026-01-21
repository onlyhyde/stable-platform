import type { ReactNode } from 'react'

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

export interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  children?: ReactNode
}

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending' },
  processing: { variant: 'info' as const, label: 'Processing' },
  completed: { variant: 'success' as const, label: 'Completed' },
  failed: { variant: 'error' as const, label: 'Failed' },
  cancelled: { variant: 'default' as const, label: 'Cancelled' },
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant}>
      {children ?? config.label}
    </Badge>
  )
}
