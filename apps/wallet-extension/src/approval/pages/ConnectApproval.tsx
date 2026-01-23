import { useState, useEffect } from 'react'
import type { Address } from 'viem'
import type { ConnectApprovalRequest } from '../../types'
import { Button, Card, Spinner } from '../../ui/components/common'

interface WalletAccount {
  address: Address
  name: string
}

interface ConnectApprovalProps {
  approval: ConnectApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function ConnectApproval({
  approval,
  onApprove,
  onReject,
}: ConnectApprovalProps) {
  const [accounts, setAccounts] = useState<WalletAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<Address>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAccounts()
  }, [])

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
      console.error('Failed to load accounts:', err)
    } finally {
      setLoading(false)
    }
  }

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          {approval.favicon ? (
            <img
              src={approval.favicon}
              alt=""
              className="w-10 h-10 rounded-lg"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 break-all">
              {new URL(approval.origin).hostname}
            </p>
            <p className="text-sm text-gray-500">wants to connect</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* Permissions */}
        <Card padding="md">
          <p className="text-sm font-medium text-gray-700 mb-3">
            This site will be able to:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              View your wallet address
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Request transaction approval
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Request message signatures
            </li>
          </ul>
        </Card>

        {/* Accounts to connect */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              Select accounts to connect
            </p>
            {accounts.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Select all
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
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="text-xs font-bold">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p
                        className={`text-sm font-medium ${
                          isSelected ? 'text-indigo-700' : 'text-gray-900'
                        }`}
                      >
                        {account.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatAddress(account.address)}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
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
          <p className="mt-2 text-xs text-gray-500">
            {selectedAccounts.size} of {accounts.length} account{accounts.length > 1 ? 's' : ''} selected
          </p>
        </Card>

        {/* Warning */}
        <Card variant="filled" padding="sm" className="bg-amber-50 border-amber-100">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-700">
              Only connect to sites you trust. Malicious sites can phish your
              assets by requesting misleading signatures.
            </p>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="p-6 bg-white border-t border-gray-200 space-y-3">
        <Button
          onClick={handleApprove}
          fullWidth
          disabled={selectedAccounts.size === 0}
        >
          Connect ({selectedAccounts.size} account{selectedAccounts.size !== 1 ? 's' : ''})
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          Cancel
        </Button>
      </div>
    </div>
  )
}
