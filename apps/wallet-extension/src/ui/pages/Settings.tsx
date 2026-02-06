import { useCallback, useEffect, useState } from 'react'
import type { ConnectedSite, Network } from '../../types'
import { useWalletStore } from '../hooks/useWalletStore'

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Never' },
]

export function Settings() {
  const {
    networks,
    selectedChainId,
    selectNetwork,
    lockWallet,
    importPrivateKey,
    addNetwork,
    removeNetwork,
    syncWithBackground,
  } = useWalletStore()

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
    currencySymbol: 'ETH',
    explorerUrl: '',
    indexerUrl: '',
  })
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [networkSuccess, setNetworkSuccess] = useState<string | null>(null)

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

      // Also update localStorage for the inpage script
      // This requires page reload to take effect
      localStorage.setItem('__stablenetAppearAsMM__', JSON.stringify(newValue))
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

  // Import Private Key handlers
  const handleImportPrivateKey = useCallback(async () => {
    if (!privateKeyInput.trim()) {
      setImportError('Please enter a private key')
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
      setImportSuccess(`Account imported: ${address.slice(0, 10)}...${address.slice(-8)}`)
      setPrivateKeyInput('')
      setShowImportKey(false)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import account')
    } finally {
      setIsImporting(false)
    }
  }, [privateKeyInput, importPrivateKey])

  // Add Network handlers
  const handleAddNetwork = useCallback(async () => {
    // Validate form
    if (!networkForm.name.trim()) {
      setNetworkError('Network name is required')
      return
    }
    if (!networkForm.chainId.trim() || isNaN(Number(networkForm.chainId))) {
      setNetworkError('Valid Chain ID is required')
      return
    }
    if (!networkForm.rpcUrl.trim()) {
      setNetworkError('RPC URL is required')
      return
    }

    // Check for duplicate chain ID
    const chainId = Number(networkForm.chainId)
    if (networks.some((n) => n.chainId === chainId)) {
      setNetworkError('A network with this Chain ID already exists')
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
          name: networkForm.currencySymbol.trim() || 'ETH',
          symbol: networkForm.currencySymbol.trim() || 'ETH',
          decimals: 18,
        },
        isCustom: true,
      }

      await addNetwork(network)
      setNetworkSuccess(`Network "${network.name}" added successfully`)
      setNetworkForm({
        name: '',
        chainId: '',
        rpcUrl: '',
        bundlerUrl: '',
        currencySymbol: 'ETH',
        explorerUrl: '',
        indexerUrl: '',
      })
      setShowAddNetwork(false)
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Failed to add network')
    } finally {
      setIsAddingNetwork(false)
    }
  }, [networkForm, networks, addNetwork])

  const handleRemoveNetwork = useCallback(
    async (chainId: number) => {
      if (!confirm('Are you sure you want to remove this network?')) {
        return
      }

      try {
        await removeNetwork(chainId)
        await syncWithBackground()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to remove network')
      }
    },
    [removeNetwork, syncWithBackground]
  )

  // Export Private Key handler
  const handleExportPrivateKey = useCallback(async () => {
    const { selectedAccount } = useWalletStore.getState()
    if (!selectedAccount) {
      setExportError('No account selected')
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
        setExportError(response?.payload?.error ?? 'Failed to export private key')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export private key')
    } finally {
      setIsExporting(false)
    }
  }, [])

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

  return (
    <div
      className="p-4 overflow-y-auto max-h-[500px]"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      <h2 className="text-xl font-bold mb-6" style={{ color: 'rgb(var(--foreground))' }}>
        Settings
      </h2>

      <div className="space-y-6">
        {/* Network Settings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-sm font-medium"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              Network
            </h3>
            <button
              type="button"
              onClick={() => setShowAddNetwork(!showAddNetwork)}
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
            >
              {showAddNetwork ? 'Cancel' : '+ Add Network'}
            </button>
          </div>

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
                Add Custom Network
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Network Name"
                  value={networkForm.name}
                  onChange={(e) => setNetworkForm({ ...networkForm, name: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Chain ID (e.g., 1, 137, 42161)"
                  value={networkForm.chainId}
                  onChange={(e) => setNetworkForm({ ...networkForm, chainId: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="RPC URL"
                  value={networkForm.rpcUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, rpcUrl: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Bundler URL (optional, defaults to RPC URL)"
                  value={networkForm.bundlerUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, bundlerUrl: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Currency Symbol (e.g., ETH, MATIC)"
                  value={networkForm.currencySymbol}
                  onChange={(e) =>
                    setNetworkForm({ ...networkForm, currencySymbol: e.target.value })
                  }
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Block Explorer URL (optional)"
                  value={networkForm.explorerUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, explorerUrl: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Indexer URL (optional, for token balances)"
                  value={networkForm.indexerUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, indexerUrl: e.target.value })}
                  className="input-base w-full p-2 rounded-lg text-sm"
                />
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
                  {isAddingNetwork ? 'Adding...' : 'Add Network'}
                </button>
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
                        (Custom)
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Chain {network.chainId}
                  </span>
                  {network.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNetwork(network.chainId)}
                      className="p-1"
                      style={{ color: 'rgb(var(--destructive))' }}
                      title="Remove network"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
              Accounts
            </h3>
            <button
              type="button"
              onClick={() => setShowImportKey(!showImportKey)}
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
            >
              {showImportKey ? 'Cancel' : '+ Import Account'}
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
                Import Private Key
              </h4>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter private key (with or without 0x prefix)"
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
                  Warning: Never share your private key with anyone. StableNet will never ask for
                  your private key.
                </p>
                <button
                  type="button"
                  onClick={handleImportPrivateKey}
                  disabled={isImporting}
                  className="btn-primary w-full py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : 'Import Account'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Security Settings */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Security
          </h3>
          <div className="space-y-3">
            {/* Auto-Lock Setting */}
            <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  Auto-Lock
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Automatically lock wallet after being idle
              </p>
              {!isLoadingSettings && (
                <select
                  value={autoLockMinutes}
                  onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                  className="input-base w-full p-2 rounded-lg text-sm"
                >
                  {AUTO_LOCK_OPTIONS.map((option) => (
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
              <span style={{ color: 'rgb(var(--foreground))' }}>Export Private Key</span>
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
                    Export Private Key
                  </h3>

                  {!exportedKey ? (
                    <>
                      <p
                        className="text-sm mb-4"
                        style={{ color: 'rgb(var(--foreground-secondary))' }}
                      >
                        Warning: Never share your private key. Anyone with your private key can
                        steal your funds.
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
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleExportPrivateKey}
                          disabled={isExporting}
                          className="btn-danger flex-1 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          {isExporting ? 'Exporting...' : 'Show Key'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label
                          className="text-xs block mb-1"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          Private Key
                        </label>
                        <div className="relative">
                          <input
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
                            {showKey ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(exportedKey)
                          alert('Copied to clipboard')
                        }}
                        className="btn-outline w-full py-2 mb-2 rounded-lg text-sm"
                      >
                        Copy to Clipboard
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseExportKey}
                        className="btn-secondary w-full py-2 rounded-lg text-sm"
                      >
                        Done
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
              <span style={{ color: 'rgb(var(--foreground))' }}>Connected Sites</span>
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
                      Connected Sites
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
                      >
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
                      Loading...
                    </p>
                  ) : connectedSites.length === 0 ? (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      No connected sites
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
                              {site.accounts.length} account{site.accounts.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisconnectSite(site.origin)}
                            className="ml-2 text-xs"
                            style={{ color: 'rgb(var(--destructive))' }}
                          >
                            Disconnect
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
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Advanced Settings */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Advanced
          </h3>
          <div className="space-y-3">
            {/* MetaMask Compatibility Mode */}
            <div className="p-3 rounded-lg" style={{ border: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                    MetaMask Mode
                  </span>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Appear as MetaMask for legacy dApp compatibility
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
          </div>
        </section>

        {/* About */}
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            About
          </h3>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(var(--surface))' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
              StableNet Wallet
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Version 0.1.0
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              ERC-4337 Smart Account Wallet with stealth address support.
            </p>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgb(var(--border))' }}>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Features:
              </p>
              <ul
                className="text-xs mt-1 list-disc list-inside"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                <li>EIP-6963 Multi-Wallet Discovery</li>
                <li>MetaMask Compatibility Mode</li>
                <li>Auto-Lock Protection</li>
                <li>Tab Subscription Management</li>
                <li>Custom Network Support</li>
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
          Lock Wallet
        </button>
      </div>
    </div>
  )
}
