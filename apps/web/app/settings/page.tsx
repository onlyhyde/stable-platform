'use client'

import { useState } from 'react'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardTitle, CardDescription, Button, Input } from '@/components/common'
import { supportedChains, defaultChain } from '@/lib/chains'

type SettingsTab = 'network' | 'account' | 'security'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('network')
  const { isConnected, address } = useWallet()
  const { chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'network',
      label: 'Network',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your network, account, and security preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'network' && (
          <NetworkSettings
            currentChainId={chain?.id ?? defaultChain.id}
            onSwitchChain={(chainId) => switchChain?.({ chainId })}
          />
        )}

        {activeTab === 'account' && (
          <AccountSettings
            isConnected={isConnected}
            address={address}
            onDisconnect={() => disconnect()}
          />
        )}

        {activeTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  )
}

function NetworkSettings({
  currentChainId,
  onSwitchChain,
}: {
  currentChainId: number
  onSwitchChain: (chainId: number) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Network Selection</CardTitle>
          <CardDescription className="mb-6">
            Choose which network to connect to. Different networks may have different features and token availability.
          </CardDescription>

          <div className="space-y-3">
            {supportedChains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                onClick={() => onSwitchChain(chain.id)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                  currentChainId === chain.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentChainId === chain.id ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${currentChainId === chain.id ? 'text-white' : 'text-gray-500'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{chain.name}</p>
                    <p className="text-sm text-gray-500">Chain ID: {chain.id}</p>
                  </div>
                </div>
                {currentChainId === chain.id && (
                  <span className="text-sm font-medium text-primary-600">Connected</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">RPC Configuration</CardTitle>
          <CardDescription className="mb-6">
            Configure custom RPC endpoints for advanced users.
          </CardDescription>

          <div className="space-y-4">
            <Input
              label="RPC URL"
              placeholder="https://rpc.example.com"
              hint="Leave empty to use default RPC endpoint"
            />
            <Input
              label="Bundler URL"
              placeholder="https://bundler.example.com"
              hint="ERC-4337 bundler endpoint for UserOperations"
            />
            <Input
              label="Paymaster URL"
              placeholder="https://paymaster.example.com"
              hint="Paymaster endpoint for gas sponsorship"
            />
            <Button variant="secondary">Save RPC Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AccountSettings({
  isConnected,
  address,
  onDisconnect,
}: {
  isConnected: boolean
  address?: string
  onDisconnect: () => void
}) {
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

function SecuritySettings() {
  const [sessionKeyEnabled, setSessionKeyEnabled] = useState(false)
  const [txConfirmation, setTxConfirmation] = useState(true)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Transaction Settings</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Confirmation</p>
                <p className="text-sm text-gray-500">
                  Always confirm transactions before signing
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTxConfirmation(!txConfirmation)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  txConfirmation ? 'bg-primary-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={txConfirmation}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    txConfirmation ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Session Keys</p>
                <p className="text-sm text-gray-500">
                  Allow temporary keys for seamless transactions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSessionKeyEnabled(!sessionKeyEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  sessionKeyEnabled ? 'bg-primary-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={sessionKeyEnabled}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    sessionKeyEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Spending Limits</CardTitle>
          <CardDescription className="mb-6">
            Set daily spending limits to protect your account from unauthorized transactions.
          </CardDescription>

          <div className="space-y-4">
            <Input
              label="Daily ETH Limit"
              type="number"
              placeholder="1.0"
              hint="Maximum ETH that can be spent per day"
            />
            <Input
              label="Daily Token Limit (USD)"
              type="number"
              placeholder="1000"
              hint="Maximum USD value of tokens that can be spent per day"
            />
            <Button variant="secondary">Update Limits</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Recovery Options</CardTitle>
          <CardDescription className="mb-6">
            Configure account recovery methods in case you lose access to your wallet.
          </CardDescription>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Email Recovery</p>
                  <p className="text-sm text-gray-500">Not configured</p>
                </div>
              </div>
              <Button variant="secondary" size="sm">Setup</Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Social Recovery</p>
                  <p className="text-sm text-gray-500">Not configured</p>
                </div>
              </div>
              <Button variant="secondary" size="sm">Setup</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium text-yellow-900">Security Best Practices</p>
              <p className="text-sm text-yellow-700 mt-1">
                Never share your private keys or seed phrase. StableNet will never ask for this information.
                Consider setting up recovery options to protect your account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
