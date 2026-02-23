import { getModuleTypeName, MODULE_TYPE, type ModuleType } from '@stablenet/core'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountType } from '../../../types/account'
import { useSelectedNetwork, useWalletStore } from '../../hooks'
import { DelegateSetup } from './DelegateSetup'
import { useModuleMarketplace } from './hooks/useModuleMarketplace'
import { useModules } from './hooks/useModules'
import { useSmartAccountInfo } from './hooks/useSmartAccountInfo'

import { EntryPointDeposit } from './EntryPointDeposit'
import { GasSponsorshipView } from './GasSponsorshipView'
import { InstallModuleWizard } from './InstallModule'
import { ModuleDetails } from './ModuleDetails'
import { ModuleList } from './ModuleList'
import { SessionKeysView } from './SessionKeysView'
import { SmartAccountDashboard } from './SmartAccountDashboard'
import { SpendingLimitsView } from './SpendingLimitsView'

// ============================================================================
// Types
// ============================================================================

type ModuleView = 'overview' | 'list' | 'details' | 'install' | 'delegate' | 'gas-sponsorship' | 'session-keys' | 'spending-limits' | 'deposit'
type ModuleTab = 'installed' | 'browse'

// ============================================================================
// Component
// ============================================================================

export function ModulesPage() {
  const { t } = useTranslation('modules')
  const { accounts, selectedAccount: selectedAccountAddress, syncWithBackground } = useWalletStore()
  const [view, setView] = useState<ModuleView>('overview')
  const [activeTab, setActiveTab] = useState<ModuleTab>('installed')
  const [selectedModuleAddress, setSelectedModuleAddress] = useState<string | null>(null)
  const [selectedModuleType, setSelectedModuleType] = useState<ModuleType | null>(null)
  const [delegateMode, setDelegateMode] = useState<'setup' | 'revoke'>('setup')

  // Find the full account object from the accounts array
  const selectedAccount = useMemo(() => {
    if (!selectedAccountAddress) return null
    return accounts.find((a) => a.address === selectedAccountAddress) ?? null
  }, [accounts, selectedAccountAddress])

  const currentNetwork = useSelectedNetwork()
  const { installedModules, isLoading, error, refetch } = useModules(selectedAccount?.address)
  const { registryModules, isLoading: isLoadingRegistry } = useModuleMarketplace()
  const {
    info: smartAccountInfo,
    isLoading: isLoadingSmartInfo,
    refetch: refetchSmartAccountInfo,
  } = useSmartAccountInfo(selectedAccount?.address)

  // Sync UI store when background detects account type change (e.g. existing delegation)
  useEffect(() => {
    if (!smartAccountInfo || !selectedAccount ||
        smartAccountInfo.accountType === selectedAccount.type) return

    useWalletStore.setState((state) => ({
      accounts: state.accounts.map((a) =>
        a.address === selectedAccount.address
          ? { ...a, type: smartAccountInfo.accountType as AccountType }
          : a
      ),
    }))
  }, [smartAccountInfo, selectedAccount])

  // Determine which registry modules are already installed
  const installedAddresses = useMemo(() => {
    const set = new Set<string>()
    if (installedModules) {
      for (const m of installedModules) set.add(m.address.toLowerCase())
    }
    return set
  }, [installedModules])

  // View: Delegate Setup (EIP-7702) — supports both setup and revoke modes
  if (view === 'delegate' && selectedAccountAddress) {
    return (
      <DelegateSetup
        account={selectedAccountAddress}
        mode={delegateMode}
        onComplete={async () => {
          await refetchSmartAccountInfo()
          await syncWithBackground()
          setView('overview')
          setDelegateMode('setup')
          refetch()
        }}
        onCancel={() => {
          setView('overview')
          setDelegateMode('setup')
        }}
      />
    )
  }

  // Determine if account is smart/delegated (store type OR on-chain info)
  const isSmartAccount =
    selectedAccount?.type === 'smart' ||
    selectedAccount?.type === 'delegated' ||
    smartAccountInfo?.isDelegated ||
    smartAccountInfo?.accountType === 'smart' ||
    smartAccountInfo?.accountType === 'delegated'

  // Guard: Account not Smart Account capable - show delegation setup option
  // Skip guard while smart account info is still loading to avoid flash
  if (!selectedAccount || (!isSmartAccount && !isLoadingSmartInfo)) {
    return (
      <div className="modules-page p-4">
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            {t('smartAccountRequired')}
          </h2>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('smartAccountRequiredDesc')}
          </p>
          <button
            type="button"
            className="btn-primary px-4 py-2 rounded-lg"
            onClick={() => setView('delegate')}
          >
            {t('enableSmartAccount')}
          </button>
        </div>
      </div>
    )
  }

  // View: Smart Account Overview (default)
  if (view === 'overview') {
    return (
      <SmartAccountDashboard
        account={selectedAccount}
        network={currentNetwork}
        smartAccountInfo={smartAccountInfo}
        installedModules={installedModules}
        isLoading={isLoading || isLoadingSmartInfo}
        onNavigateToModules={() => setView('list')}
        onNavigateToInstall={() => setView('install')}
        onNavigateToGasSponsorship={() => setView('gas-sponsorship')}
        onNavigateToSessionKeys={() => setView('session-keys')}
        onNavigateToSpendingLimits={() => setView('spending-limits')}
        onNavigateToDeposit={() => setView('deposit')}
        onRevokeDelegation={() => {
          setDelegateMode('revoke')
          setView('delegate')
        }}
      />
    )
  }

  // View: Gas Sponsorship
  if (view === 'gas-sponsorship') {
    return (
      <GasSponsorshipView
        account={selectedAccount}
        network={currentNetwork}
        onBack={() => setView('overview')}
      />
    )
  }

  // View: EntryPoint Deposit
  if (view === 'deposit') {
    return (
      <EntryPointDeposit
        account={selectedAccount}
        network={currentNetwork}
        onBack={() => setView('overview')}
      />
    )
  }

  // View: Session Keys
  if (view === 'session-keys') {
    return (
      <SessionKeysView
        account={selectedAccount}
        installedModules={installedModules}
        onBack={() => setView('overview')}
        onNavigateToInstall={() => {
          setSelectedModuleType(MODULE_TYPE.EXECUTOR)
          setView('install')
        }}
        onModuleClick={(address) => {
          setSelectedModuleAddress(address)
          setView('details')
        }}
      />
    )
  }

  // View: Spending Limits
  if (view === 'spending-limits') {
    return (
      <SpendingLimitsView
        account={selectedAccount}
        installedModules={installedModules}
        onBack={() => setView('overview')}
        onNavigateToInstall={() => {
          setSelectedModuleType(MODULE_TYPE.HOOK)
          setView('install')
        }}
      />
    )
  }

  // View: Module Details
  if (view === 'details' && selectedModuleAddress) {
    const selectedModule = installedModules?.find((m) => m.address === selectedModuleAddress)

    return (
      <ModuleDetails
        module={selectedModule}
        onBack={() => {
          setView('overview')
          setSelectedModuleAddress(null)
        }}
        onUninstall={async () => {
          // Handle uninstall
          await refetch()
          setView('overview')
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
          setView('overview')
        }}
        onCancel={() => {
          setView('overview')
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-lg"
            style={{ color: 'rgb(var(--foreground))' }}
            onClick={() => setView('overview')}
          >
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {t('title')}
          </h1>
        </div>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 rounded-lg text-sm font-medium"
          onClick={() => setView('install')}
        >
          {t('addModule')}
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
            {tab === 'installed'
              ? t('installed', { count: installedModules?.length ?? 0 })
              : t('browseAll')}
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
                {t('failedToLoadModules', { message: error.message })}
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
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>{t('noModulesAvailable')}</p>
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
                            {t('installedBadge')}
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
                            {t('verified')}
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgb(var(--secondary))',
                            color: 'rgb(var(--muted-foreground))',
                          }}
                        >
                          {t('version', { version: entry.metadata.version })}
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
                        {t('install')}
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
  const { t } = useTranslation('modules')

  const categories = [
    {
      type: MODULE_TYPE.VALIDATOR,
      icon: '🔐',
      label: t('validators'),
      singular: t('validators').slice(0, -1),
    },
    {
      type: MODULE_TYPE.EXECUTOR,
      icon: '⚡',
      label: t('executors'),
      singular: t('executors').slice(0, -1),
    },
    { type: MODULE_TYPE.HOOK, icon: '🪝', label: t('hooks'), singular: t('hooks').slice(0, -1) },
    {
      type: MODULE_TYPE.FALLBACK,
      icon: '🔄',
      label: t('fallbacks'),
      singular: t('fallbacks').slice(0, -1),
    },
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
                {t('countInstalled', { count: installedCount })}
              </span>
            </div>
            <button
              type="button"
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
              onClick={() => onInstallClick(category.type)}
            >
              {t('addCategory', { category: category.singular })}
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
