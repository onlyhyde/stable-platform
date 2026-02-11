'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'glass' | 'gradient' | 'bordered'
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}

export function Card({
  className,
  children,
  variant = 'default',
  hover = false,
  padding = 'none',
  style,
  ...props
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const variantStyles = {
    default: {
      backgroundColor: 'rgb(var(--card))',
      borderColor: 'rgb(var(--border))',
    },
    glass: {
      backgroundColor: 'rgb(var(--card) / 0.7)',
      borderColor: 'rgb(var(--border) / 0.2)',
    },
    gradient: {
      background: 'linear-gradient(135deg, rgb(var(--card)), rgb(var(--secondary)))',
      borderColor: 'rgb(var(--border))',
    },
    bordered: {
      backgroundColor: 'rgb(var(--card))',
      borderColor: 'rgb(var(--border))',
      borderWidth: '2px',
    },
  }

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200 border shadow-soft',
        variant === 'glass' && 'backdrop-blur-xl',
        paddings[padding],
        hover && 'hover:shadow-medium hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  bordered?: boolean
}

export function CardHeader({ className, children, bordered = true, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('px-6 py-5', bordered && 'border-b', className)}
      style={bordered ? { borderColor: 'rgb(var(--border))' } : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({ className, children, as: Tag = 'h3', ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn('text-lg font-semibold tracking-tight', className)}
      style={{ color: 'rgb(var(--foreground))' }}
      {...props}
    >
      {children}
    </Tag>
  )
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn('text-sm mt-1', className)}
      style={{ color: 'rgb(var(--muted-foreground))' }}
      {...props}
    >
      {children}
    </p>
  )
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  )
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  bordered?: boolean
}

export function CardFooter({ className, children, bordered = true, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('px-6 py-4 rounded-b-2xl', bordered && 'border-t', className)}
      style={
        bordered
          ? {
              borderColor: 'rgb(var(--border))',
              backgroundColor: 'rgb(var(--secondary) / 0.5)',
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  )
}

// Additional Card Components

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export function StatCard({
  className,
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = 'neutral',
  ...props
}: StatCardProps) {
  const trendStyles = {
    up: { color: 'rgb(var(--success))', backgroundColor: 'rgb(var(--success-muted))' },
    down: { color: 'rgb(var(--error))', backgroundColor: 'rgb(var(--error-muted))' },
    neutral: { color: 'rgb(var(--muted-foreground))', backgroundColor: 'rgb(var(--secondary))' },
  }

  const trendIcons = {
    up: (
      <svg
        aria-hidden="true"
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    ),
    down: (
      <svg
        aria-hidden="true"
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    ),
    neutral: null,
  }

  return (
    <Card className={cn('p-6', className)} {...props}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {value}
          </p>
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-medium"
                style={trendStyles[trend]}
              >
                {trendIcons[trend]}
                {Math.abs(change)}%
              </span>
              {changeLabel && (
                <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            className="p-3 rounded-xl"
            style={{
              backgroundColor: 'rgb(var(--primary-muted))',
              color: 'rgb(var(--primary))',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

interface FeatureCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  icon: ReactNode
  href?: string
}

export function FeatureCard({
  className,
  title,
  description,
  icon,
  href,
  ...props
}: FeatureCardProps) {
  const content = (
    <Card hover className={cn('p-6 group', className)} {...props}>
      <div
        className="p-3 w-fit rounded-xl text-white mb-4
                      group-hover:scale-110 transition-transform duration-200"
        style={{ background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {description}
      </p>
    </Card>
  )

  if (href) {
    return <a href={href}>{content}</a>
  }

  return content
}
