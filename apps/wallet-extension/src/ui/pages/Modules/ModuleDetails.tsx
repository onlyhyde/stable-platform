import type { InstalledModule, ModuleConfigField, ModuleType } from '@stablenet/core'
import { getModuleTypeName } from '@stablenet/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ============================================================================
// Types
// ============================================================================

interface RegistryModuleInfo {
  metadata: {
    address: string
    type: ModuleType
    name: string
    description: string
    version: string
    isVerified?: boolean
    logoUrl?: string
    tags?: string[]
  }
  configSchema: { fields: ModuleConfigField[] } | null
  addresses: Record<number, string>
  supportedChains: number[]
}

interface ModuleDetailsProps {
  module: InstalledModule | undefined
  registryModule?: RegistryModuleInfo
  onBack: () => void
  onUninstall: () => Promise<void>
  onInstall?: (moduleAddress: string, moduleType: ModuleType) => void
}

// ============================================================================
// Component
// ============================================================================

export function ModuleDetails({
  module,
  registryModule,
  onBack,
  onUninstall,
  onInstall,
}: ModuleDetailsProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Show registry module details when no installed module is present
  if (!module && registryModule) {
    return (
      <RegistryModuleView registryModule={registryModule} onBack={onBack} onInstall={onInstall} />
    )
  }

  if (!module) {
    return (
      <div className="module-details p-4">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{t('moduleNotFound')}</p>
        <button type="button" className="mt-4 btn-ghost" onClick={onBack}>
          ← {tc('back')}
        </button>
      </div>
    )
  }

  const handleUninstall = async () => {
    setIsUninstalling(true)
    setError(null)

    try {
      await onUninstall()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uninstallationFailed'))
      setIsUninstalling(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="module-details">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
      >
        <button
          type="button"
          className="p-2 rounded-lg"
          style={{ color: 'rgb(var(--muted-foreground))' }}
          onClick={onBack}
        >
          ←
        </button>
        <h2 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {t('moduleDetails')}
        </h2>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Module Info */}
        <div className="flex items-start gap-4">
          {module.metadata.logoUrl ? (
            <img
              src={module.metadata.logoUrl}
              alt={module.metadata.name}
              className="w-16 h-16 rounded-lg"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              {getModuleIcon(module.type)}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {module.metadata.name}
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {getModuleTypeName(module.type)}
            </p>
            <div className="flex gap-2 mt-2">
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
        </div>

        {/* Description */}
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('description')}
          </h4>
          <p style={{ color: 'rgb(var(--foreground))' }}>{module.metadata.description}</p>
        </div>

        {/* Contract Address */}
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('contractAddress')}
          </h4>
          <p className="font-mono text-sm break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {module.address}
          </p>
        </div>

        {/* Installed At */}
        {module.installedAt && (
          <div>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('installedAt')}
            </h4>
            <p style={{ color: 'rgb(var(--foreground))' }}>
              {new Date(module.installedAt * 1000).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Tags */}
        {module.metadata.tags && module.metadata.tags.length > 0 && (
          <div>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('tags')}
            </h4>
            <div className="flex flex-wrap gap-1">
              {module.metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded"
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

        {/* Error */}
        {error && (
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {error}
          </div>
        )}

        {/* Uninstall Section */}
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.05)',
            borderWidth: 1,
            borderColor: 'rgb(var(--destructive) / 0.2)',
          }}
        >
          <h4 className="font-medium mb-2" style={{ color: 'rgb(var(--destructive))' }}>
            {t('dangerZone')}
          </h4>
          <p className="text-sm mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('uninstallWarning')}
          </p>

          {showConfirm ? (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
                {t('uninstallConfirm')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg font-medium btn-ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isUninstalling}
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: 'rgb(var(--destructive))',
                    color: 'white',
                  }}
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                >
                  {isUninstalling ? t('uninstalling') : t('confirmUninstall')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="w-full py-2 rounded-lg font-medium"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
              onClick={() => setShowConfirm(true)}
            >
              {t('uninstallModule')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Registry Module View (for uninstalled modules from marketplace)
// ============================================================================

interface RegistryModuleViewProps {
  registryModule: RegistryModuleInfo
  onBack: () => void
  onInstall?: (moduleAddress: string, moduleType: ModuleType) => void
}

function RegistryModuleView({ registryModule, onBack, onInstall }: RegistryModuleViewProps) {
  const { t } = useTranslation('modules')
  const { metadata, configSchema, supportedChains } = registryModule

  return (
    <div className="module-details">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
      >
        <button
          type="button"
          className="p-2 rounded-lg"
          style={{ color: 'rgb(var(--muted-foreground))' }}
          onClick={onBack}
        >
          ←
        </button>
        <h2 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {t('moduleDetails')}
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Module Info */}
        <div className="flex items-start gap-4">
          {metadata.logoUrl ? (
            <img src={metadata.logoUrl} alt={metadata.name} className="w-16 h-16 rounded-lg" />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              {getModuleIcon(metadata.type)}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {metadata.name}
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {getModuleTypeName(metadata.type)}
            </p>
            <div className="flex gap-2 mt-2">
              {metadata.isVerified && (
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
                {t('version', { version: metadata.version })}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgb(var(--primary) / 0.1)',
                  color: 'rgb(var(--primary))',
                }}
              >
                {t('notInstalled')}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('description')}
          </h4>
          <p style={{ color: 'rgb(var(--foreground))' }}>{metadata.description}</p>
        </div>

        {/* Contract Address */}
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('contractAddress')}
          </h4>
          <p className="font-mono text-sm break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {metadata.address}
          </p>
        </div>

        {/* Supported Chains */}
        {supportedChains.length > 0 && (
          <div>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('supportedChains')}
            </h4>
            <div className="flex flex-wrap gap-1">
              {supportedChains.map((chainId) => (
                <span
                  key={chainId}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    color: 'rgb(var(--muted-foreground))',
                  }}
                >
                  {t('chainId', { id: chainId })}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {metadata.tags && metadata.tags.length > 0 && (
          <div>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('tags')}
            </h4>
            <div className="flex flex-wrap gap-1">
              {metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded"
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

        {/* Config Schema */}
        {configSchema?.fields && configSchema.fields.length > 0 && (
          <div>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('configurationFields')}
            </h4>
            <div className="space-y-2">
              {configSchema.fields.map((field) => (
                <div
                  key={field.name}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {field.label}
                    </p>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{
                        backgroundColor: 'rgb(var(--muted))',
                        color: 'rgb(var(--muted-foreground))',
                      }}
                    >
                      {field.type}
                    </span>
                    {field.required && (
                      <span className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                        {t('required')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {field.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Install Button */}
        {onInstall && (
          <button
            type="button"
            className="w-full py-3 rounded-lg font-medium"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'white',
            }}
            onClick={() => onInstall(metadata.address, metadata.type)}
          >
            {t('installModule')}
          </button>
        )}
      </div>
    </div>
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
