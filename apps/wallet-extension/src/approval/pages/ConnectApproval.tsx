import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import type { ConnectApprovalRequest } from '../../types'
import { Button, Card, Spinner } from '../../ui/components/common'
import { ApprovalWarnings } from '../components/ApprovalWarnings'

const logger = createLogger('ConnectApproval')

interface WalletAccount {
  address: Address
  name: string
}

interface ConnectApprovalProps {
  approval: ConnectApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function ConnectApproval({ approval, onApprove, onReject }: ConnectApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const [accounts, setAccounts] = useState<WalletAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<Address>>(new Set())
  const [loading, setLoading] = useState(true)

  const getOriginDisplay = (origin: string) => {
    try {
      return new URL(origin).hostname
    } catch {
      return origin === 'extension' ? 'StableNet Wallet' : origin
    }
  }

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

          // Pre-select the currently selected account
          const selectedAccount = response.payload.selectedAccount as Address | null
          if (selectedAccount) {
            setSelectedAccounts(new Set([selectedAccount]))
          } else if (walletAccounts.length > 0 && walletAccounts[0]) {
            // Default to first account if no selection
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
        // Don't allow deselecting if it's the only selected account
        if (newSet.size > 1) {
          newSet.delete(address)
        }
      } else {
        newSet.add(address)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedAccounts(new Set(accounts.map((a) => a.address)))
  }

  const handleApprove = () => {
    const accountsToConnect = Array.from(selectedAccounts)

    onApprove({
      accounts: accountsToConnect,
      permissions: approval.data.requestedPermissions,
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
          {approval.favicon ? (
            <img src={approval.favicon} alt="" className="w-10 h-10 rounded-lg" />
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
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium break-all" style={{ color: 'rgb(var(--foreground))' }}>
              {getOriginDisplay(approval.origin)}
            </p>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('connectTitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* Permissions */}
        <Card padding="md">
          <p
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('connectPermissions')}
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
        </Card>

        {/* Accounts to connect */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-sm font-medium"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('selectAccounts')}
            </p>
            {accounts.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium"
                style={{ color: 'rgb(var(--primary))' }}
              >
                {t('selectAll')}
              </button>
            )}
          </div>
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

        {/* Phishing / Risk Warnings */}
        {approval.data.warnings && approval.data.warnings.length > 0 ? (
          <ApprovalWarnings warnings={approval.data.warnings} riskLevel={approval.data.riskLevel} />
        ) : (
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
                {t('connectWarning')}
              </p>
            </div>
          </Card>
        )}
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
          {t('connectBtn', { count: selectedAccounts.size })}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('cancel')}
        </Button>
      </div>
    </div>
  )
}
