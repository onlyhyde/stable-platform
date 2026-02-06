import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { AddTokenModal } from '../components/AddTokenModal'
import { TokenList } from '../components/TokenList'
import { useAssets, useIndexerData, useNetworkCurrency, useWalletStore } from '../hooks'
import type { AssetToken } from '../hooks/useAssets'
import type { TokenBalance } from '../hooks/useIndexerData'

export function Home() {
  const { selectedAccount, accounts, balances, updateBalance, setPage } = useWalletStore()
  const { symbol: currencySymbol } = useNetworkCurrency()
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isAddTokenModalOpen, setIsAddTokenModalOpen] = useState(false)

  // Token balances from indexer
  const { tokenBalances, isLoadingTokens, refreshTokenBalances, isIndexerAvailable } =
    useIndexerData()

  // Asset management (custom tokens, visibility)
  const {
    tokens: assetTokens,
    isLoading: isLoadingAssets,
    refresh: refreshAssets,
    toggleTokenVisibility,
  } = useAssets()

  const currentAccount = accounts.find((a) => a.address === selectedAccount)
  const balance = selectedAccount ? balances[selectedAccount] : undefined

  useEffect(() => {
    if (selectedAccount && balance === undefined) {
      loadBalance()
    }
  }, [selectedAccount, balance])

  async function loadBalance() {
    if (!selectedAccount) return

    setIsLoadingBalance(true)
    try {
      // Request balance from background
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `balance-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [selectedAccount, 'latest'],
        },
      })

      if (response?.payload?.result) {
        const balanceBigInt = BigInt(response.payload.result)
        updateBalance(selectedAccount, balanceBigInt)
      }
    } catch {
      // Balance fetch failed
    } finally {
      setIsLoadingBalance(false)
    }
  }

  function handleRefreshAll() {
    loadBalance()
    refreshTokenBalances()
    refreshAssets()
  }

  function handleTokenClick(token: TokenBalance | AssetToken | 'native') {
    if (token === 'native') {
      // Navigate to send page for native token
      setPage('send')
    } else {
      // Navigate to send page with selected token
      // Store selected token in session storage for Send page to pick up
      sessionStorage.setItem('selectedToken', JSON.stringify(token))
      setPage('send')
    }
  }

  function handleAddToken() {
    setIsAddTokenModalOpen(true)
  }

  function handleToggleVisibility(address: string) {
    toggleTokenVisibility(address as `0x${string}`)
  }

  if (!currentAccount) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            No account found
          </p>
          <button
            type="button"
            onClick={() => setPage('settings')}
            className="btn-primary px-4 py-2 rounded-lg"
          >
            Create Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Balance Card */}
      <div
        className="rounded-2xl p-6 text-white mb-6"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
        }}
      >
        <p className="text-sm opacity-80">Total Balance</p>
        <h2 className="text-3xl font-bold mt-1">
          {isLoadingBalance ? (
            <span className="animate-pulse">Loading...</span>
          ) : balance !== undefined ? (
            `${Number(formatEther(balance)).toFixed(4)} ${currencySymbol}`
          ) : (
            `-- ${currencySymbol}`
          )}
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
            }}
          >
            {currentAccount.type === 'smart' ? 'Smart Account' : 'EOA'}
          </span>
          {currentAccount.isDeployed === false && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              Not Deployed
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPage('send')}
          className="card rounded-xl p-4 flex flex-col items-center transition-colors"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
            style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: 'rgb(var(--primary))' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Send
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPage('receive')}
          className="card rounded-xl p-4 flex flex-col items-center transition-colors"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
            style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: 'rgb(var(--success))' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Receive
          </span>
        </button>

        {currentAccount.type === 'smart' ? (
          <button
            type="button"
            onClick={() => setPage('modules')}
            className="card rounded-xl p-4 flex flex-col items-center transition-colors"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: 'rgb(var(--accent) / 0.1)' }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: 'rgb(var(--accent))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Modules
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPage('modules')}
            className="card rounded-xl p-4 flex flex-col items-center transition-colors"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: 'rgb(var(--warning) / 0.1)' }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: 'rgb(var(--warning))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Upgrade
            </span>
            <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              EIP-7702
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setPage('activity')}
          className="card rounded-xl p-4 flex flex-col items-center transition-colors"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
            style={{ backgroundColor: 'rgb(var(--muted-foreground) / 0.1)' }}
          >
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Activity
          </span>
        </button>
      </div>

      {/* Token List */}
      <TokenList
        nativeBalance={balance}
        tokenBalances={tokenBalances}
        assetTokens={assetTokens}
        isLoading={isLoadingTokens || isLoadingBalance || isLoadingAssets}
        onRefresh={handleRefreshAll}
        onTokenClick={handleTokenClick}
        onAddToken={handleAddToken}
        onToggleVisibility={handleToggleVisibility}
      />

      {/* Indexer Status */}
      {!isIndexerAvailable && !isLoadingTokens && (
        <p className="text-xs text-center mt-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Token discovery unavailable. Configure indexer URL in settings.
        </p>
      )}

      {/* Account Address */}
      <div className="rounded-xl p-4 mt-6" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Account Address
        </p>
        <div className="flex items-center gap-2">
          <code className="text-sm break-all" style={{ color: 'rgb(var(--foreground-secondary))' }}>
            {currentAccount.address}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(currentAccount.address)}
            style={{ color: 'rgb(var(--primary))' }}
            title="Copy address"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Add Token Modal */}
      <AddTokenModal isOpen={isAddTokenModalOpen} onClose={() => setIsAddTokenModalOpen(false)} />
    </div>
  )
}
