import { useWalletStore } from '../hooks/useWalletStore'
import { AccountSelector } from './common/AccountSelector'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('Header')

export function Header() {
  const {
    selectedAccount,
    accounts,
    networks,
    selectedChainId,
    selectNetwork,
    selectAccount,
    addAccount,
    isLoading,
  } = useWalletStore()

  const handleAddAccount = async () => {
    try {
      await addAccount()
    } catch (error) {
      logger.error('Failed to add account', error)
    }
  }

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

      {/* Account Selector */}
      {accounts.length > 0 && (
        <div className="mt-3">
          <AccountSelector
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelect={selectAccount}
            onAddAccount={handleAddAccount}
          />
          {isLoading && (
            <div className="mt-2 text-xs text-indigo-200">Loading...</div>
          )}
        </div>
      )}
    </header>
  )
}
