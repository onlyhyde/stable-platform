import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '../../i18n'
import type { ConnectedSite, Network } from '../../types'
import { useWalletStore } from '../hooks/useWalletStore'

export function Settings() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { i18n } = useTranslation()

  const {
    networks,
    selectedChainId,
    selectedAccount,
    accounts,
    selectNetwork,
    lockWallet,
    importPrivateKey,
    addNetwork,
    removeNetwork,
    updateNetwork,
    syncWithBackground,
  } = useWalletStore()

  // Determine if current account is a smart account
  const currentAccount = useMemo(() => {
    if (!selectedAccount) return null
    return accounts.find((a) => a.address === selectedAccount) ?? null
  }, [accounts, selectedAccount])

  const isSmartAccount = currentAccount?.type === 'smart'

  const [metaMaskMode, setMetaMaskMode] = useState(false)
  const [autoLockMinutes, setAutoLockMinutes] = useState(5)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Import Private Key state
  const [showImportKey, setShowImportKey] = useState(false)
  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  // Add Network state
  const [showAddNetwork, setShowAddNetwork] = useState(false)
  const [networkForm, setNetworkForm] = useState({
    name: '',
    chainId: '',
    rpcUrl: '',
    bundlerUrl: '',
    currencySymbol: '',
    explorerUrl: '',
    indexerUrl: '',
  })
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [networkSuccess, setNetworkSuccess] = useState<string | null>(null)

  // Edit Network state
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    rpcUrl: '',
    bundlerUrl: '',
    paymasterUrl: '',
    explorerUrl: '',
    indexerUrl: '',
    currencySymbol: '',
  })
  const [isSavingNetwork, setIsSavingNetwork] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  // Import/Export state
  const [isImportingNetworks, setIsImportingNetworks] = useState(false)
  const [importNetworkResult, setImportNetworkResult] = useState<string | null>(null)

  // Export Private Key state
  const [showExportKey, setShowExportKey] = useState(false)
  const [exportedKey, setExportedKey] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  // Connected Sites state
  const [showConnectedSites, setShowConnectedSites] = useState(false)
  const [connectedSites, setConnectedSites] = useState<ConnectedSite[]>([])
  const [isLoadingSites, setIsLoadingSites] = useState(false)

  // Ledger state
  const [isLedgerConnected, setIsLedgerConnected] = useState(false)
  const [isLedgerConnecting, setIsLedgerConnecting] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerDiscoveredAccounts, setLedgerDiscoveredAccounts] = useState<
    Array<{ address: string; path: string; index: number; selected: boolean }>
  >([])
  const [isDiscoveringAccounts, setIsDiscoveringAccounts] = useState(false)
  const [isAddingLedgerAccounts, setIsAddingLedgerAccounts] = useState(false)

  // Smart Account state
  const [showSmartAccount, setShowSmartAccount] = useState(false)
  const [saInfo, setSaInfo] = useState<{
    accountType: string
    isDeployed: boolean
    rootValidator: string | null
    accountId: string | null
    delegationTarget: string | null
    isDelegated: boolean
  } | null>(null)
  const [isLoadingSaInfo, setIsLoadingSaInfo] = useState(false)
  const [newValidator, setNewValidator] = useState('')
  const [isSettingValidator, setIsSettingValidator] = useState(false)
  const [validatorError, setValidatorError] = useState<string | null>(null)
  const [validatorSuccess, setValidatorSuccess] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        // Get MetaMask mode
        const mmResponse = await chrome.runtime.sendMessage({
          type: 'GET_METAMASK_MODE',
          id: `mm-${Date.now()}`,
          payload: {},
        })
        if (mmResponse?.payload?.enabled !== undefined) {
          setMetaMaskMode(mmResponse.payload.enabled)
        }

        // Get auto-lock timeout
        const alResponse = await chrome.runtime.sendMessage({
          type: 'GET_AUTO_LOCK_TIMEOUT',
          id: `al-${Date.now()}`,
          payload: {},
        })
        if (alResponse?.payload?.minutes !== undefined) {
          setAutoLockMinutes(alResponse.payload.minutes)
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadSettings()
  }, [])

  const handleMetaMaskModeChange = useCallback(async () => {
    const newValue = !metaMaskMode
    setMetaMaskMode(newValue)

    try {
      await chrome.runtime.sendMessage({
        type: 'SET_METAMASK_MODE',
        id: `mm-set-${Date.now()}`,
        payload: { enabled: newValue },
      })

      // Persist to chrome.storage.local for the inpage script
      // Background already handles SET_METAMASK_MODE above
      chrome.storage.local.set({ __stablenetAppearAsMM__: newValue })
    } catch {
      // Revert on error
      setMetaMaskMode(!newValue)
    }
  }, [metaMaskMode])

  const handleAutoLockChange = useCallback(async (minutes: number) => {
    setAutoLockMinutes(minutes)

    try {
      await chrome.runtime.sendMessage({
        type: 'SET_AUTO_LOCK_TIMEOUT',
        id: `al-set-${Date.now()}`,
        payload: { minutes },
      })
    } catch {
      // Silent fail
    }
  }, [])

  const handleLockWallet = useCallback(async () => {
    await lockWallet()
  }, [lockWallet])

  const handleLanguageChange = useCallback(async (lng: string) => {
    await changeLanguage(lng)
  }, [])

  // Import Private Key handlers
  const handleImportPrivateKey = useCallback(async () => {
    if (!privateKeyInput.trim()) {
      setImportError(t('pleaseEnterPrivateKey'))
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      // Ensure the private key has 0x prefix
      let key = privateKeyInput.trim()
      if (!key.startsWith('0x')) {
        key = `0x${key}`
      }

      const address = await importPrivateKey(key)
      setImportSuccess(
        t('accountImported', { address: `${address.slice(0, 10)}...${address.slice(-8)}` })
      )
      setPrivateKeyInput('')
      setShowImportKey(false)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('failedToImport'))
    } finally {
      setIsImporting(false)
    }
  }, [privateKeyInput, importPrivateKey, t])

  // Add Network handlers
  const handleAddNetwork = useCallback(async () => {
    // Validate form
    if (!networkForm.name.trim()) {
      setNetworkError(t('networkNameRequired'))
      return
    }
    if (!networkForm.chainId.trim() || Number.isNaN(Number(networkForm.chainId))) {
      setNetworkError(t('validChainIdRequired'))
      return
    }
    if (!networkForm.rpcUrl.trim()) {
      setNetworkError(t('rpcUrlRequired'))
      return
    }

    // Check for duplicate chain ID
    const chainId = Number(networkForm.chainId)
    if (networks.some((n) => n.chainId === chainId)) {
      setNetworkError(t('chainIdExists'))
      return
    }

    setIsAddingNetwork(true)
    setNetworkError(null)
    setNetworkSuccess(null)

    try {
      const network: Network = {
        name: networkForm.name.trim(),
        chainId,
        rpcUrl: networkForm.rpcUrl.trim(),
        bundlerUrl: networkForm.bundlerUrl.trim() || networkForm.rpcUrl.trim(),
        explorerUrl: networkForm.explorerUrl.trim() || undefined,
        indexerUrl: networkForm.indexerUrl.trim() || undefined,
        currency: {
          name: networkForm.currencySymbol.trim() || 'Native',
          symbol: networkForm.currencySymbol.trim(),
          decimals: 18,
        },
        isCustom: true,
      }

      await addNetwork(network)
      setNetworkSuccess(t('networkAdded', { name: network.name }))
      setNetworkForm({
        name: '',
        chainId: '',
        rpcUrl: '',
        bundlerUrl: '',
        currencySymbol: '',
        explorerUrl: '',
        indexerUrl: '',
      })
      setShowAddNetwork(false)
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : t('failedToAddNetwork'))
    } finally {
      setIsAddingNetwork(false)
    }
  }, [networkForm, networks, addNetwork, t])

  const handleRemoveNetwork = useCallback(
    async (chainId: number) => {
      if (!confirm(t('removeNetworkConfirm'))) {
        return
      }

      try {
        await removeNetwork(chainId)
        await syncWithBackground()
      } catch (err) {
        alert(err instanceof Error ? err.message : t('failedToRemoveNetwork'))
      }
    },
    [removeNetwork, syncWithBackground, t]
  )

  // Edit Network handlers
  const handleStartEdit = useCallback((network: Network) => {
    setEditingNetwork(network)
    setEditForm({
      name: network.name,
      rpcUrl: network.rpcUrl,
      bundlerUrl: network.bundlerUrl ?? '',
      paymasterUrl: network.paymasterUrl ?? '',
      explorerUrl: network.explorerUrl ?? '',
      indexerUrl: network.indexerUrl ?? '',
      currencySymbol: network.currency.symbol,
    })
    setEditError(null)
    setEditSuccess(null)
    setShowAddNetwork(false)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingNetwork(null)
    setEditError(null)
    setEditSuccess(null)
  }, [])

  const handleSaveNetwork = useCallback(async () => {
    if (!editingNetwork) return

    if (!editForm.name.trim()) {
      setEditError(t('networkNameRequired'))
      return
    }
    if (!editForm.rpcUrl.trim()) {
      setEditError(t('rpcUrlRequired'))
      return
    }

    setIsSavingNetwork(true)
    setEditError(null)
    setEditSuccess(null)

    try {
      const updates: Partial<Network> = {
        name: editForm.name.trim(),
        rpcUrl: editForm.rpcUrl.trim(),
        bundlerUrl: editForm.bundlerUrl.trim() || undefined,
        paymasterUrl: editForm.paymasterUrl.trim() || undefined,
        explorerUrl: editForm.explorerUrl.trim() || undefined,
        indexerUrl: editForm.indexerUrl.trim() || undefined,
        currency: {
          name: editForm.currencySymbol.trim() || editingNetwork.currency.name,
          symbol: editForm.currencySymbol.trim() || editingNetwork.currency.symbol,
          decimals: editingNetwork.currency.decimals,
        },
      }

      await updateNetwork(editingNetwork.chainId, updates)
      setEditSuccess(t('networkUpdated'))
      setEditingNetwork(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('failedToUpdateNetwork'))
    } finally {
      setIsSavingNetwork(false)
    }
  }, [editingNetwork, editForm, updateNetwork, t])

  // Import Networks handler
  const handleImportNetworks = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsImportingNetworks(true)
      setImportNetworkResult(null)

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        const importedNetworks: Network[] = Array.isArray(data)
          ? data
          : Array.isArray(data.networks)
            ? data.networks
            : []

        if (importedNetworks.length === 0) {
          setImportNetworkResult(t('invalidNetworkFile'))
          return
        }

        let added = 0
        let updated = 0
        let failed = 0

        for (const net of importedNetworks) {
          if (!net.name || !net.chainId || !net.rpcUrl) {
            failed++
            continue
          }

          const existing = networks.find((n) => n.chainId === net.chainId)
          try {
            if (existing) {
              await updateNetwork(net.chainId, {
                name: net.name,
                rpcUrl: net.rpcUrl,
                bundlerUrl: net.bundlerUrl,
                paymasterUrl: net.paymasterUrl,
                explorerUrl: net.explorerUrl,
                indexerUrl: net.indexerUrl,
                currency: net.currency,
                isTestnet: net.isTestnet,
              })
              updated++
            } else {
              await addNetwork({ ...net, isCustom: true })
              added++
            }
          } catch {
            failed++
          }
        }

        setImportNetworkResult(t('importResult', { added, updated, failed }))
        await syncWithBackground()
      } catch {
        setImportNetworkResult(t('invalidNetworkFile'))
      } finally {
        setIsImportingNetworks(false)
        // Reset file input
        event.target.value = ''
      }
    },
    [networks, addNetwork, updateNetwork, syncWithBackground, t]
  )

  // Export Networks handler
  const handleExportNetworks = useCallback(() => {
    const data = {
      version: 1,
      networks: networks.map(({ ...n }) => n),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'networks.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [networks])

  // Export Private Key handler
  const handleExportPrivateKey = useCallback(async () => {
    const { selectedAccount } = useWalletStore.getState()
    if (!selectedAccount) {
      setExportError(t('noAccountSelected'))
      return
    }

    setIsExporting(true)
    setExportError(null)
    setExportedKey(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_PRIVATE_KEY',
        id: `export-${Date.now()}`,
        payload: { address: selectedAccount },
      })

      if (response?.payload?.success) {
        setExportedKey(response.payload.privateKey)
      } else {
        setExportError(response?.payload?.error ?? t('failedToExportKey'))
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('failedToExportKey'))
    } finally {
      setIsExporting(false)
    }
  }, [t])

  // Load Connected Sites handler
  const loadConnectedSites = useCallback(async () => {
    setIsLoadingSites(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CONNECTED_SITES',
        id: `sites-${Date.now()}`,
        payload: {},
      })

      if (response?.payload?.sites) {
        setConnectedSites(response.payload.sites)
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingSites(false)
    }
  }, [])

  // Disconnect Site handler
  const handleDisconnectSite = useCallback(
    async (origin: string) => {
      try {
        await chrome.runtime.sendMessage({
          type: 'DISCONNECT_SITE',
          id: `disconnect-${Date.now()}`,
          payload: { origin },
        })

        // Refresh the list
        await loadConnectedSites()
      } catch {
        // Silent fail
      }
    },
    [loadConnectedSites]
  )

  // Open Connected Sites
  const handleOpenConnectedSites = useCallback(() => {
    setShowConnectedSites(true)
    loadConnectedSites()
  }, [loadConnectedSites])

  // Close Export Key modal
  const handleCloseExportKey = useCallback(() => {
    setShowExportKey(false)
    setExportedKey(null)
    setExportError(null)
    setShowKey(false)
  }, [])

  // Load Smart Account Info
  const loadSmartAccountInfo = useCallback(async () => {
    if (!selectedAccount || !selectedChainId) return
    setIsLoadingSaInfo(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `sa-info-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'stablenet_getSmartAccountInfo',
          params: [{ account: selectedAccount, chainId: selectedChainId }],
        },
      })
      if (response?.payload?.result) {
        setSaInfo(response.payload.result)
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingSaInfo(false)
    }
  }, [selectedAccount, selectedChainId])

  // Open Smart Account section
  const handleOpenSmartAccount = useCallback(() => {
    setShowSmartAccount(true)
    loadSmartAccountInfo()
  }, [loadSmartAccountInfo])

  // Set Root Validator handler
  const handleSetRootValidator = useCallback(async () => {
    if (!newValidator.trim()) {
      setValidatorError(t('pleaseEnterValidator'))
      return
    }
    if (!newValidator.match(/^0x[0-9a-fA-F]{40}$/)) {
      setValidatorError(t('invalidAddressFormat'))
      return
    }

    setIsSettingValidator(true)
    setValidatorError(null)
    setValidatorSuccess(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `set-validator-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'stablenet_setRootValidator',
          params: [{ account: selectedAccount, validator: newValidator, chainId: selectedChainId }],
        },
      })

      if (response?.payload?.result) {
        setValidatorSuccess(t('validatorUpdated'))
        setNewValidator('')
        // Refresh SA info
        await loadSmartAccountInfo()
      } else if (response?.payload?.error) {
        setValidatorError(response.payload.error.message ?? t('failedToSetValidator'))
      }
    } catch (err) {
      setValidatorError(err instanceof Error ? err.message : t('failedToSetValidator'))
    } finally {
      setIsSettingValidator(false)
    }
  }, [newValidator, selectedAccount, selectedChainId, loadSmartAccountInfo, t])

  // Ledger handlers
  const handleConnectLedger = useCallback(async () => {
    setIsLedgerConnecting(true)
    setLedgerError(null)
    setLedgerDiscoveredAccounts([])

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LEDGER_CONNECT',
        id: `ledger-connect-${Date.now()}`,
        payload: {},
      })

      if (response?.payload?.success) {
        setIsLedgerConnected(true)

        // Auto-discover first 5 accounts
        setIsDiscoveringAccounts(true)
        const discoverResponse = await chrome.runtime.sendMessage({
          type: 'LEDGER_DISCOVER_ACCOUNTS',
          id: `ledger-discover-${Date.now()}`,
          payload: { startIndex: 0, count: 5 },
        })

        if (discoverResponse?.payload?.success) {
          setLedgerDiscoveredAccounts(
            discoverResponse.payload.accounts.map(
              (a: { address: string; path: string; index: number }) => ({
                ...a,
                selected: false,
              })
            )
          )
        } else {
          setLedgerError(discoverResponse?.payload?.error ?? t('ledgerError', { error: 'Unknown' }))
        }
        setIsDiscoveringAccounts(false)
      } else {
        setLedgerError(response?.payload?.error ?? t('ledgerError', { error: 'Connection failed' }))
      }
    } catch (err) {
      setLedgerError(err instanceof Error ? err.message : t('ledgerError', { error: 'Unknown' }))
    } finally {
      setIsLedgerConnecting(false)
    }
  }, [t])

  const handleDisconnectLedger = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'LEDGER_DISCONNECT',
        id: `ledger-disconnect-${Date.now()}`,
        payload: {},
      })
      setIsLedgerConnected(false)
      setLedgerDiscoveredAccounts([])
      setLedgerError(null)
    } catch {
      // Silent fail
    }
  }, [])

  const handleToggleLedgerAccount = useCallback((index: number) => {
    setLedgerDiscoveredAccounts((prev) =>
      prev.map((a) => (a.index === index ? { ...a, selected: !a.selected } : a))
    )
  }, [])

  const handleAddLedgerAccounts = useCallback(async () => {
    const selectedAccounts = ledgerDiscoveredAccounts.filter((a) => a.selected)
    if (selectedAccounts.length === 0) return

    setIsAddingLedgerAccounts(true)
    setLedgerError(null)

    try {
      for (const account of selectedAccounts) {
        await chrome.runtime.sendMessage({
          type: 'LEDGER_ADD_ACCOUNT',
          id: `ledger-add-${Date.now()}-${account.index}`,
          payload: {
            account: {
              address: account.address,
              path: account.path,
              index: account.index,
            },
          },
        })
      }

      // Remove added accounts from discovered list
      setLedgerDiscoveredAccounts((prev) => prev.filter((a) => !a.selected))

      // Sync state
      await syncWithBackground()
    } catch (err) {
      setLedgerError(err instanceof Error ? err.message : t('ledgerError', { error: 'Unknown' }))
    } finally {
      setIsAddingLedgerAccounts(false)
    }
  }, [ledgerDiscoveredAccounts, syncWithBackground, t])

  const autoLockOptions = [
    { value: 1, label: t('1minute') },
    { value: 5, label: t('5minutes') },
    { value: 15, label: t('15minutes') },
    { value: 30, label: t('30minutes') },
    { value: 60, label: t('1hour') },
    { value: 0, label: t('never') },
  ]

  return (
    <div
      className="p-4"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      <h2 className="text-xl font-bold mb-6" style={{ color: 'rgb(var(--foreground))' }}>
        {t('title')}
      </h2>

      <div className="space-y-6">
        {/* Network Settings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-sm font-medium"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('network')}
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs cursor-pointer" style={{ color: 'rgb(var(--primary))' }}>
                {isImportingNetworks ? t('importingNetworks') : t('importNetworks')}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportNetworks}
                  disabled={isImportingNetworks}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleExportNetworks}
                className="text-xs"
                style={{ color: 'rgb(var(--primary))' }}
              >
                {t('exportNetworks')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddNetwork(!showAddNetwork)
                  setEditingNetwork(null)
                }}
                className="text-sm"
                style={{ color: 'rgb(var(--primary))' }}
              >
                {showAddNetwork ? tc('cancel') : t('addNetwork')}
              </button>
            </div>
          </div>

          {/* Import Result */}
          {importNetworkResult && (
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {importNetworkResult}
            </p>
          )}

          {/* Edit Success */}
          {editSuccess && (
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--success))' }}>
              {editSuccess}
            </p>
          )}

          {/* Add Network Form */}
          {showAddNetwork && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgb(var(--primary) / 0.1)',
                border: '1px solid rgb(var(--primary) / 0.2)',
              }}
            >
              <h4 className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--foreground))' }}>
                {t('addCustomNetwork')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('networkName')} <span style={{ color: 'rgb(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('networkName')}
                    value={networkForm.name}
                    onChange={(e) => setNetworkForm({ ...networkForm, name: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('chainIdLabel')} <span style={{ color: 'rgb(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('chainIdPlaceholder')}
                    value={networkForm.chainId}
                    onChange={(e) => setNetworkForm({ ...networkForm, chainId: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('rpcUrlLabel')} <span style={{ color: 'rgb(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://rpc.example.com"
                    value={networkForm.rpcUrl}
                    onChange={(e) => setNetworkForm({ ...networkForm, rpcUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('bundlerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('bundlerUrlPlaceholder')}
                    value={networkForm.bundlerUrl}
                    onChange={(e) => setNetworkForm({ ...networkForm, bundlerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('currencySymbolLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('currencySymbolPlaceholder')}
                    value={networkForm.currencySymbol}
                    onChange={(e) =>
                      setNetworkForm({ ...networkForm, currencySymbol: e.target.value })
                    }
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('explorerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('explorerUrlPlaceholder')}
                    value={networkForm.explorerUrl}
                    onChange={(e) => setNetworkForm({ ...networkForm, explorerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('indexerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('indexerUrlPlaceholder')}
                    value={networkForm.indexerUrl}
                    onChange={(e) => setNetworkForm({ ...networkForm, indexerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                {networkError && (
                  <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                    {networkError}
                  </p>
                )}
                {networkSuccess && (
                  <p className="text-xs" style={{ color: 'rgb(var(--success))' }}>
                    {networkSuccess}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleAddNetwork}
                  disabled={isAddingNetwork}
                  className="btn-primary w-full py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {isAddingNetwork ? t('addingNetwork') : t('addNetworkBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Edit Network Form */}
          {editingNetwork && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgb(var(--primary) / 0.1)',
                border: '1px solid rgb(var(--primary) / 0.2)',
              }}
            >
              <h4 className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>
                {t('editingNetwork')}
              </h4>
              <p className="text-xs mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {tc('chain', { id: editingNetwork.chainId })}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('networkName')} <span style={{ color: 'rgb(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('networkName')}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('rpcUrlLabel')} <span style={{ color: 'rgb(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://rpc.example.com"
                    value={editForm.rpcUrl}
                    onChange={(e) => setEditForm({ ...editForm, rpcUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('bundlerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('bundlerUrlPlaceholder')}
                    value={editForm.bundlerUrl}
                    onChange={(e) => setEditForm({ ...editForm, bundlerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('paymasterUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('paymasterUrlPlaceholder')}
                    value={editForm.paymasterUrl}
                    onChange={(e) => setEditForm({ ...editForm, paymasterUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('currencySymbolLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('currencySymbolPlaceholder')}
                    value={editForm.currencySymbol}
                    onChange={(e) => setEditForm({ ...editForm, currencySymbol: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('explorerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('explorerUrlPlaceholder')}
                    value={editForm.explorerUrl}
                    onChange={(e) => setEditForm({ ...editForm, explorerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {t('indexerUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('indexerUrlPlaceholder')}
                    value={editForm.indexerUrl}
                    onChange={(e) => setEditForm({ ...editForm, indexerUrl: e.target.value })}
                    className="input-base w-full p-2 rounded-lg text-sm"
                  />
                </div>
                {editError && (
                  <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                    {editError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-secondary flex-1 py-2 rounded-lg text-sm"
                  >
                    {tc('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNetwork}
                    disabled={isSavingNetwork}
                    className="btn-primary flex-1 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    {isSavingNetwork ? t('savingNetwork') : t('saveNetwork')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Network List */}
          <div className="space-y-2">
            {networks.map((network) => (
              <div
                key={network.chainId}
                className="w-full p-3 rounded-lg border flex items-center justify-between transition-colors"
                style={{
                  borderColor:
                    network.chainId === selectedChainId
                      ? 'rgb(var(--primary))'
                      : 'rgb(var(--border))',
                  backgroundColor:
                    network.chainId === selectedChainId
                      ? 'rgb(var(--primary) / 0.1)'
                      : 'transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => selectNetwork(network.chainId)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        network.chainId === selectedChainId
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--border))',
                    }}
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {network.name}
                    </span>
                    {network.isCustom && (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        ({tc('custom')})
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {tc('chain', { id: network.chainId })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(network)}
                    className="p-1"
                    style={{ color: 'rgb(var(--primary))' }}
                    title={t('editNetwork')}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      role="img"
                    >
                      <title>{t('editNetwork')}</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  {network.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNetwork(network.chainId)}
                      className="p-1"
                      style={{ color: 'rgb(var(--destructive))' }}
                      title={t('removeNetwork')}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        role="img"
                      >
                        <title>{tc('remove')}</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Account Management */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-sm font-medium"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('accounts')}
            </h3>
            <button
              type="button"
              onClick={() => setShowImportKey(!showImportKey)}
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
            >
              {showImportKey ? tc('cancel') : t('importAccount')}
            </button>
          </div>

          {/* Import Private Key Form */}
          {showImportKey && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgb(var(--primary) / 0.1)',
                border: '1px solid rgb(var(--primary) / 0.2)',
              }}
            >
              <h4 className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--foreground))' }}>
                {t('importPrivateKey')}
              </h4>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder={t('enterPrivateKeyPlaceholder')}
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  className="input-base w-full p-2 rounded-lg text-sm font-mono"
                />
                {importError && (
                  <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                    {importError}
                  </p>
                )}
                {importSuccess && (
                  <p className="text-xs" style={{ color: 'rgb(var(--success))' }}>
                    {importSuccess}
                  </p>
                )}
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {t('privateKeyWarning')}
                </p>
                <button
                  type="button"
                  onClick={handleImportPrivateKey}
                  disabled={isImporting}
                  className="btn-primary w-full py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {isImporting ? t('importing') : t('importAccountBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Ledger Hardware Wallet */}
          <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  Ledger
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isLedgerConnected
                      ? 'rgb(var(--success) / 0.15)'
                      : 'rgb(var(--muted-foreground) / 0.15)',
                    color: isLedgerConnected
                      ? 'rgb(var(--success))'
                      : 'rgb(var(--muted-foreground))',
                  }}
                >
                  {isLedgerConnected ? t('ledgerConnected') : t('ledgerDisconnected')}
                </span>
              </div>
              {isLedgerConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectLedger}
                  className="text-xs"
                  style={{ color: 'rgb(var(--destructive))' }}
                >
                  {t('disconnectLedger')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectLedger}
                  disabled={isLedgerConnecting}
                  className="text-sm"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  {isLedgerConnecting ? t('ledgerConnecting') : t('connectLedger')}
                </button>
              )}
            </div>
            <p className="text-xs mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('ledgerDesc')}
            </p>

            {ledgerError && (
              <p className="text-xs mb-2" style={{ color: 'rgb(var(--destructive))' }}>
                {ledgerError}
              </p>
            )}

            {isDiscoveringAccounts && (
              <p
                className="text-xs text-center py-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {t('ledgerDiscoverAccounts')}
              </p>
            )}

            {ledgerDiscoveredAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                  {t('ledgerSelectAccounts')}
                </p>
                {ledgerDiscoveredAccounts.map((account) => (
                  <label
                    key={account.index}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer"
                    style={{ backgroundColor: 'rgb(var(--secondary))' }}
                  >
                    <input
                      type="checkbox"
                      checked={account.selected}
                      onChange={() => handleToggleLedgerAccount(account.index)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-mono truncate"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {account.address}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {account.path}
                      </p>
                    </div>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={handleAddLedgerAccounts}
                  disabled={
                    isAddingLedgerAccounts || !ledgerDiscoveredAccounts.some((a) => a.selected)
                  }
                  className="btn-primary w-full py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {isAddingLedgerAccounts ? t('ledgerAddingAccounts') : t('ledgerAddAccounts')}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Security Settings */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('security')}
          </h3>
          <div className="space-y-3">
            {/* Auto-Lock Setting */}
            <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {t('autoLock')}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('autoLockDesc')}
              </p>
              {!isLoadingSettings && (
                <select
                  value={autoLockMinutes}
                  onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                  className="input-base w-full p-2 rounded-lg text-sm"
                >
                  {autoLockOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Export Private Key */}
            <button
              type="button"
              onClick={() => setShowExportKey(true)}
              className="w-full p-3 rounded-lg flex items-center justify-between transition-colors"
              style={{ border: '1px solid rgb(var(--border))' }}
            >
              <span style={{ color: 'rgb(var(--foreground))' }}>{t('exportPrivateKey')}</span>
              <svg
                className="w-5 h-5"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Export Private Key Modal */}
            {showExportKey && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm"
                style={{ backgroundColor: 'rgb(var(--overlay) / 0.6)' }}
              >
                <div
                  className="rounded-lg p-4 w-80 max-h-[90vh] overflow-y-auto"
                  style={{
                    backgroundColor: 'rgb(var(--card-hover))',
                    border: '1px solid rgb(var(--border))',
                  }}
                >
                  <h3
                    className="text-lg font-bold mb-4"
                    style={{ color: 'rgb(var(--foreground))' }}
                  >
                    {t('exportPrivateKey')}
                  </h3>

                  {!exportedKey ? (
                    <>
                      <p
                        className="text-sm mb-4"
                        style={{ color: 'rgb(var(--foreground-secondary))' }}
                      >
                        {t('exportKeyWarning')}
                      </p>
                      {exportError && (
                        <p className="text-sm mb-3" style={{ color: 'rgb(var(--destructive))' }}>
                          {exportError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCloseExportKey}
                          className="btn-secondary flex-1 py-2 rounded-lg text-sm"
                        >
                          {tc('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportPrivateKey}
                          disabled={isExporting}
                          className="btn-danger flex-1 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          {isExporting ? t('exporting') : t('showKey')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label
                          htmlFor="exported-private-key"
                          className="text-xs block mb-1"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          {t('privateKey')}
                        </label>
                        <div className="relative">
                          <input
                            id="exported-private-key"
                            type={showKey ? 'text' : 'password'}
                            readOnly
                            value={exportedKey}
                            className="input-base w-full p-2 rounded-lg text-xs font-mono pr-16"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                            style={{ color: 'rgb(var(--primary))' }}
                          >
                            {showKey ? tc('hide') : tc('show')}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(exportedKey)
                          alert(tc('copiedToClipboard'))
                        }}
                        className="btn-outline w-full py-2 mb-2 rounded-lg text-sm"
                      >
                        {t('copyToClipboard')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseExportKey}
                        className="btn-secondary w-full py-2 rounded-lg text-sm"
                      >
                        {tc('done')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Connected Sites */}
            <button
              type="button"
              onClick={handleOpenConnectedSites}
              className="w-full p-3 rounded-lg flex items-center justify-between transition-colors"
              style={{ border: '1px solid rgb(var(--border))' }}
            >
              <span style={{ color: 'rgb(var(--foreground))' }}>{t('connectedSites')}</span>
              <svg
                className="w-5 h-5"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Connected Sites Modal */}
            {showConnectedSites && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm"
                style={{ backgroundColor: 'rgb(var(--overlay) / 0.6)' }}
              >
                <div
                  className="rounded-lg p-4 w-80 max-h-[90vh] overflow-y-auto"
                  style={{
                    backgroundColor: 'rgb(var(--card-hover))',
                    border: '1px solid rgb(var(--border))',
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                      {t('connectedSites')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowConnectedSites(false)}
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        role="img"
                      >
                        <title>{tc('close')}</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {isLoadingSites ? (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {tc('loading')}
                    </p>
                  ) : connectedSites.length === 0 ? (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {t('noConnectedSites')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {connectedSites.map((site) => (
                        <div
                          key={site.origin}
                          className="p-3 rounded-lg flex items-center justify-between"
                          style={{ border: '1px solid rgb(var(--border))' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'rgb(var(--foreground))' }}
                            >
                              {site.origin}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: 'rgb(var(--muted-foreground))' }}
                            >
                              {t('accountCount_other', { count: site.accounts.length })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisconnectSite(site.origin)}
                            className="ml-2 text-xs"
                            style={{ color: 'rgb(var(--destructive))' }}
                          >
                            {tc('disconnect')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowConnectedSites(false)}
                    className="btn-secondary w-full mt-4 py-2 rounded-lg text-sm"
                  >
                    {tc('close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Smart Account Settings */}
        {isSmartAccount && (
          <section>
            <h3
              className="text-sm font-medium mb-3"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('smartAccount')}
            </h3>
            <div className="space-y-3">
              {/* SA Info Button */}
              <button
                type="button"
                onClick={handleOpenSmartAccount}
                className="w-full p-3 rounded-lg flex items-center justify-between transition-colors"
                style={{ border: '1px solid rgb(var(--border))' }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: 'rgb(var(--foreground))' }}>
                    {t('accountInfoValidator')}
                  </span>
                </div>
                <svg
                  className="w-5 h-5"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Smart Account Modal */}
              {showSmartAccount && (
                <div
                  className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm"
                  style={{ backgroundColor: 'rgb(var(--overlay) / 0.6)' }}
                >
                  <div
                    className="rounded-lg p-4 w-80 max-h-[90vh] overflow-y-auto"
                    style={{
                      backgroundColor: 'rgb(var(--card-hover))',
                      border: '1px solid rgb(var(--border))',
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                        {t('smartAccount')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmartAccount(false)
                          setValidatorError(null)
                          setValidatorSuccess(null)
                          setNewValidator('')
                        }}
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          role="img"
                        >
                          <title>{tc('close')}</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {isLoadingSaInfo ? (
                      <p
                        className="text-sm text-center py-4"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {tc('loading')}
                      </p>
                    ) : saInfo ? (
                      <div className="space-y-4">
                        {/* Account Type */}
                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: 'rgb(var(--secondary))' }}
                        >
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                                {t('type')}
                              </span>
                              <span
                                className="font-medium"
                                style={{ color: 'rgb(var(--foreground))' }}
                              >
                                {saInfo.accountType === 'delegated'
                                  ? t('eip7702Delegated')
                                  : saInfo.accountType === 'smart'
                                    ? tc('smartAccount')
                                    : tc('eoa')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                                {t('deployed')}
                              </span>
                              <span
                                style={{
                                  color: saInfo.isDeployed
                                    ? 'rgb(var(--success))'
                                    : 'rgb(var(--muted-foreground))',
                                }}
                              >
                                {saInfo.isDeployed ? tc('yes') : tc('no')}
                              </span>
                            </div>
                            {saInfo.accountId && (
                              <div className="flex justify-between">
                                <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                                  {t('accountId')}
                                </span>
                                <span
                                  className="font-mono text-xs truncate max-w-[150px]"
                                  style={{ color: 'rgb(var(--foreground))' }}
                                >
                                  {saInfo.accountId}
                                </span>
                              </div>
                            )}
                            {saInfo.isDelegated && saInfo.delegationTarget && (
                              <div className="flex justify-between">
                                <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                                  {t('delegation')}
                                </span>
                                <span
                                  className="font-mono text-xs"
                                  style={{ color: 'rgb(var(--foreground))' }}
                                >
                                  {saInfo.delegationTarget.slice(0, 8)}...
                                  {saInfo.delegationTarget.slice(-6)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Root Validator */}
                        <div
                          className="p-3 rounded-lg"
                          style={{ border: '1px solid rgb(var(--border))' }}
                        >
                          <h4
                            className="text-sm font-medium mb-2"
                            style={{ color: 'rgb(var(--foreground))' }}
                          >
                            {t('rootValidator')}
                          </h4>
                          {saInfo.rootValidator ? (
                            <p
                              className="text-xs font-mono break-all mb-3"
                              style={{ color: 'rgb(var(--muted-foreground))' }}
                            >
                              {saInfo.rootValidator}
                            </p>
                          ) : (
                            <p
                              className="text-xs mb-3"
                              style={{ color: 'rgb(var(--muted-foreground))' }}
                            >
                              {t('notSet')}
                            </p>
                          )}

                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder={t('newValidatorPlaceholder')}
                              value={newValidator}
                              onChange={(e) => setNewValidator(e.target.value)}
                              className="input-base w-full p-2 rounded-lg text-xs font-mono"
                            />
                            {validatorError && (
                              <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                                {validatorError}
                              </p>
                            )}
                            {validatorSuccess && (
                              <p className="text-xs" style={{ color: 'rgb(var(--success))' }}>
                                {validatorSuccess}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={handleSetRootValidator}
                              disabled={isSettingValidator}
                              className="btn-primary w-full py-2 rounded-lg text-sm disabled:opacity-50"
                            >
                              {isSettingValidator ? t('updating') : t('changeRootValidator')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-sm text-center py-4"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {t('unableToLoadInfo')}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowSmartAccount(false)
                        setValidatorError(null)
                        setValidatorSuccess(null)
                        setNewValidator('')
                      }}
                      className="btn-secondary w-full mt-4 py-2 rounded-lg text-sm"
                    >
                      {tc('close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Advanced Settings */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('advanced')}
          </h3>
          <div className="space-y-3">
            {/* MetaMask Compatibility Mode */}
            <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                    {t('metaMaskMode')}
                  </span>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {t('metaMaskModeDesc')}
                  </p>
                </div>
                {!isLoadingSettings && (
                  <button
                    type="button"
                    onClick={handleMetaMaskModeChange}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
                    style={{
                      backgroundColor: metaMaskMode ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    }}
                    role="switch"
                    aria-checked={metaMaskMode}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        metaMaskMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Language Selector */}
            <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {t('language')}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('languageDesc')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor:
                      i18n.language === 'en' ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                    color: i18n.language === 'en' ? 'white' : 'rgb(var(--foreground))',
                    border: `1px solid ${i18n.language === 'en' ? 'rgb(var(--primary))' : 'rgb(var(--border))'}`,
                  }}
                >
                  {t('english')}
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('ko')}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor:
                      i18n.language === 'ko' ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                    color: i18n.language === 'ko' ? 'white' : 'rgb(var(--foreground))',
                    border: `1px solid ${i18n.language === 'ko' ? 'rgb(var(--primary))' : 'rgb(var(--border))'}`,
                  }}
                >
                  {t('korean')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('about')}
          </h3>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(var(--surface))' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
              {t('stableNetWallet')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {tc('version', { version: '0.1.0' })}
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('aboutDesc')}
            </p>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgb(var(--border))' }}>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('featuresTitle')}
              </p>
              <ul
                className="text-xs mt-1 list-disc list-inside"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                <li>{t('featureEip6963')}</li>
                <li>{t('featureMetaMask')}</li>
                <li>{t('featureAutoLock')}</li>
                <li>{t('featureTabSubscription')}</li>
                <li>{t('featureCustomNetwork')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Lock Wallet */}
        <button
          type="button"
          onClick={handleLockWallet}
          className="btn-danger w-full py-3 rounded-lg"
        >
          {t('lockWallet')}
        </button>
      </div>
    </div>
  )
}
