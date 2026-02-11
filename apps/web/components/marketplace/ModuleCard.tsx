'use client'

import { Button, Card, CardContent, CardFooter } from '@/components/common'

export interface ModuleCardData {
  id: string
  name: string
  description: string
  version: string
  moduleType: string
  category: string
  author: string
  installCount: number
  rating: number
  ratingCount: number
  auditStatus: string
  featured: boolean
  tags: string[]
}

const moduleTypeStyles: Record<string, { bg: string; color: string }> = {
  validator: { bg: 'rgb(var(--info) / 0.1)', color: 'rgb(var(--info))' },
  executor: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
  hook: { bg: 'rgb(var(--accent) / 0.1)', color: 'rgb(var(--accent))' },
  fallback: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
}

const auditBadges: Record<string, { label: string; bg: string; color: string }> = {
  verified: { label: 'Verified', bg: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' },
  audited: { label: 'Audited', bg: 'rgb(var(--info) / 0.1)', color: 'rgb(var(--info))' },
  'community-reviewed': {
    label: 'Community',
    bg: 'rgb(var(--warning) / 0.1)',
    color: 'rgb(var(--warning))',
  },
  unaudited: {
    label: 'Unaudited',
    bg: 'rgb(var(--secondary))',
    color: 'rgb(var(--muted-foreground))',
  },
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[0, 1, 2, 3, 4].map((starIndex) => (
          <span
            key={starIndex}
            style={{
              color:
                starIndex < fullStars
                  ? 'rgb(var(--warning))'
                  : starIndex === fullStars && hasHalf
                    ? 'rgb(var(--warning) / 0.5)'
                    : 'rgb(var(--muted-foreground) / 0.3)',
            }}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
        ({count})
      </span>
    </div>
  )
}

interface ModuleCardProps {
  module: ModuleCardData
  onInstall?: (id: string) => void
  onViewDetails?: (id: string) => void
  installed?: boolean
  isInstalling?: boolean
}

export function ModuleCard({
  module,
  onInstall,
  onViewDetails,
  installed,
  isInstalling,
}: ModuleCardProps) {
  const typeStyle = moduleTypeStyles[module.moduleType] ?? {
    bg: 'rgb(var(--secondary))',
    color: 'rgb(var(--muted-foreground))',
  }
  const audit = auditBadges[module.auditStatus] ?? auditBadges.unaudited

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-150">
      <CardContent className="flex-1 p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              {module.name}
            </h3>
            {module.featured && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: 'rgb(var(--primary) / 0.1)',
                  color: 'rgb(var(--primary))',
                }}
              >
                Featured
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            v{module.version}
          </span>
        </div>

        <p className="text-sm mb-3 line-clamp-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {module.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
          >
            {module.moduleType}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: audit.bg, color: audit.color }}
          >
            {audit.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <StarRating rating={module.rating} count={module.ratingCount} />
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {module.installCount.toLocaleString()} installs
          </span>
        </div>

        {module.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {module.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  color: 'rgb(var(--muted-foreground))',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onViewDetails?.(module.id)}
        >
          Details
        </Button>
        <Button
          variant={installed ? 'secondary' : 'primary'}
          size="sm"
          className="flex-1"
          onClick={() => onInstall?.(module.id)}
          disabled={installed || isInstalling}
          isLoading={isInstalling}
        >
          {installed ? 'Installed' : isInstalling ? 'Installing...' : 'Install'}
        </Button>
      </CardFooter>
    </Card>
  )
}
