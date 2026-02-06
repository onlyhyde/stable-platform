import type { BankAccount, LinkedBankAccount } from '../../../types'
import { Badge, Card } from '../common'

interface BankAccountCardProps {
  account: LinkedBankAccount | BankAccount
  onSelect?: () => void
  onSync?: () => void
  onUnlink?: () => void
  isSelected?: boolean
  showActions?: boolean
}

export function BankAccountCard({
  account,
  onSelect,
  onSync,
  onUnlink,
  isSelected = false,
  showActions = true,
}: BankAccountCardProps) {
  const isLinkedAccount = 'linkedAt' in account
  const balance = isLinkedAccount
    ? (account as LinkedBankAccount).balance
    : (account as BankAccount).balance
  const status = isLinkedAccount ? 'active' : (account as BankAccount).status

  const getStatusVariant = (s: string) => {
    switch (s) {
      case 'active':
        return 'success'
      case 'frozen':
        return 'warning'
      case 'closed':
        return 'error'
      default:
        return 'default'
    }
  }

  const formatAccountNo = (no: string) => {
    return `****${no.slice(-4)}`
  }

  const formatBalance = (b?: number) => {
    if (b === undefined) return '--'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(b)
  }

  return (
    <Card
      variant={isSelected ? 'gradient' : 'outline'}
      padding="md"
      className={`${onSelect ? 'cursor-pointer hover:border-indigo-300' : ''} ${
        isSelected ? 'ring-2 ring-indigo-500' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
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
          <div>
            <p className="text-sm font-medium text-gray-900">
              {account.accountType === 'checking' ? 'Checking' : 'Savings'} Account
            </p>
            <p className="text-xs text-gray-500">{formatAccountNo(account.accountNo)}</p>
          </div>
        </div>
        <Badge variant={getStatusVariant(status)} size="sm">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>

      <div className="mt-3">
        <p className="text-xs text-gray-500">Balance</p>
        <p className="text-lg font-semibold text-gray-900">{formatBalance(balance)}</p>
      </div>

      {showActions && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
          {onSync && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSync()
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Sync
            </button>
          )}
          {onUnlink && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onUnlink()
              }}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Unlink
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
