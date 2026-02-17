import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import type { WalletConnectSessionApprovalRequest } from '../../types'
import { Button, Card, Spinner } from '../../ui/components/common'

const logger = createLogger('WalletConnectSessionApproval')

interface WalletAccount {
  address: Address
  name: string
}

interface WalletConnectSessionApprovalProps {
  approval: WalletConnectSessionApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function WalletConnectSessionApproval({
  approval,
  onApprove,
  onReject,
}: WalletConnectSessionApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const [accounts, setAccounts] = useState<WalletAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<Address>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_APPROVAL',
          id: `get-accounts-${Date.now()}`,
          payload: { approvalId: approval.id },
        })

        if (response?.payload?.accounts) {
          const walletAccounts = response.payload.accounts as WalletAccount[]
          setAccounts(walletAccounts)

          const selectedAccount = response.payload.selectedAccount as Address | null
          if (selectedAccount) {
            setSelectedAccounts(new Set([selectedAccount]))
          } else if (walletAccounts.length > 0 && walletAccounts[0]) {
            setSelectedAccounts(new Set([walletAccounts[0].address]))
          }
        }
      } catch (err) {
        logger.error('Failed to load accounts', err)
      } finally {
        setLoading(false)
      }
    }

    loadAccounts()
  }, [approval.id])

  const toggleAccount = (address: Address) => {
    setSelectedAccounts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(address)) {
        if (newSet.size > 1) {
          newSet.delete(address)
        }
      } else {
        newSet.add(address)
      }
      return newSet
    })
  }

  const handleApprove = () => {
    onApprove({
      accounts: Array.from(selectedAccounts),
      approved: true,
    })
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--background))' }}
      >
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        <div className="flex items-center gap-3">
          {approval.data.proposerIcon ? (
            <img src={approval.data.proposerIcon} alt="" className="w-10 h-10 rounded-lg" />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
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
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium break-all" style={{ color: 'rgb(var(--foreground))' }}>
              {approval.data.proposerName}
            </p>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('wcSessionRequest')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* WalletConnect Badge */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.1)',
            border: '1px solid rgb(var(--primary) / 0.2)',
          }}
        >
          <svg
            className="w-4 h-4"
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
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span className="text-xs font-medium" style={{ color: 'rgb(var(--primary))' }}>
            WalletConnect
          </span>
        </div>

        {/* dApp info */}
        <Card padding="md">
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('wcDappInfo')}
          </p>
          <div className="space-y-1">
            <p className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              {approval.data.proposerName}
            </p>
            <p className="text-xs break-all" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {approval.data.proposerUrl}
            </p>
            {approval.data.proposerDescription && (
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {approval.data.proposerDescription}
              </p>
            )}
          </div>
        </Card>

        {/* Requested permissions */}
        <Card padding="md">
          <p
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('wcRequestedPermissions')}
          </p>
          <ul className="space-y-2">
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              <svg
                className="w-4 h-4"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('viewAddress')}
            </li>
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              <svg
                className="w-4 h-4"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('requestTxApproval')}
            </li>
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              <svg
                className="w-4 h-4"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('requestSignatures')}
            </li>
          </ul>

          {/* Chains */}
          {approval.data.requiredChains.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgb(var(--border))' }}>
              <p
                className="text-xs font-medium mb-1"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {t('wcRequestedChains')}
              </p>
              <div className="flex flex-wrap gap-1">
                {approval.data.requiredChains.map((chain) => (
                  <span
                    key={chain}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgb(var(--surface))',
                      color: 'rgb(var(--foreground-secondary))',
                    }}
                  >
                    {chain}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Account selection */}
        <Card padding="md">
          <p
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('selectAccounts')}
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {accounts.map((account) => {
              const isSelected = selectedAccounts.has(account.address)
              return (
                <button
                  key={account.address}
                  type="button"
                  onClick={() => toggleAccount(account.address)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors"
                  style={{
                    borderColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    backgroundColor: isSelected
                      ? 'rgb(var(--primary) / 0.1)'
                      : 'rgb(var(--surface))',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                        color: isSelected ? 'white' : 'rgb(var(--foreground-secondary))',
                      }}
                    >
                      <span className="text-xs font-bold">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
                        }}
                      >
                        {account.name}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {formatAddress(account.address)}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-5 h-5"
                      style={{ color: 'rgb(var(--primary))' }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      role="img"
                    >
                      <title>Selected</title>
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('accountsSelected', { selected: selectedAccounts.size, total: accounts.length })}
          </p>
        </Card>

        {/* Warning */}
        <Card
          variant="filled"
          padding="sm"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            border: '1px solid rgb(var(--warning) / 0.2)',
          }}
        >
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs" style={{ color: 'rgb(234 179 8)' }}>
              {t('wcConnectionWarning')}
            </p>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div
        className="p-6 space-y-3"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderTop: '1px solid rgb(var(--border))',
        }}
      >
        <Button onClick={handleApprove} fullWidth disabled={selectedAccounts.size === 0}>
          {t('wcApproveSession')}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('cancel')}
        </Button>
      </div>
    </div>
  )
}
