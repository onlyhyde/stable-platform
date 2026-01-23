'use client'

import { Card, CardContent } from '@/components/common'
import type { SigningMethod } from '@/hooks/useSmartAccount'

interface SigningMethodCardProps {
  signingMethod: SigningMethod
  onSigningMethodChange: (method: SigningMethod) => void
}

export function SigningMethodCard({
  signingMethod,
  onSigningMethodChange,
}: SigningMethodCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Signing Method</h3>

        <div className="space-y-3">
          {/* Private Key Option */}
          <label
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              signingMethod === 'privateKey'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="signingMethod"
              value="privateKey"
              checked={signingMethod === 'privateKey'}
              onChange={() => onSigningMethodChange('privateKey')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Private Key</div>
              <div className="text-sm text-gray-500 mt-1">
                Enter your private key directly. Best for development with Anvil test accounts.
              </div>
            </div>
          </label>

          {/* MetaMask eth_sign Option */}
          <label
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              signingMethod === 'metamask'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="signingMethod"
              value="metamask"
              checked={signingMethod === 'metamask'}
              onChange={() => onSigningMethodChange('metamask')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                MetaMask (eth_sign)
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  Experimental
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Sign with MetaMask using eth_sign. Requires enabling in MetaMask Settings → Advanced.
              </div>
              {signingMethod === 'metamask' && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <div className="font-medium text-yellow-800 mb-1">Setup Required:</div>
                  <ol className="text-yellow-700 space-y-1 list-decimal list-inside">
                    <li>Open MetaMask Settings</li>
                    <li>Go to Advanced</li>
                    <li>Enable "Toggle eth_sign requests"</li>
                  </ol>
                  <div className="mt-2 text-yellow-600 text-xs">
                    Note: A relayer account (Anvil Account #0) will pay the gas fee.
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
