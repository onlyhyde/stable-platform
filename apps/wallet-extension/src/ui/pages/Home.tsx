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
          <p className="text-gray-500 mb-4">No account found</p>
          <button
            type="button"
            onClick={() => setPage('settings')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
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
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6">
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
          className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center hover:bg-gray-50"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
            <svg
              className="w-5 h-5 text-indigo-600"
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
          <span className="text-sm font-medium">Send</span>
        </button>

        <button
          type="button"
          onClick={() => setPage('receive')}
          className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center hover:bg-gray-50"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <svg
              className="w-5 h-5 text-green-600"
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
          <span className="text-sm font-medium">Receive</span>
        </button>
      </div>

      {/* Account Address */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-1">Account Address</p>
        <div className="flex items-center gap-2">
          <code className="text-sm text-gray-700 break-all">{currentAccount.address}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(currentAccount.address)}
            className="text-indigo-600 hover:text-indigo-700"
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
