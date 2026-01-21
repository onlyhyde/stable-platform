import { useState } from 'react'
import type { ConnectApprovalRequest } from '../../types'
import { Button, Card, Toggle } from '../../ui/components/common'

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
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(true)

  // In a real implementation, we'd get accounts from the keyring
  const accounts = [
    { address: '0x1234...5678', name: 'Account 1' },
  ]

  const handleApprove = () => {
    const accountsToConnect = allSelected
      ? accounts.map((a) => a.address)
      : selectedAccounts

    onApprove({
      accounts: accountsToConnect,
      permissions: approval.data.requestedPermissions,
    })
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
      <div className="flex-1 p-6 space-y-4">
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
              Connect accounts
            </p>
            <Toggle
              enabled={allSelected}
              onChange={setAllSelected}
              label="All"
              size="sm"
            />
          </div>
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.address}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-600">
                      {account.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {account.name}
                    </p>
                    <p className="text-xs text-gray-500">{account.address}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        <Button onClick={handleApprove} fullWidth>
          Connect
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          Cancel
        </Button>
      </div>
    </div>
  )
}
