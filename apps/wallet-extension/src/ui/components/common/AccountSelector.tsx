import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import type { Account } from '../../../types'

interface AccountSelectorProps {
  accounts: Account[]
  selectedAccount: Address | null
  onSelect: (address: Address) => void
  onAddAccount: () => void
}

export function AccountSelector({
  accounts,
  selectedAccount,
  onSelect,
  onAddAccount,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentAccount = accounts.find((a) => a.address === selectedAccount)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (address: Address) => {
    onSelect(address)
    setIsOpen(false)
  }

  const handleAddAccount = () => {
    onAddAccount()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Account Display (Clickable) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left rounded-lg p-2 -m-2 transition-colors"
        style={{ backgroundColor: isOpen ? 'rgb(var(--primary) / 0.1)' : 'transparent' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
          style={{ backgroundColor: 'rgb(var(--primary))' }}
        >
          {getAccountInitial(currentAccount)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: 'rgb(var(--foreground))' }}>
            {currentAccount?.name ?? 'Account'}
          </p>
          <p className="text-xs truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {currentAccount ? formatAddress(currentAccount.address) : ''}
          </p>
        </div>
        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'rgb(var(--muted-foreground))' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
        >
          <title>Toggle dropdown</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-lg shadow-lg py-1 z-50 max-h-64 overflow-y-auto"
          style={{
            backgroundColor: 'rgb(var(--card))',
            border: '1px solid rgb(var(--border))',
          }}
        >
          {/* Account List */}
          {accounts.map((account) => {
            const isSelected = account.address === selectedAccount
            return (
              <button
                type="button"
                key={account.address}
                onClick={() => handleSelect(account.address)}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
                style={{
                  backgroundColor: isSelected ? 'rgb(var(--primary) / 0.1)' : 'transparent',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{
                    backgroundColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                    color: isSelected ? 'white' : 'rgb(var(--foreground-secondary))',
                  }}
                >
                  {getAccountInitial(account)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className="font-medium truncate"
                    style={{ color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--foreground))' }}
                  >
                    {account.name ?? 'Account'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {formatAddress(account.address)}
                  </p>
                </div>
                {/* Checkmark for selected */}
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

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgb(var(--border))', margin: '4px 0' }} />

          {/* Add Account Button */}
          <button
            type="button"
            onClick={handleAddAccount}
            className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
            style={{ color: 'rgb(var(--primary))' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
              >
                <title>Add account</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <span className="font-medium">Add Account</span>
          </button>
        </div>
      )}
    </div>
  )
}

function getAccountInitial(account: Account | undefined): string {
  if (!account) return 'A'
  if (account.name) return account.name[0]?.toUpperCase() ?? 'A'
  return account.address.slice(2, 4).toUpperCase()
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
