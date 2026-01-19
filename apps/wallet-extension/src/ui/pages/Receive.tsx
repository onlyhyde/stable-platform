import { useState } from 'react'
import { useWalletStore } from '../hooks/useWalletStore'

export function Receive() {
  const { selectedAccount, accounts } = useWalletStore()
  const [copied, setCopied] = useState(false)

  const currentAccount = accounts.find((a) => a.address === selectedAccount)

  async function copyAddress() {
    if (!selectedAccount) return

    await navigator.clipboard.writeText(selectedAccount)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!currentAccount) {
    return (
      <div className="p-4 text-center text-gray-500">
        No account selected
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6 text-center">Receive</h2>

      {/* QR Code Placeholder */}
      <div className="flex justify-center mb-6">
        <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center">
          <div className="text-center p-4">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 11V3h8v8H3zm2-6v4h4V5H5zM3 21v-8h8v8H3zm2-6v4h4v-4H5zm8-10h8v8h-8V3zm2 6h4V5h-4v4zm-2 10h2v-2h-2v2zm0-4h2v-2h-2v2zm2 4h2v-2h-2v2zm2-4h2v-2h-2v2zm2 4h2v-2h-2v2zm-2-8h2v-2h-2v2zm2 0h2v-2h-2v2z" />
            </svg>
            <p className="text-xs text-gray-400 mt-2">QR Code</p>
          </div>
        </div>
      </div>

      {/* Address Display */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 mb-2">Your Address</p>
        <code className="text-sm text-gray-700 break-all block">
          {currentAccount.address}
        </code>
      </div>

      {/* Copy Button */}
      <button
        type="button"
        onClick={copyAddress}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
          copied
            ? 'bg-green-100 text-green-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {copied ? (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy Address
          </>
        )}
      </button>

      {/* Info */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Only send assets on the same network. Sending to a different network may result in loss of
        funds.
      </p>
    </div>
  )
}
