'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { useWallet } from '@/hooks'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import type { BankAccountType, LinkedBankAccount } from '@/types/bank'
import { formatRelativeTime } from '@/lib/utils'

type Tab = 'accounts' | 'transfer'

export default function BankPage() {
  const { isConnected } = useWallet()
  const { addToast } = useToast()
  const {
    accounts,
    isLoading,
    isTransferring,
    error,
    linkAccount,
    unlinkAccount,
    syncAccount,
    transfer,
    refresh,
  } = useBankAccounts()

  const [activeTab, setActiveTab] = useState<Tab>('accounts')

  // Link form state
  const [linkAccountNo, setLinkAccountNo] = useState('')
  const [linkAccountType, setLinkAccountType] = useState<BankAccountType>('checking')
  const [linkOwnerName, setLinkOwnerName] = useState('')

  // Transfer form state
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')

  const handleLinkAccount = async () => {
    if (!linkAccountNo || !linkOwnerName) return
    const result = await linkAccount(linkAccountNo, linkAccountType, linkOwnerName)
    if (result) {
      addToast({
        type: 'success',
        title: 'Account Linked',
        message: `${linkAccountType} ****${linkAccountNo.slice(-4)} linked successfully`,
      })
      setLinkAccountNo('')
      setLinkOwnerName('')
    }
  }

  const handleUnlink = async (accountNo: string) => {
    await unlinkAccount(accountNo)
    addToast({ type: 'info', title: 'Account Unlinked', message: 'Bank account removed' })
  }

  const handleSync = async (accountNo: string) => {
    const result = await syncAccount(accountNo)
    if (result) {
      addToast({ type: 'success', title: 'Synced', message: 'Balance updated' })
    }
  }

  const handleTransfer = async () => {
    const amount = Number(transferAmount)
    if (!fromAccount || !toAccount || !amount || amount <= 0) return
    const result = await transfer(fromAccount, toAccount, amount, transferDesc || undefined)
    if (result) {
      addToast({
        type: 'success',
        title: 'Transfer Submitted',
        message: `${amount.toLocaleString()} KRW transfer initiated`,
      })
      setTransferAmount('')
      setTransferDesc('')
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to manage bank accounts
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Bank Accounts
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Link and manage your bank accounts
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex rounded-lg p-1" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'accounts' ? 'rgb(var(--background))' : 'transparent',
            color:
              activeTab === 'accounts'
                ? 'rgb(var(--foreground))'
                : 'rgb(var(--muted-foreground))',
            boxShadow: activeTab === 'accounts' ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Accounts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transfer')}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'transfer' ? 'rgb(var(--background))' : 'transparent',
            color:
              activeTab === 'transfer'
                ? 'rgb(var(--foreground))'
                : 'rgb(var(--muted-foreground))',
            boxShadow: activeTab === 'transfer' ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Transfer
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {error}
          </p>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <>
          {/* Link Account Form */}
          <Card>
            <CardHeader>
              <CardTitle>Link Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                label="Account Number"
                placeholder="Enter account number"
                value={linkAccountNo}
                onChange={(e) => setLinkAccountNo(e.target.value)}
              />
              <div>
                <span
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Account Type
                </span>
                <select
                  value={linkAccountType}
                  onChange={(e) => setLinkAccountType(e.target.value as BankAccountType)}
                  className="w-full p-2.5 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    borderColor: 'rgb(var(--border))',
                    color: 'rgb(var(--foreground))',
                  }}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
              <Input
                label="Account Owner Name"
                placeholder="Full name"
                value={linkOwnerName}
                onChange={(e) => setLinkOwnerName(e.target.value)}
              />
              <Button
                onClick={handleLinkAccount}
                isLoading={isLoading}
                disabled={!linkAccountNo || !linkOwnerName}
                className="w-full"
              >
                Link Account
              </Button>
            </CardContent>
          </Card>

          {/* Linked Accounts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Linked Accounts</CardTitle>
                <button
                  type="button"
                  onClick={refresh}
                  className="text-xs transition-colors"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  Refresh All
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p
                  className="text-center py-8 text-sm"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  No linked accounts. Link a bank account to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <AccountCard
                      key={account.accountNo}
                      account={account}
                      onSync={() => handleSync(account.accountNo)}
                      onUnlink={() => handleUnlink(account.accountNo)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Transfer Tab */}
      {activeTab === 'transfer' && (
        <Card>
          <CardHeader>
            <CardTitle>Bank Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts.length < 1 ? (
              <p
                className="text-center py-8 text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Link at least one bank account to make transfers.
              </p>
            ) : (
              <>
                <div>
                  <span
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'rgb(var(--foreground))' }}
                  >
                    From Account
                  </span>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full p-2.5 rounded-lg border text-sm"
                    style={{
                      backgroundColor: 'rgb(var(--secondary))',
                      borderColor: 'rgb(var(--border))',
                      color: 'rgb(var(--foreground))',
                    }}
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.accountNo} value={a.accountNo}>
                        {a.accountType} ****{a.accountNo.slice(-4)}
                        {a.balance != null ? ` (${a.balance.toLocaleString()} KRW)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="To Account Number"
                  placeholder="Destination account number"
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                />

                <Input
                  label="Amount (KRW)"
                  type="number"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />

                <Input
                  label="Description (optional)"
                  placeholder="Transfer memo"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                />

                <Button
                  onClick={handleTransfer}
                  isLoading={isTransferring}
                  disabled={
                    !fromAccount || !toAccount || !transferAmount || Number(transferAmount) <= 0
                  }
                  className="w-full"
                >
                  Transfer
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function AccountCard({
  account,
  onSync,
  onUnlink,
}: {
  account: LinkedBankAccount
  onSync: () => void
  onUnlink: () => void
}) {
  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium capitalize" style={{ color: 'rgb(var(--foreground))' }}>
            {account.accountType} ****{account.accountNo.slice(-4)}
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {account.ownerName}
          </p>
        </div>
        {account.balance != null && (
          <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {account.balance.toLocaleString()} KRW
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {account.lastSynced
            ? `Synced ${formatRelativeTime(account.lastSynced)}`
            : 'Never synced'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSync}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: 'rgb(var(--primary))' }}
          >
            Sync
          </button>
          <button
            type="button"
            onClick={onUnlink}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: 'rgb(var(--destructive))' }}
          >
            Unlink
          </button>
        </div>
      </div>
    </div>
  )
}
