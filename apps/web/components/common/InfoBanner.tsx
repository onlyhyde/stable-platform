import type { JSX } from 'react'
import { Card, CardContent } from './Card'
import { cn } from '@/lib/utils'

type BannerVariant = 'info' | 'warning' | 'success' | 'error'

interface InfoBannerProps {
  title: string
  description: string
  variant?: BannerVariant
  className?: string
}

const variantStyles: Record<BannerVariant, { card: string; icon: string; title: string; text: string }> = {
  info: {
    card: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    text: 'text-blue-700',
  },
  warning: {
    card: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-900',
    text: 'text-yellow-700',
  },
  success: {
    card: 'bg-green-50 border-green-200',
    icon: 'text-green-600',
    title: 'text-green-900',
    text: 'text-green-700',
  },
  error: {
    card: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900',
    text: 'text-red-700',
  },
}

const variantIcons: Record<BannerVariant, JSX.Element> = {
  info: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  warning: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  ),
  success: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  error: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
}

export function InfoBanner({ title, description, variant = 'info', className }: InfoBannerProps) {
  const styles = variantStyles[variant]

  return (
    <Card className={cn(styles.card, className)}>
      <CardContent className="py-4">
        <div className="flex gap-3">
          <svg className={cn('w-6 h-6 flex-shrink-0', styles.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {variantIcons[variant]}
          </svg>
          <div>
            <p className={cn('font-medium', styles.title)}>{title}</p>
            <p className={cn('text-sm mt-1', styles.text)}>{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
