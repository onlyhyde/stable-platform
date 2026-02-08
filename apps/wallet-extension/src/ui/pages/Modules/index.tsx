import { MODULE_TYPE, type ModuleType, getModuleTypeName } from '@stablenet/core'
import { useMemo, useState } from 'react'

import { useWalletStore } from '../../hooks'
import { DelegateSetup } from './DelegateSetup'
import { useModuleMarketplace } from './hooks/useModuleMarketplace'
import { useModules } from './hooks/useModules'

import { InstallModuleWizard } from './InstallModule'
import { ModuleDetails } from './ModuleDetails'
import { ModuleList } from './ModuleList'

// ============================================================================
// Types
// ============================================================================

type ModuleView = 'list' | 'details' | 'install' | 'delegate'
type ModuleTab = 'installed' | 'browse'

// ============================================================================
// Component
// ============================================================================

export function ModulesPage() {
  const { accounts, selectedAccount: selectedAccountAddress } = useWalletStore()
  const [view, setView] = useState<ModuleView>('list')
  const [activeTab, setActiveTab] = useState<ModuleTab>('installed')
  const [selectedModuleAddress, setSelectedModuleAddress] = useState<string | null>(null)
  const [selectedModuleType, setSelectedModuleType] = useState<ModuleType | null>(null)

  // Find the full account object from the accounts array
  const selectedAccount = useMemo(() => {
    if (!selectedAccountAddress) return null
    return accounts.find((a) => a.address === selectedAccountAddress) ?? null
  }, [accounts, selectedAccountAddress])

  const { installedModules, isLoading, error, refetch } = useModules(selectedAccount?.address)
  const { registryModules, isLoading: isLoadingRegistry } = useModuleMarketplace()

  // Determine which registry modules are already installed
  const installedAddresses = useMemo(() => {
    const set = new Set<string>()
    if (installedModules) {
      for (const m of installedModules) set.add(m.address.toLowerCase())
    }
    return set
  }, [installedModules])

  // View: Delegate Setup (EIP-7702)
  if (view === 'delegate' && selectedAccountAddress) {
    return (
      <DelegateSetup
        account={selectedAccountAddress}
        onComplete={() => {
          setView('list')
          refetch()
        }}
        onCancel={() => setView('list')}
      />
    )
  }

  // Guard: Account not Smart Account capable - show delegation setup option
  if (!selectedAccount || selectedAccount.type === 'eoa') {
    return (
      <div className="modules-page p-4">
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            Smart Account Required
          </h2>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Module management is only available for Smart Accounts. Upgrade your EOA via EIP-7702
            delegation.
          </p>
          <button type="button" className="btn-primary px-4 py-2 rounded-lg" onClick={() => setView('delegate')}>
            Enable Smart Account
          </button>
        </div>
      </div>
    )
  }

  // View: Module Details
  if (view === 'details' && selectedModuleAddress) {
    const selectedModule = installedModules?.find((m) => m.address === selectedModuleAddress)

    return (
      <ModuleDetails
        module={selectedModule}
        onBack={() => {
          setView('list')
          setSelectedModuleAddress(null)
        }}
        onUninstall={async () => {
          // Handle uninstall
          await refetch()
          setView('list')
        }}
      />
    )
  }

  // View: Install Module
  if (view === 'install') {
    return (
      <InstallModuleWizard
        account={selectedAccount}
        preselectedType={selectedModuleType}
        onComplete={async () => {
          await refetch()
          setView('list')
        }}
        onCancel={() => {
          setView('list')
          setSelectedModuleType(null)
        }}
      />
    )
  }

  // View: Module List (default)
  return (
    <div className="modules-page">
      {/* Header */}
      <div
        className="page-header flex items-center justify-between p-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Modules
        </h1>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 rounded-lg text-sm font-medium"
          onClick={() => setView('install')}
        >
          + Add Module
        </button>
      </div>

      {/* Tab Toggle */}
      <div
        className="flex gap-1 mx-4 mt-3 p-1 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        {(['installed', 'browse'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab ? 'rgb(var(--background))' : 'transparent',
              color: activeTab === tab ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'installed' ? `Installed (${installedModules?.length ?? 0})` : 'Browse All'}
          </button>
        ))}
      </div>

      {activeTab === 'installed' ? (
        <>
          {/* Module Categories */}
          <div className="module-categories p-4">
            <ModuleCategoryTabs
              modules={installedModules ?? []}
              onInstallClick={(type) => {
                setSelectedModuleType(type)
                setView('install')
              }}
            />
          </div>

          {/* Module List */}
          <div className="module-list-container p-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div
                  className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
                />
              </div>
            ) : error ? (
              <div className="text-center py-8" style={{ color: 'rgb(var(--destructive))' }}>
                Failed to load modules: {error.message}
              </div>
            ) : (
              <ModuleList
                modules={installedModules ?? []}
                onModuleClick={(address) => {
                  setSelectedModuleAddress(address)
                  setView('details')
                }}
              />
            )}
          </div>
        </>
      ) : (
        /* Browse All - Registry Modules */
        <div className="p-4 space-y-3">
          {isLoadingRegistry ? (
            <div className="flex justify-center py-8">
              <div
                className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
              />
            </div>
          ) : registryModules.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>No modules available</p>
            </div>
          ) : (
            registryModules.map((entry) => {
              const addr = Object.values(entry.addresses)[0] ?? ''
              const isInstalled = installedAddresses.has(addr.toLowerCase())

              return (
                <div
                  key={entry.metadata.name}
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: 'rgb(var(--card))',
                    borderWidth: 1,
                    borderColor: 'rgb(var(--border))',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: 'rgb(var(--secondary))' }}
                    >
                      {getModuleIconForType(entry.metadata.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4
                          className="font-medium truncate"
                          style={{ color: 'rgb(var(--foreground))' }}
                        >
                          {entry.metadata.name}
                        </h4>
                        {isInstalled && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgb(var(--success) / 0.1)',
                              color: 'rgb(var(--success))',
                            }}
                          >
                            Installed
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm truncate"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {entry.metadata.description}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgb(var(--primary) / 0.1)',
                            color: 'rgb(var(--primary))',
                          }}
                        >
                          {getModuleTypeName(entry.metadata.type as ModuleType)}
                        </span>
                        {entry.metadata.isVerified && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgb(var(--success) / 0.1)',
                              color: 'rgb(var(--success))',
                            }}
                          >
                            Verified
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgb(var(--secondary))',
                            color: 'rgb(var(--muted-foreground))',
                          }}
                        >
                          v{entry.metadata.version}
                        </span>
                      </div>
                    </div>
                    {!isInstalled && (
                      <button
                        type="button"
                        className="text-sm px-3 py-1 rounded-lg"
                        style={{
                          backgroundColor: 'rgb(var(--primary))',
                          color: 'white',
                        }}
                        onClick={() => {
                          setSelectedModuleType(entry.metadata.type as ModuleType)
                          setView('install')
                        }}
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ModuleCategoryTabsProps {
  modules: Array<{ type: bigint }>
  onInstallClick: (type: ModuleType) => void
}

function ModuleCategoryTabs({ modules, onInstallClick }: ModuleCategoryTabsProps) {
  const categories = [
    { type: MODULE_TYPE.VALIDATOR, icon: '🔐', label: 'Validators' },
    { type: MODULE_TYPE.EXECUTOR, icon: '⚡', label: 'Executors' },
    { type: MODULE_TYPE.HOOK, icon: '🪝', label: 'Hooks' },
    { type: MODULE_TYPE.FALLBACK, icon: '🔄', label: 'Fallbacks' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {categories.map((category) => {
        const installedCount = modules.filter((m) => m.type === category.type).length

        return (
          <div
            key={String(category.type)}
            className="category-card p-3 rounded-lg"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{category.icon}</span>
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {category.label}
                </span>
              </div>
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {installedCount} installed
              </span>
            </div>
            <button
              type="button"
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
              onClick={() => onInstallClick(category.type)}
            >
              + Add {category.label.slice(0, -1)}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function getModuleIconForType(type: bigint): string {
  const icons: Record<string, string> = {
    '1': '🔐',
    '2': '⚡',
    '3': '🔄',
    '4': '🪝',
    '5': '📋',
    '6': '✍️',
  }
  return icons[String(type)] ?? '📦'
}

export default ModulesPage
