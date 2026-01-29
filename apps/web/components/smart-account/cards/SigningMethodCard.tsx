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
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          Signing Method
        </h3>

        <div className="space-y-3">
          {/* Private Key Option */}
          <label
            className="flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: signingMethod === 'privateKey' ? 'rgb(var(--primary) / 0.1)' : 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: signingMethod === 'privateKey' ? 'rgb(var(--primary))' : 'rgb(var(--border))',
            }}
          >
            <input
              type="radio"
              name="signingMethod"
              value="privateKey"
              checked={signingMethod === 'privateKey'}
              onChange={() => onSigningMethodChange('privateKey')}
              className="mt-1"
              style={{ accentColor: 'rgb(var(--primary))' }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                Private Key
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Enter your private key directly. Best for development with Anvil test accounts.
              </div>
            </div>
          </label>

          {/* MetaMask eth_sign Option */}
          <label
            className="flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: signingMethod === 'metamask' ? 'rgb(var(--primary) / 0.1)' : 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: signingMethod === 'metamask' ? 'rgb(var(--primary))' : 'rgb(var(--border))',
            }}
          >
            <input
              type="radio"
              name="signingMethod"
              value="metamask"
              checked={signingMethod === 'metamask'}
              onChange={() => onSigningMethodChange('metamask')}
              className="mt-1"
              style={{ accentColor: 'rgb(var(--primary))' }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                MetaMask (eth_sign)
                <span
                  className="ml-2 text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgb(var(--warning) / 0.1)',
                    color: 'rgb(var(--warning))',
                  }}
                >
                  Experimental
                </span>
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Sign with MetaMask using eth_sign. Requires enabling in MetaMask Settings → Advanced.
              </div>
              {signingMethod === 'metamask' && (
                <div
                  className="mt-3 p-3 rounded text-sm"
                  style={{
                    backgroundColor: 'rgb(var(--warning) / 0.1)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgb(var(--warning) / 0.3)',
                  }}
                >
                  <div className="font-medium mb-1" style={{ color: 'rgb(var(--warning))' }}>
                    Setup Required:
                  </div>
                  <ol
                    className="space-y-1 list-decimal list-inside"
                    style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                  >
                    <li>Open MetaMask Settings</li>
                    <li>Go to Advanced</li>
                    <li>Enable "Toggle eth_sign requests"</li>
                  </ol>
                  <div className="mt-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
