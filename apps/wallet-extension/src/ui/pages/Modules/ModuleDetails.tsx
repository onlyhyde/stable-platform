import { useState } from 'react'
import type { InstalledModule } from '@stablenet/core'
import { getModuleTypeName } from '@stablenet/core'

// ============================================================================
// Types
// ============================================================================

interface ModuleDetailsProps {
  module: InstalledModule | undefined
  onBack: () => void
  onUninstall: () => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function ModuleDetails({ module, onBack, onUninstall }: ModuleDetailsProps) {
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!module) {
    return (
      <div className="module-details p-4">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Module not found</p>
        <button className="mt-4 btn-ghost" onClick={onBack}>
          ← Back
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
      setError(err instanceof Error ? err.message : 'Uninstallation failed')
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
          className="p-2 rounded-lg"
          style={{ color: 'rgb(var(--muted-foreground))' }}
          onClick={onBack}
        >
          ←
        </button>
        <h2 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          Module Details
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
                  ✓ Verified
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  color: 'rgb(var(--muted-foreground))',
                }}
              >
                v{module.metadata.version}
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
            Description
          </h4>
          <p style={{ color: 'rgb(var(--foreground))' }}>{module.metadata.description}</p>
        </div>

        {/* Contract Address */}
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Contract Address
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
              Installed
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
              Tags
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
            Danger Zone
          </h4>
          <p className="text-sm mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Uninstalling this module will remove its functionality from your Smart Account. This
            action cannot be undone.
          </p>

          {showConfirm ? (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
                Are you sure you want to uninstall this module?
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-lg font-medium btn-ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isUninstalling}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: 'rgb(var(--destructive))',
                    color: 'white',
                  }}
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                >
                  {isUninstalling ? 'Uninstalling...' : 'Confirm Uninstall'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full py-2 rounded-lg font-medium"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
              onClick={() => setShowConfirm(true)}
            >
              Uninstall Module
            </button>
          )}
        </div>
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
