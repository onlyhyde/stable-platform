'use client'

import { Card, CardContent, CardTitle, CardDescription, Button, Input } from '@/components/common'
import { supportedChains } from '@/lib/chains'

interface NetworkSettingsCardProps {
  currentChainId: number
  onSwitchChain: (chainId: number) => void
}

export function NetworkSettingsCard({ currentChainId, onSwitchChain }: NetworkSettingsCardProps) {
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
