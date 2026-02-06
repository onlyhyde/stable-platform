import { createLogger } from '../../shared/utils/logger'
import { useWalletStore } from '../hooks/useWalletStore'
import { AccountSelector } from './common/AccountSelector'

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
    <header
      className="p-4 header-gradient-bar"
      style={{
        backgroundColor: 'rgb(var(--background-raised))',
        color: 'rgb(var(--foreground))',
        borderBottom: '1px solid rgb(var(--border))',
      }}
    >
      <div className="flex items-center justify-between">
        <h1
          className="text-lg font-bold"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--primary-hover)))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          StableNet
        </h1>

        <div className="flex items-center gap-2">
          {/* Network Selector */}
          <select
            className="text-sm rounded px-2 py-1"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              color: 'rgb(var(--foreground))',
              border: '1px solid rgb(var(--border))',
            }}
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
            <div className="mt-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Loading...
            </div>
          )}
        </div>
      )}
    </header>
  )
}
