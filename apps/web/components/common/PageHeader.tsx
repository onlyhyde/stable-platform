'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: { label: string; href?: string }[]
  badge?: {
    label: string
    variant?: 'primary' | 'accent' | 'success' | 'warning' | 'danger'
  }
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
          {breadcrumb.map((item, index) => (
            <div key={item.label} className="flex items-center gap-2">
              {index > 0 && (
                <svg
                  className="w-4 h-4"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {item.href ? (
                <a
                  href={item.href}
                  className="transition-colors hover:opacity-80"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {item.label}
                </a>
              ) : (
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight"
              style={{ color: 'rgb(var(--foreground))' }}
            >
              {title}
            </h1>
            {badge && (
              <span
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-full',
                  badge.variant === 'primary' && 'badge-primary',
                  badge.variant === 'accent' && 'badge-accent',
                  badge.variant === 'success' && 'badge-success',
                  badge.variant === 'warning' && 'badge-warning',
                  badge.variant === 'danger' && 'badge-danger',
                  !badge.variant && 'badge-primary'
                )}
              >
                {badge.label}
              </span>
            )}
          </div>
          {description && (
            <p
              className="text-sm md:text-base max-w-2xl"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

// Compact variant
interface PageHeaderCompactProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeaderCompact({
  title,
  subtitle,
  icon,
  actions,
  className,
}: PageHeaderCompactProps) {
  return (
    <div className={cn('flex items-center justify-between py-4', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="p-2 rounded-xl"
            style={{
              backgroundColor: 'rgb(var(--primary) / 0.1)',
              color: 'rgb(var(--primary))',
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
