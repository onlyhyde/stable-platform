import { MODULE_TYPE, type ModuleType } from '@stablenet/core'
import { useMemo, useState } from 'react'

import { useWalletStore } from '../../hooks'
import { DelegateSetup } from './DelegateSetup'
import { useModules } from './hooks/useModules'

import { InstallModuleWizard } from './InstallModule'
import { ModuleDetails } from './ModuleDetails'
import { ModuleList } from './ModuleList'

// ============================================================================
// Types
// ============================================================================

type ModuleView = 'list' | 'details' | 'install' | 'delegate'

// ============================================================================
// Component
// ============================================================================

export function ModulesPage() {
  const { accounts, selectedAccount: selectedAccountAddress } = useWalletStore()
  const [view, setView] = useState<ModuleView>('list')
  const [selectedModuleAddress, setSelectedModuleAddress] = useState<string | null>(null)
  const [selectedModuleType, setSelectedModuleType] = useState<ModuleType | null>(null)

  // Find the full account object from the accounts array
  const selectedAccount = useMemo(() => {
    if (!selectedAccountAddress) return null
    return accounts.find((a) => a.address === selectedAccountAddress) ?? null
  }, [accounts, selectedAccountAddress])

  const { installedModules, isLoading, error, refetch } = useModules(selectedAccount?.address)

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
            Module management is only available for Smart Accounts. Upgrade your EOA via EIP-7702 delegation.
          </p>
          <button
            className="btn-primary px-4 py-2 rounded-lg"
            onClick={() => setView('delegate')}
          >
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
          className="btn-primary px-3 py-1.5 rounded-lg text-sm font-medium"
          onClick={() => setView('install')}
        >
          + Add Module
        </button>
      </div>

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

export default ModulesPage
