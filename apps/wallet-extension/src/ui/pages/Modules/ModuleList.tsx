import type { InstalledModule } from '@stablenet/core'
import { getModuleTypeName, MODULE_STATUS } from '@stablenet/core'
import { useTranslation } from 'react-i18next'

// ============================================================================
// Types
// ============================================================================

interface ModuleListProps {
  modules: InstalledModule[]
  onModuleClick: (address: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function ModuleList({ modules, onModuleClick }: ModuleListProps) {
  const { t } = useTranslation('modules')

  if (modules.length === 0) {
    return (
      <div className="empty-state text-center py-8">
        <span className="text-4xl mb-4 block">📦</span>
        <h3 className="text-lg font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
          {t('noModulesInstalled')}
        </h3>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{t('noModulesInstalledDesc')}</p>
      </div>
    )
  }

  // Group modules by type
  const groupedModules = modules.reduce(
    (acc, module) => {
      const typeName = getModuleTypeName(module.type)
      if (!acc[typeName]) acc[typeName] = []
      acc[typeName].push(module)
      return acc
    },
    {} as Record<string, InstalledModule[]>
  )

  return (
    <div className="module-list space-y-6">
      {Object.entries(groupedModules).map(([typeName, typeModules]) => (
        <div key={typeName} className="module-group">
          <h3
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            {typeName}s
          </h3>
          <div className="space-y-2">
            {typeModules.map((module) => (
              <ModuleCard
                key={module.address}
                module={module}
                onClick={() => onModuleClick(module.address)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ModuleCardProps {
  module: InstalledModule
  onClick: () => void
}

function ModuleCard({ module, onClick }: ModuleCardProps) {
  const { t } = useTranslation('modules')
  const statusInfo = getStatusInfo(module.status, t)

  return (
    <button
      type="button"
      className="module-card w-full p-4 rounded-lg text-left transition-all"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderWidth: 1,
        borderColor: 'rgb(var(--border))',
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        {module.metadata.logoUrl ? (
          <img
            src={module.metadata.logoUrl}
            alt={module.metadata.name}
            className="w-10 h-10 rounded-lg"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            {getModuleIcon(module.type)}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium truncate" style={{ color: 'rgb(var(--foreground))' }}>
              {module.metadata.name}
            </h4>
            <span className="text-xs flex items-center gap-1" style={{ color: statusInfo.color }}>
              {statusInfo.icon} {statusInfo.label}
            </span>
          </div>
          <p className="text-sm truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {module.metadata.description}
          </p>

          {/* Tags */}
          <div className="flex gap-1 mt-2">
            {module.metadata.isVerified && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgb(var(--success) / 0.1)',
                  color: 'rgb(var(--success))',
                }}
              >
                {t('verifiedCheck')}
              </span>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgb(var(--secondary))',
                color: 'rgb(var(--muted-foreground))',
              }}
            >
              {t('version', { version: module.metadata.version })}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>›</span>
      </div>
    </button>
  )
}

function getModuleIcon(type: bigint): string {
  const icons: Record<string, string> = {
    '1': '🔐', // Validator
    '2': '⚡', // Executor
    '3': '🔄', // Fallback
    '4': '🪝', // Hook
    '5': '📋', // Policy
    '6': '✍️', // Signer
  }
  return icons[String(type)] ?? '📦'
}

function getStatusInfo(
  status: (typeof MODULE_STATUS)[keyof typeof MODULE_STATUS],
  t: (key: string) => string
): {
  label: string
  color: string
  icon: string
} {
  switch (status) {
    case MODULE_STATUS.INSTALLED:
      return { label: t('active'), color: 'rgb(var(--success))', icon: '✓' }
    case MODULE_STATUS.INSTALLING:
      return { label: t('installing'), color: 'rgb(var(--warning))', icon: '⏳' }
    case MODULE_STATUS.UNINSTALLING:
      return { label: t('removing'), color: 'rgb(var(--warning))', icon: '⏳' }
    case MODULE_STATUS.FAILED:
      return { label: t('failed'), color: 'rgb(var(--destructive))', icon: '✗' }
    default:
      return { label: t('notInstalled'), color: 'rgb(var(--muted-foreground))', icon: '○' }
  }
}
