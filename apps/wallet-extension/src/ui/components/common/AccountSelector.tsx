import { useState, useRef, useEffect } from 'react'
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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left hover:bg-indigo-500/30 rounded-lg p-2 -m-2 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
          {getAccountInitial(currentAccount)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">
            {currentAccount?.name ?? 'Account'}
          </p>
          <p className="text-xs text-indigo-200 truncate">
            {currentAccount ? formatAddress(currentAccount.address) : ''}
          </p>
        </div>
        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-indigo-200 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-64 overflow-y-auto">
          {/* Account List */}
          {accounts.map((account) => (
            <button
              key={account.address}
              onClick={() => handleSelect(account.address)}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${
                account.address === selectedAccount ? 'bg-indigo-50' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  account.address === selectedAccount
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {getAccountInitial(account)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p
                  className={`font-medium truncate ${
                    account.address === selectedAccount ? 'text-indigo-600' : 'text-gray-900'
                  }`}
                >
                  {account.name ?? 'Account'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {formatAddress(account.address)}
                </p>
              </div>
              {/* Checkmark for selected */}
              {account.address === selectedAccount && (
                <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="border-t border-gray-200 my-1" />

          {/* Add Account Button */}
          <button
            onClick={handleAddAccount}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-indigo-600"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
  if (account.name) return account.name[0].toUpperCase()
  return account.address.slice(2, 4).toUpperCase()
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
