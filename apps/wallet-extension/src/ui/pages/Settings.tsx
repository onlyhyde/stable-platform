import { useState, useEffect, useCallback } from 'react'
import { useWalletStore } from '../hooks/useWalletStore'
import type { Network } from '../../types'

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
  })
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [networkSuccess, setNetworkSuccess] = useState<string | null>(null)

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

  return (
    <div className="p-4 overflow-y-auto max-h-[500px]">
      <h2 className="text-xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Network Settings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Network</h3>
            <button
              type="button"
              onClick={() => setShowAddNetwork(!showAddNetwork)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              {showAddNetwork ? 'Cancel' : '+ Add Network'}
            </button>
          </div>

          {/* Add Network Form */}
          {showAddNetwork && (
            <div className="mb-4 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
              <h4 className="text-sm font-medium mb-3">Add Custom Network</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Network Name"
                  value={networkForm.name}
                  onChange={(e) => setNetworkForm({ ...networkForm, name: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Chain ID (e.g., 1, 137, 42161)"
                  value={networkForm.chainId}
                  onChange={(e) => setNetworkForm({ ...networkForm, chainId: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="RPC URL"
                  value={networkForm.rpcUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, rpcUrl: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Bundler URL (optional, defaults to RPC URL)"
                  value={networkForm.bundlerUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, bundlerUrl: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Currency Symbol (e.g., ETH, MATIC)"
                  value={networkForm.currencySymbol}
                  onChange={(e) =>
                    setNetworkForm({ ...networkForm, currencySymbol: e.target.value })
                  }
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Block Explorer URL (optional)"
                  value={networkForm.explorerUrl}
                  onChange={(e) => setNetworkForm({ ...networkForm, explorerUrl: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
                {networkError && <p className="text-xs text-red-600">{networkError}</p>}
                {networkSuccess && <p className="text-xs text-green-600">{networkSuccess}</p>}
                <button
                  type="button"
                  onClick={handleAddNetwork}
                  disabled={isAddingNetwork}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
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
                className={`w-full p-3 rounded-lg border flex items-center justify-between ${
                  network.chainId === selectedChainId
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectNetwork(network.chainId)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      network.chainId === selectedChainId ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  />
                  <div>
                    <span className="font-medium">{network.name}</span>
                    {network.isCustom && (
                      <span className="ml-2 text-xs text-gray-400">(Custom)</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Chain {network.chainId}</span>
                  {network.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNetwork(network.chainId)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove network"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <h3 className="text-sm font-medium text-gray-700">Accounts</h3>
            <button
              type="button"
              onClick={() => setShowImportKey(!showImportKey)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              {showImportKey ? 'Cancel' : '+ Import Account'}
            </button>
          </div>

          {/* Import Private Key Form */}
          {showImportKey && (
            <div className="mb-4 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
              <h4 className="text-sm font-medium mb-3">Import Private Key</h4>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter private key (with or without 0x prefix)"
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono"
                />
                {importError && <p className="text-xs text-red-600">{importError}</p>}
                {importSuccess && <p className="text-xs text-green-600">{importSuccess}</p>}
                <p className="text-xs text-gray-500">
                  Warning: Never share your private key with anyone. StableNet will never ask for
                  your private key.
                </p>
                <button
                  type="button"
                  onClick={handleImportPrivateKey}
                  disabled={isImporting}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : 'Import Account'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Security Settings */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Security</h3>
          <div className="space-y-3">
            {/* Auto-Lock Setting */}
            <div className="p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Auto-Lock</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Automatically lock wallet after being idle
              </p>
              {!isLoadingSettings && (
                <select
                  value={autoLockMinutes}
                  onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
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
              className="w-full p-3 rounded-lg border border-gray-200 flex items-center justify-between hover:bg-gray-50"
            >
              <span>Export Private Key</span>
              <svg
                className="w-5 h-5 text-gray-400"
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

            {/* Connected Sites */}
            <button
              type="button"
              className="w-full p-3 rounded-lg border border-gray-200 flex items-center justify-between hover:bg-gray-50"
            >
              <span>Connected Sites</span>
              <svg
                className="w-5 h-5 text-gray-400"
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
          </div>
        </section>

        {/* Advanced Settings */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Advanced</h3>
          <div className="space-y-3">
            {/* MetaMask Compatibility Mode */}
            <div className="p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-medium">MetaMask Mode</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Appear as MetaMask for legacy dApp compatibility
                  </p>
                </div>
                {!isLoadingSettings && (
                  <button
                    type="button"
                    onClick={handleMetaMaskModeChange}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                      metaMaskMode ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
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
              {metaMaskMode && (
                <p className="text-xs text-amber-600 mt-2">Requires page reload to take effect</p>
              )}
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">About</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">StableNet Wallet</p>
            <p className="text-xs text-gray-400 mt-1">Version 0.1.0</p>
            <p className="text-xs text-gray-400 mt-2">
              ERC-4337 Smart Account Wallet with stealth address support.
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-400">Features:</p>
              <ul className="text-xs text-gray-400 mt-1 list-disc list-inside">
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
          className="w-full py-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          Lock Wallet
        </button>
      </div>
    </div>
  )
}
