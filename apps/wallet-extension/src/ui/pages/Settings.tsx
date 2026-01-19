
import { useWalletStore } from '../hooks/useWalletStore'

export function Settings() {
  const { networks, selectedChainId, selectNetwork } = useWalletStore()

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Network Settings */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Network</h3>
          <div className="space-y-2">
            {networks.map((network) => (
              <button
                key={network.chainId}
                type="button"
                onClick={() => selectNetwork(network.chainId)}
                className={`w-full p-3 rounded-lg border flex items-center justify-between ${
                  network.chainId === selectedChainId
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      network.chainId === selectedChainId ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  />
                  <span className="font-medium">{network.name}</span>
                </div>
                <span className="text-sm text-gray-500">Chain {network.chainId}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Security */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Security</h3>
          <div className="space-y-2">
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

        {/* About */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-3">About</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">StableNet Wallet</p>
            <p className="text-xs text-gray-400 mt-1">Version 0.1.0</p>
            <p className="text-xs text-gray-400 mt-2">
              ERC-4337 Smart Account Wallet with stealth address support.
            </p>
          </div>
        </section>

        {/* Lock Wallet */}
        <button
          type="button"
          className="w-full py-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          Lock Wallet
        </button>
      </div>
    </div>
  )
}
