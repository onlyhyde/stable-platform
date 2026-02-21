import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { createLogger } from '../../shared/utils/logger'
import { useWalletStore } from '../hooks/useWalletStore'
import { AccountSelector } from './common/AccountSelector'

const logger = createLogger('Header')

export function Header() {
  const { t } = useTranslation('common')
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

  const currentAccount = useMemo(
    () => accounts.find((a) => a.address === selectedAccount),
    [accounts, selectedAccount]
  )

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
          {t('stableNet')}
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
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AccountSelector
                accounts={accounts}
                selectedAccount={selectedAccount}
                onSelect={selectAccount}
                onAddAccount={handleAddAccount}
              />
            </div>
            {currentAccount && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor:
                    currentAccount.type === 'eoa'
                      ? 'rgb(var(--muted-foreground) / 0.1)'
                      : 'rgb(var(--primary) / 0.1)',
                  color:
                    currentAccount.type === 'eoa'
                      ? 'rgb(var(--muted-foreground))'
                      : 'rgb(var(--primary))',
                }}
              >
                {currentAccount.type === 'eoa' ? 'EOA' : 'CA'}
              </span>
            )}
          </div>
          {isLoading && (
            <div className="mt-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('loading')}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
