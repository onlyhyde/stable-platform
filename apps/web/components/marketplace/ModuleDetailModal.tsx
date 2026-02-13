'use client'

import { Button, Modal, ModalActions } from '@/components/common'
import { getModuleEntry } from '@/lib/moduleAddresses'
import type { ModuleCardData } from './ModuleCard'

// ============================================================================
// Types
// ============================================================================

interface ModuleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  module: ModuleCardData | null
  installed: boolean
  onInstallClick: () => void
  onUninstallClick?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

const moduleTypeLabelMap: Record<string, string> = {
  validator: 'Validator',
  executor: 'Executor',
  hook: 'Hook',
  fallback: 'Fallback',
}

const auditBadges: Record<string, { label: string; bg: string; color: string }> = {
  verified: { label: 'Verified', bg: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' },
  audited: { label: 'Audited', bg: 'rgb(var(--info) / 0.1)', color: 'rgb(var(--info))' },
  'community-reviewed': {
    label: 'Community Reviewed',
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
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[0, 1, 2, 3, 4].map((starIndex) => (
          <span
            key={starIndex}
            className="text-lg"
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
      <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
        {rating.toFixed(1)}
      </span>
      <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
        ({count} review{count !== 1 ? 's' : ''})
      </span>
    </div>
  )
}

// ============================================================================
// Detail Row
// ============================================================================

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {label}
      </span>
      <div className="text-sm text-right" style={{ color: 'rgb(var(--foreground))' }}>
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ModuleDetailModal({
  isOpen,
  onClose,
  module,
  installed,
  onInstallClick,
  onUninstallClick,
}: ModuleDetailModalProps) {
  if (!module) return null

  const entry = getModuleEntry(module.id)
  const audit = auditBadges[module.auditStatus] ?? auditBadges.unaudited

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={module.name} size="lg">
      <div className="space-y-5">
        {/* Description */}
        <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {module.description}
        </p>

        {/* Rating */}
        <StarRating rating={module.rating} count={module.ratingCount} />

        {/* Details grid */}
        <div
          className="rounded-xl p-4 divide-y"
          style={{
            backgroundColor: 'rgb(var(--background))',
            borderColor: 'rgb(var(--border))',
          }}
        >
          <DetailRow label="Type">
            {moduleTypeLabelMap[module.moduleType] ?? module.moduleType}
          </DetailRow>
          <DetailRow label="Category">
            <span className="capitalize">{module.category}</span>
          </DetailRow>
          <DetailRow label="Version">v{module.version}</DetailRow>
          <DetailRow label="Author">{module.author}</DetailRow>
          <DetailRow label="Installs">{module.installCount.toLocaleString()}</DetailRow>
          <DetailRow label="Audit Status">
            <span
              className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: audit.bg, color: audit.color }}
            >
              {audit.label}
            </span>
          </DetailRow>
          {entry && (
            <DetailRow label="Contract">
              <span className="font-mono text-xs">
                {entry.address.slice(0, 8)}...{entry.address.slice(-6)}
              </span>
            </DetailRow>
          )}
        </div>

        {/* Tags */}
        {module.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Tags
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {module.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    color: 'rgb(var(--muted-foreground))',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {installed && onUninstallClick ? (
          <Button
            variant="secondary"
            onClick={onUninstallClick}
            style={{ color: 'rgb(var(--destructive))' }}
          >
            Uninstall
          </Button>
        ) : (
          <Button
            variant={installed ? 'secondary' : 'primary'}
            onClick={onInstallClick}
            disabled={installed}
          >
            {installed ? 'Installed' : 'Install'}
          </Button>
        )}
      </ModalActions>
    </Modal>
  )
}
