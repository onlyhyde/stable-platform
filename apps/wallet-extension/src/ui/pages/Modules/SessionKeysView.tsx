import { type InstalledModule, MODULE_TYPE } from '@stablenet/core'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { Account } from '../../../types/account'

// ============================================================================
// Types
// ============================================================================

interface SessionKeysViewProps {
  account: Account
  installedModules: InstalledModule[] | null
  onBack: () => void
  onNavigateToInstall: () => void
  onModuleClick: (address: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function SessionKeysView({
  account,
  installedModules,
  onBack,
  onNavigateToInstall,
  onModuleClick,
}: SessionKeysViewProps) {
  const { t } = useTranslation('modules')

  const sessionKeyModules = useMemo(() => {
    if (!installedModules) return []
    return installedModules.filter(
      (m) => m.type === MODULE_TYPE.EXECUTOR && m.metadata.name.toLowerCase().includes('session')
    )
  }, [installedModules])

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-lg"
            style={{ color: 'rgb(var(--foreground))' }}
            onClick={onBack}
          >
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {t('sessionKeys.title', 'Session Keys')}
          </h1>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-lg font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
          }}
          onClick={onNavigateToInstall}
        >
          {t('sessionKeys.addKey', 'Add Session Key')}
        </button>
      </div>

      {/* Description */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderWidth: 1,
          borderColor: 'rgb(var(--border))',
        }}
      >
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t(
            'sessionKeys.description',
            'Session keys are temporary keys that allow dApps to execute transactions on your behalf without requiring approval for each transaction.'
          )}
        </p>
      </div>

      {/* Session Key List */}
      {sessionKeyModules.length === 0 ? (
        <EmptyState
          onAdd={onNavigateToInstall}
          addLabel={t('sessionKeys.addFirstKey', 'Add Your First Session Key')}
          message={t(
            'sessionKeys.emptyMessage',
            'No session keys configured. Session keys let you authorize dApps to send transactions within defined limits.'
          )}
        />
      ) : (
        <div className="space-y-3">
          {sessionKeyModules.map((module) => (
            <SessionKeyCard
              key={module.address}
              module={module}
              onClick={() => onModuleClick(module.address)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

function SessionKeyCard({
  module,
  onClick,
}: {
  module: InstalledModule
  onClick: () => void
}) {
  const truncatedAddress = `${module.address.slice(0, 8)}...${module.address.slice(-6)}`

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderWidth: 1,
        borderColor: 'rgb(var(--border))',
        cursor: 'pointer',
      }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          🔑
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: 'rgb(var(--foreground))' }}>
            {module.metadata.name}
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {truncatedAddress}
          </p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: 'rgb(var(--success) / 0.1)',
            color: 'rgb(var(--success))',
          }}
        >
          Active
        </span>
      </div>
      {module.metadata.description && (
        <p
          className="text-xs mt-2 truncate"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          {module.metadata.description}
        </p>
      )}
    </div>
  )
}

function EmptyState({
  onAdd,
  addLabel,
  message,
}: {
  onAdd: () => void
  addLabel: string
  message: string
}) {
  return (
    <div className="text-center py-8">
      <span className="text-4xl mb-4 block">🔑</span>
      <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {message}
      </p>
      <button
        type="button"
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{
          backgroundColor: 'rgb(var(--primary))',
          color: 'white',
        }}
        onClick={onAdd}
      >
        {addLabel}
      </button>
    </div>
  )
}
