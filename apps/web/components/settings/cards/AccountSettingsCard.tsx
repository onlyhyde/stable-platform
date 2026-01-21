'use client'

import { useState } from 'react'
import { Card, CardContent, CardTitle, CardDescription, Button, Input } from '@/components/common'

interface AccountSettingsCardProps {
  isConnected: boolean
  address?: string
  onDisconnect: () => void
}

export function AccountSettingsCard({ isConnected, address, onDisconnect }: AccountSettingsCardProps) {
  const [accountName, setAccountName] = useState('My Account')

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Connected Account</CardTitle>

          {isConnected && address ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{accountName}</p>
                  <p className="text-sm text-gray-500 font-mono">{formatAddress(address)}</p>
                </div>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy address"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>

              <div>
                <Input
                  label="Account Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  hint="A friendly name for this account"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <Button variant="secondary" onClick={onDisconnect} className="text-red-600 hover:text-red-700">
                  Disconnect Wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">No wallet connected</p>
              <p className="text-sm text-gray-400">
                Connect a wallet to manage your account settings
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Smart Account</CardTitle>
          <CardDescription className="mb-6">
            Your smart account provides enhanced features like gas sponsorship and batch transactions.
          </CardDescription>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Account Type</span>
              <span className="text-sm font-medium text-gray-900">Kernel v3 (ERC-4337)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Deployment Status</span>
              <span className="text-sm font-medium text-green-600">Deployed</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Modules</span>
              <span className="text-sm font-medium text-gray-900">ECDSA Validator</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
