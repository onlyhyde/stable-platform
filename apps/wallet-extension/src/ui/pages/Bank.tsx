import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LinkedBankAccount } from '../../types'
import { BankAccountCard, TransferForm } from '../components/bank'
import { Button, Card, Input, Modal, Select, Spinner } from '../components/common'

type TabType = 'accounts' | 'transfer' | 'link'

interface BankPageProps {
  onBack?: () => void
}

export function Bank({ onBack }: BankPageProps) {
  const { t } = useTranslation('buy')
  const { t: tc } = useTranslation('common')
  const [activeTab, setActiveTab] = useState<TabType>('accounts')
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedBankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Link account modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState({
    accountNo: '',
    accountType: 'checking' as 'checking' | 'savings',
    ownerName: '',
  })
  const [isLinking, setIsLinking] = useState(false)

  // Transfer state
  const [isTransferring, setIsTransferring] = useState(false)

  const loadLinkedAccounts = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINKED_BANK_ACCOUNTS',
      })
      if (response?.accounts) {
        setLinkedAccounts(response.accounts)
      }
    } catch (_err) {
      setError(t('failedToLoadBankAccounts'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadLinkedAccounts()
  }, [loadLinkedAccounts])

  async function handleLinkAccount() {
    if (!linkForm.accountNo || !linkForm.ownerName) {
      setError(t('fillAllRequiredFields'))
      return
    }

    setIsLinking(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LINK_BANK_ACCOUNT',
        payload: {
          accountNo: linkForm.accountNo,
          accountType: linkForm.accountType,
          ownerName: linkForm.ownerName,
        },
      })

      if (response?.account) {
        setLinkedAccounts((prev) => [...prev, response.account])
        setShowLinkModal(false)
        setLinkForm({ accountNo: '', accountType: 'checking', ownerName: '' })
      } else if (response?.error) {
        setError(response.error)
      }
    } catch (_err) {
      setError(t('failedToLinkAccount'))
    } finally {
      setIsLinking(false)
    }
  }

  async function handleUnlinkAccount(accountNo: string) {
    try {
      await chrome.runtime.sendMessage({
        type: 'UNLINK_BANK_ACCOUNT',
        payload: { accountNo },
      })
      setLinkedAccounts((prev) => prev.filter((a) => a.accountNo !== accountNo))
    } catch {
      setError(t('failedToUnlinkAccount'))
    }
  }

  async function handleSyncAccount(accountNo: string) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_BANK_ACCOUNT',
        payload: { accountNo },
      })

      if (response?.account) {
        setLinkedAccounts((prev) =>
          prev.map((a) => (a.accountNo === accountNo ? response.account : a))
        )
      }
    } catch {
      setError(t('failedToSyncAccount'))
    }
  }

  async function handleTransfer(from: string, to: string, amount: number, description?: string) {
    setIsTransferring(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BANK_TRANSFER',
        payload: { fromAccount: from, toAccount: to, amount, description },
      })

      if (response?.error) {
        throw new Error(response.error)
      }

      // Refresh accounts after transfer
      await loadLinkedAccounts()
      setActiveTab('accounts')
    } finally {
      setIsTransferring(false)
    }
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'accounts', label: t('accountsTab') },
    { id: 'transfer', label: t('transferTab') },
  ]

  return (
    <div className="min-h-full" style={{ backgroundColor: 'rgb(var(--background))' }}>
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              {t('bankAccounts')}
            </h1>
          </div>
          <Button size="sm" onClick={() => setShowLinkModal(true)}>
            {t('linkAccount')}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="pb-2 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderColor: isActive ? 'rgb(var(--primary))' : 'transparent',
                  color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div
            className="mb-4 p-3 text-sm rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : activeTab === 'accounts' ? (
          <div className="space-y-3">
            {linkedAccounts.length === 0 ? (
              <Card padding="lg" className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-3">{t('noLinkedAccounts')}</p>
                <Button size="sm" onClick={() => setShowLinkModal(true)}>
                  {t('linkFirstAccount')}
                </Button>
              </Card>
            ) : (
              linkedAccounts.map((account) => (
                <BankAccountCard
                  key={account.accountNo}
                  account={account}
                  onSync={() => handleSyncAccount(account.accountNo)}
                  onUnlink={() => handleUnlinkAccount(account.accountNo)}
                />
              ))
            )}
          </div>
        ) : activeTab === 'transfer' ? (
          linkedAccounts.length < 2 ? (
            <Card padding="lg" className="text-center">
              <p className="text-sm text-gray-500">{t('needTwoAccounts')}</p>
            </Card>
          ) : (
            <TransferForm
              accounts={linkedAccounts}
              onTransfer={handleTransfer}
              isLoading={isTransferring}
            />
          )
        ) : null}
      </div>

      {/* Link Account Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title={t('linkBankAccount')}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label={t('accountNumber')}
            value={linkForm.accountNo}
            onChange={(e) => setLinkForm((prev) => ({ ...prev, accountNo: e.target.value }))}
            placeholder={t('enterAccountNumber')}
          />
          <Select
            label={t('accountType')}
            value={linkForm.accountType}
            onChange={(e) =>
              setLinkForm((prev) => ({
                ...prev,
                accountType: e.target.value as 'checking' | 'savings',
              }))
            }
            options={[
              { value: 'checking', label: t('checking') },
              { value: 'savings', label: t('savings') },
            ]}
          />
          <Input
            label={t('ownerName')}
            value={linkForm.ownerName}
            onChange={(e) => setLinkForm((prev) => ({ ...prev, ownerName: e.target.value }))}
            placeholder={t('enterOwnerName')}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowLinkModal(false)} fullWidth>
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleLinkAccount}
              isLoading={isLinking}
              fullWidth
              disabled={!linkForm.accountNo || !linkForm.ownerName}
            >
              {t('linkAccount')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
