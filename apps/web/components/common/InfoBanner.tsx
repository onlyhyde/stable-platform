import type { JSX } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from './Card'

type BannerVariant = 'info' | 'warning' | 'success' | 'error'

interface InfoBannerProps {
  title: string
  description?: string
  variant?: BannerVariant
  className?: string
}

const variantStyles: Record<
  BannerVariant,
  { bg: string; border: string; iconColor: string; titleColor: string; textColor: string }
> = {
  info: {
    bg: 'rgb(var(--info) / 0.1)',
    border: 'rgb(var(--info) / 0.2)',
    iconColor: 'rgb(var(--info))',
    titleColor: 'rgb(var(--foreground))',
    textColor: 'rgb(var(--muted-foreground))',
  },
  warning: {
    bg: 'rgb(var(--warning) / 0.1)',
    border: 'rgb(var(--warning) / 0.2)',
    iconColor: 'rgb(var(--warning))',
    titleColor: 'rgb(var(--foreground))',
    textColor: 'rgb(var(--muted-foreground))',
  },
  success: {
    bg: 'rgb(var(--success) / 0.1)',
    border: 'rgb(var(--success) / 0.2)',
    iconColor: 'rgb(var(--success))',
    titleColor: 'rgb(var(--foreground))',
    textColor: 'rgb(var(--muted-foreground))',
  },
  error: {
    bg: 'rgb(var(--destructive) / 0.1)',
    border: 'rgb(var(--destructive) / 0.2)',
    iconColor: 'rgb(var(--destructive))',
    titleColor: 'rgb(var(--foreground))',
    textColor: 'rgb(var(--muted-foreground))',
  },
}

const variantIcons: Record<BannerVariant, JSX.Element> = {
  info: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  warning: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  ),
  success: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  error: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
}

export function InfoBanner({ title, description, variant = 'info', className }: InfoBannerProps) {
  const styles = variantStyles[variant]

  return (
    <Card
      className={cn('rounded-xl', className)}
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.border,
      }}
    >
      <CardContent className="py-4">
        <div className="flex gap-3">
          <svg
            className="w-6 h-6 flex-shrink-0"
            style={{ color: styles.iconColor }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {variantIcons[variant]}
          </svg>
          <div>
            <p className="font-medium" style={{ color: styles.titleColor }}>
              {title}
            </p>
            {description && (
              <p className="text-sm mt-1" style={{ color: styles.textColor }}>
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
