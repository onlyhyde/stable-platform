'use client'

import { Card, CardContent, CardFooter, Button } from '@/components/common'

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

const moduleTypeColors: Record<string, string> = {
  validator: 'bg-blue-100 text-blue-800',
  executor: 'bg-green-100 text-green-800',
  hook: 'bg-purple-100 text-purple-800',
  fallback: 'bg-amber-100 text-amber-800',
}

const auditBadges: Record<string, { label: string; color: string }> = {
  verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-800' },
  audited: { label: 'Audited', color: 'bg-blue-100 text-blue-800' },
  'community-reviewed': { label: 'Community', color: 'bg-yellow-100 text-yellow-800' },
  unaudited: { label: 'Unaudited', color: 'bg-gray-100 text-gray-600' },
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < fullStars
                ? 'text-yellow-500'
                : i === fullStars && hasHalf
                  ? 'text-yellow-300'
                  : 'text-gray-300'
            }
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs text-gray-500">({count})</span>
    </div>
  )
}

interface ModuleCardProps {
  module: ModuleCardData
  onInstall?: (id: string) => void
  onViewDetails?: (id: string) => void
  installed?: boolean
}

export function ModuleCard({ module, onInstall, onViewDetails, installed }: ModuleCardProps) {
  const typeColor = moduleTypeColors[module.moduleType] ?? 'bg-gray-100 text-gray-800'
  const audit = auditBadges[module.auditStatus] ?? auditBadges.unaudited

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-200">
      <CardContent className="flex-1 p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{module.name}</h3>
            {module.featured && (
              <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
                Featured
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">v{module.version}</span>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{module.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
            {module.moduleType}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${audit.color}`}>
            {audit.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <StarRating rating={module.rating} count={module.ratingCount} />
          <span className="text-xs text-gray-500">
            {module.installCount.toLocaleString()} installs
          </span>
        </div>

        {module.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {module.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
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
          disabled={installed}
        >
          {installed ? 'Installed' : 'Install'}
        </Button>
      </CardFooter>
    </Card>
  )
}
