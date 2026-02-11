'use client'

import type { Address, Hex } from 'viem'
import { Button, Card, CardContent } from '@/components/common'
import { formatAddress } from '@/lib/utils'

interface PrivateKeyCardProps {
  /** Whether a private key has been entered (actual key is stored in ref for security) */
  hasPrivateKey: boolean
  onPrivateKeyChange: (key: Hex | '') => void
  /** Clear the private key */
  onClear?: () => void
  matchingAnvilAccount: { address: Address; privateKey: Hex } | null | undefined
  onAutoFill: () => void
  anvilAccounts: readonly { address: Address; privateKey: Hex }[]
}

export function PrivateKeyCard({
  hasPrivateKey,
  onPrivateKeyChange,
  onClear,
  matchingAnvilAccount,
  onAutoFill,
  anvilAccounts,
}: PrivateKeyCardProps) {
  return (
    <Card className="bg-yellow-50 border-yellow-200">
      <CardContent className="py-4">
        <div className="flex gap-3">
          <svg
            className="w-6 h-6 text-yellow-600 flex-shrink-0"
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
          <div className="flex-1">
            <p className="font-medium text-yellow-900">Development Mode - Private Key Required</p>
            <p className="text-sm text-yellow-700 mt-1 mb-3">
              EIP-7702 authorization signing requires direct private key access. Wallets like
              MetaMask don&apos;t support the wallet_signAuthorization RPC method yet. For testing,
              use one of the known Anvil test account private keys.
            </p>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="privateKey"
                  className="block text-sm font-medium text-yellow-800 mb-1"
                >
                  Private Key {hasPrivateKey && <span className="text-green-600">(entered)</span>}
                </label>
                <div className="flex gap-2">
                  {/* SECURITY: Input is write-only, value not displayed to prevent DevTools exposure */}
                  <input
                    id="privateKey"
                    type="password"
                    placeholder={hasPrivateKey ? '••••••••••••••••' : '0x...'}
                    onChange={(e) => onPrivateKeyChange(e.target.value as Hex | '')}
                    className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  {hasPrivateKey && onClear && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onClear}
                      className="whitespace-nowrap text-red-600 hover:text-red-700"
                    >
                      Clear
                    </Button>
                  )}
                  {matchingAnvilAccount && !hasPrivateKey && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onAutoFill}
                      className="whitespace-nowrap"
                    >
                      Auto-fill Anvil Key
                    </Button>
                  )}
                </div>
              </div>

              {!matchingAnvilAccount && (
                <div className="text-xs text-yellow-700">
                  <p className="font-medium mb-1">Known Anvil Test Accounts:</p>
                  <div className="space-y-1 font-mono">
                    {anvilAccounts.map((acc, i) => (
                      <div key={acc.address} className="flex items-center gap-2">
                        <span className="text-yellow-600">#{i}:</span>
                        <span className="truncate">{formatAddress(acc.address, 8)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-yellow-600">
                    Connect with one of these accounts in MetaMask, or manually enter your private
                    key.
                  </p>
                </div>
              )}

              {matchingAnvilAccount && (
                <p className="text-xs text-green-700">
                  Connected account matches Anvil test account #
                  {anvilAccounts.findIndex(
                    (a) => a.address.toLowerCase() === matchingAnvilAccount.address.toLowerCase()
                  )}
                  . Click &quot;Auto-fill Anvil Key&quot; to use the known private key.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
