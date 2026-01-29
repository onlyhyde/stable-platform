import { useEffect, useState } from 'react'
import { useWalletStore } from '../hooks/useWalletStore'
import { formatEther } from 'viem'

export function Home() {
  const { selectedAccount, accounts, balances, updateBalance, setPage } = useWalletStore()
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

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

  if (!currentAccount) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>No account found</p>
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
            `${Number(formatEther(balance)).toFixed(4)} ETH`
          ) : (
            '-- ETH'
          )}
        </h2>
        <p className="text-sm opacity-80 mt-2">
          {currentAccount.type === 'smart' ? 'Smart Account' : 'EOA'}
          {currentAccount.isDeployed === false && ' (Not Deployed)'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
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
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>Send</span>
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
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>Receive</span>
        </button>
      </div>

      {/* Account Address */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Account Address</p>
        <div className="flex items-center gap-2">
          <code
            className="text-sm break-all"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {currentAccount.address}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(currentAccount.address)}
            style={{ color: 'rgb(var(--primary))' }}
            title="Copy address"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
    </div>
  )
}
