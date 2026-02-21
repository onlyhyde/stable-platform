'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Hex } from 'viem'
import {
  Card,
  CardContent,
  ConnectWalletCard,
  InfoBanner,
  Input,
  PageHeader,
} from '@/components/common'
import { useToast } from '@/components/common/Toast'
import {
  CategoryFilter,
  InstallModuleModal,
  ModuleCard,
  type ModuleCardData,
  ModuleDetailModal,
} from '@/components/marketplace'
import { useModuleInstall, useSmartAccount, useWallet } from '@/hooks'
import { useModuleRegistry } from '@/hooks/useModuleRegistry'

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedType, setSelectedType] = useState('all')

  // Modal state
  const [installModalModule, setInstallModalModule] = useState<ModuleCardData | null>(null)
  const [detailModalModule, setDetailModalModule] = useState<ModuleCardData | null>(null)

  // Hooks
  const { isConnected, isConnecting, address, connect, connectors } = useWallet()
  const { status } = useSmartAccount()
  const { addToast, updateToast } = useToast()
  const {
    installModule,
    uninstallModule,
    installedModules,
    installingModuleId,
    uninstallingModuleId,
    loadInstalledModules,
  } = useModuleInstall()
  const { modules: MODULE_CATALOG, isLoading: isLoadingRegistry } = useModuleRegistry()

  // Load on-chain installed status when smart account is ready
  useEffect(() => {
    if (isConnected && status.isSmartAccount && MODULE_CATALOG.length > 0) {
      loadInstalledModules(MODULE_CATALOG.map((m) => m.id))
    }
  }, [isConnected, status.isSmartAccount, loadInstalledModules, MODULE_CATALOG])

  // ============================================================================
  // Handlers
  // ============================================================================

  const findModule = useCallback(
    (id: string) => MODULE_CATALOG.find((m) => m.id === id) ?? null,
    []
  )

  const handleInstallClick = useCallback(
    (moduleId: string) => {
      if (!isConnected) {
        addToast({ type: 'info', title: 'Connect your wallet first' })
        return
      }
      if (!status.isSmartAccount) {
        addToast({
          type: 'info',
          title: 'Smart Account Required',
          message: 'Upgrade your account via the Settings page to install modules.',
        })
        return
      }
      setInstallModalModule(findModule(moduleId))
    },
    [isConnected, status.isSmartAccount, addToast, findModule]
  )

  const handleViewDetails = useCallback(
    (moduleId: string) => {
      setDetailModalModule(findModule(moduleId))
    },
    [findModule]
  )

  const handleInstallConfirm = useCallback(
    async (moduleId: string, initData?: Hex) => {
      const mod = findModule(moduleId)
      const toastId = addToast({
        type: 'loading',
        title: `Installing ${mod?.name ?? moduleId}...`,
        message: 'Please confirm the transaction in your wallet.',
        persistent: true,
      })

      const result = await installModule({ moduleId, initData })

      if (result.success) {
        updateToast(toastId, {
          type: 'success',
          title: `${mod?.name ?? moduleId} installed`,
          message: 'Module has been installed on your smart account.',
          txHash: result.txHash,
          persistent: false,
        })
        setInstallModalModule(null)
      } else {
        updateToast(toastId, {
          type: 'error',
          title: 'Installation failed',
          message: result.error,
          persistent: false,
        })
      }
    },
    [installModule, addToast, updateToast, findModule]
  )

  const handleDetailInstallClick = useCallback(() => {
    if (detailModalModule) {
      setDetailModalModule(null)
      handleInstallClick(detailModalModule.id)
    }
  }, [detailModalModule, handleInstallClick])

  const handleDetailUninstallClick = useCallback(async () => {
    if (!detailModalModule) return

    const mod = detailModalModule
    setDetailModalModule(null)

    const toastId = addToast({
      type: 'loading',
      title: `Uninstalling ${mod.name}...`,
      message: 'Please confirm the transaction in your wallet.',
      persistent: true,
    })

    const result = await uninstallModule({ moduleId: mod.id })

    if (result.success) {
      updateToast(toastId, {
        type: 'success',
        title: `${mod.name} uninstalled`,
        message: 'Module has been removed from your smart account.',
        txHash: result.txHash,
        persistent: false,
      })
    } else {
      updateToast(toastId, {
        type: 'error',
        title: 'Uninstall failed',
        message: result.error,
        persistent: false,
      })
    }
  }, [detailModalModule, addToast, updateToast, uninstallModule])

  // ============================================================================
  // Filtering
  // ============================================================================

  const filteredModules = useMemo(() => {
    let results = MODULE_CATALOG

    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      results = results.filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.description.toLowerCase().includes(lower) ||
          m.tags.some((t) => t.toLowerCase().includes(lower))
      )
    }

    if (selectedCategory !== 'all') {
      results = results.filter((m) => m.category === selectedCategory)
    }

    if (selectedType !== 'all') {
      results = results.filter((m) => m.moduleType === selectedType)
    }

    return results
  }, [searchQuery, selectedCategory, selectedType])

  const featuredModules = MODULE_CATALOG.filter((m) => m.featured)

  const stats = {
    totalModules: MODULE_CATALOG.length,
    totalInstalls: MODULE_CATALOG.reduce((sum, m) => sum + m.installCount, 0),
    verifiedModules: MODULE_CATALOG.filter(
      (m) => m.auditStatus === 'verified' || m.auditStatus === 'audited'
    ).length,
  }

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderModuleCard = (module: ModuleCardData) => (
    <ModuleCard
      key={module.id}
      module={module}
      installed={installedModules.has(module.id)}
      isInstalling={installingModuleId === module.id}
      onInstall={handleInstallClick}
      onViewDetails={handleViewDetails}
    />
  )

  // ============================================================================
  // Wallet not connected
  // ============================================================================

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Module Marketplace"
          description="Browse and install ERC-7579 modules to extend your smart account capabilities"
        />
        <ConnectWalletCard
          onConnect={connect}
          isConnecting={isConnecting}
          title="Connect Your Wallet"
          description="Connect your wallet to browse and install smart account modules."
          connectors={connectors}
        />
      </div>
    )
  }

  // ============================================================================
  // Main render
  // ============================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Marketplace"
        description="Browse and install ERC-7579 modules to extend your smart account capabilities"
      />

      {/* Smart Account upgrade banner */}
      {isConnected && !status.isSmartAccount && !status.isLoading && (
        <InfoBanner
          variant="warning"
          title="Smart Account Required"
          description="Upgrade your EOA to a Smart Account in Settings to install modules."
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {stats.totalModules}
            </div>
            <div className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Available Modules
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {stats.totalInstalls.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Total Installs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: 'rgb(var(--primary))' }}>
              {stats.verifiedModules}
            </div>
            <div className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Audited / Verified
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search modules by name, description, or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: 'rgb(var(--muted-foreground))' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Filters */}
      <CategoryFilter
        selectedCategory={selectedCategory}
        selectedType={selectedType}
        onCategoryChange={setSelectedCategory}
        onTypeChange={setSelectedType}
      />

      {/* Featured Section (only when no filters active) */}
      {!searchQuery && selectedCategory === 'all' && selectedType === 'all' && (
        <div>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'rgb(var(--foreground))' }}>
            Featured Modules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredModules.map(renderModuleCard)}
          </div>
        </div>
      )}

      {/* All Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {searchQuery ? 'Search Results' : 'All Modules'}
          </h2>
          <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {filteredModules.length} module{filteredModules.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredModules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>
                No modules found matching your criteria.
              </p>
              <button
                type="button"
                className="mt-2 text-sm font-medium"
                style={{ color: 'rgb(var(--primary))' }}
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                  setSelectedType('all')
                }}
              >
                Clear filters
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModules.map(renderModuleCard)}
          </div>
        )}
      </div>

      {/* Install Modal */}
      <InstallModuleModal
        isOpen={installModalModule !== null}
        onClose={() => setInstallModalModule(null)}
        module={installModalModule}
        onInstall={handleInstallConfirm}
        isInstalling={installingModuleId !== null}
        isSmartAccount={status.isSmartAccount}
        walletAddress={address}
      />

      {/* Detail Modal */}
      <ModuleDetailModal
        isOpen={detailModalModule !== null}
        onClose={() => setDetailModalModule(null)}
        module={detailModalModule}
        installed={detailModalModule ? installedModules.has(detailModalModule.id) : false}
        onInstallClick={handleDetailInstallClick}
        onUninstallClick={handleDetailUninstallClick}
      />
    </div>
  )
}
