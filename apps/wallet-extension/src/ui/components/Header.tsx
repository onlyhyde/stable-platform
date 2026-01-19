
import { useWalletStore } from '../hooks/useWalletStore'

export function Header() {
  const { selectedAccount, accounts, networks, selectedChainId, selectNetwork } =
    useWalletStore()

  const currentAccount = accounts.find((a) => a.address === selectedAccount)

  return (
    <header className="bg-indigo-600 text-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">StableNet</h1>

        <div className="flex items-center gap-2">
          {/* Network Selector */}
          <select
            className="bg-indigo-700 text-white text-sm rounded px-2 py-1 border border-indigo-500"
            value={selectedChainId}
            onChange={(e) => selectNetwork(Number(e.target.value))}
          >
            {networks.map((network) => (
              <option key={network.chainId} value={network.chainId}>
                {network.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Account Display */}
      {currentAccount && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              {currentAccount.name[0]}
            </div>
            <div>
              <p className="font-medium">{currentAccount.name}</p>
              <p className="text-xs text-indigo-200">
                {formatAddress(currentAccount.address)}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
