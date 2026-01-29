import { useState, useEffect } from 'react'
import type { LinkedBankAccount, BankAccount } from '../../types'
import { Button, Card, Modal, Input, Select, Spinner } from '../components/common'
import { BankAccountCard, TransferForm } from '../components/bank'

type TabType = 'accounts' | 'transfer' | 'link'

interface BankPageProps {
  onBack?: () => void
}

export function Bank({ onBack }: BankPageProps) {
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

  useEffect(() => {
    loadLinkedAccounts()
  }, [])

  async function loadLinkedAccounts() {
    setIsLoading(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINKED_BANK_ACCOUNTS',
      })
      if (response?.accounts) {
        setLinkedAccounts(response.accounts)
      }
    } catch (err) {
      setError('Failed to load bank accounts')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLinkAccount() {
    if (!linkForm.accountNo || !linkForm.ownerName) {
      setError('Please fill in all required fields')
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
    } catch (err) {
      setError('Failed to link bank account')
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
      setError('Failed to unlink account')
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
      setError('Failed to sync account')
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
    { id: 'accounts', label: 'Accounts' },
    { id: 'transfer', label: 'Transfer' },
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Bank Accounts</h1>
          </div>
          <Button size="sm" onClick={() => setShowLinkModal(true)}>
            Link Account
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
                <p className="text-sm text-gray-500 mb-3">No linked bank accounts</p>
                <Button size="sm" onClick={() => setShowLinkModal(true)}>
                  Link Your First Account
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
              <p className="text-sm text-gray-500">
                You need at least 2 linked accounts to make a transfer.
              </p>
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
        title="Link Bank Account"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Account Number"
            value={linkForm.accountNo}
            onChange={(e) => setLinkForm((prev) => ({ ...prev, accountNo: e.target.value }))}
            placeholder="Enter account number"
          />
          <Select
            label="Account Type"
            value={linkForm.accountType}
            onChange={(e) =>
              setLinkForm((prev) => ({
                ...prev,
                accountType: e.target.value as 'checking' | 'savings',
              }))
            }
            options={[
              { value: 'checking', label: 'Checking' },
              { value: 'savings', label: 'Savings' },
            ]}
          />
          <Input
            label="Owner Name"
            value={linkForm.ownerName}
            onChange={(e) => setLinkForm((prev) => ({ ...prev, ownerName: e.target.value }))}
            placeholder="Enter account owner name"
          />
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowLinkModal(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkAccount}
              isLoading={isLinking}
              fullWidth
              disabled={!linkForm.accountNo || !linkForm.ownerName}
            >
              Link Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
