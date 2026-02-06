import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'filled' | 'gradient'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variantStyles = {
  default: 'card',
  outline: 'card-outline',
  filled: 'card-filled',
  gradient: 'card-gradient',
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl transition-all-fast
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`} {...props}>
      <div>
        <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ children, className = '', ...props }: CardContentProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={`mt-4 pt-4 ${className}`}
      style={{ borderTop: '1px solid rgb(var(--border))' }}
      {...props}
    >
      {children}
    </div>
  )
}
