'use client'

import type { Address } from 'viem'
import { Button, Card, CardContent } from '@/components/common'
import { formatAddress } from '@/lib/utils'

interface AccountStatusCardProps {
  address: Address | undefined
  status: {
    isSmartAccount: boolean
    implementation: Address | null
    isLoading: boolean
  }
  error: string | null
  onRefresh: () => void
}

export function AccountStatusCard({ address, status, error, onRefresh }: AccountStatusCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              Account Status
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {address && formatAddress(address)}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={status.isLoading}>
            {status.isLoading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>

        {status.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: 'rgb(var(--primary))' }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: status.isSmartAccount
                    ? 'rgb(var(--success))'
                    : 'rgb(var(--warning))',
                }}
              />
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {status.isSmartAccount ? 'Smart Account Active' : 'Regular EOA'}
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {status.isSmartAccount
                    ? 'Your account is delegated to a smart contract'
                    : 'Your account is a standard Externally Owned Account'}
                </p>
              </div>
            </div>

            {status.isSmartAccount && status.implementation && (
              <div
                className="p-4 rounded-lg overflow-hidden"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgb(var(--border))',
                }}
              >
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Delegated Implementation
                </p>
                <p
                  className="font-mono text-sm break-all"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {status.implementation}
                </p>
              </div>
            )}

            {error && (
              <div
                className="p-4 rounded-lg overflow-hidden"
                style={{
                  backgroundColor: 'rgb(var(--destructive) / 0.1)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgb(var(--destructive) / 0.3)',
                }}
              >
                <p
                  className="text-sm break-words whitespace-pre-wrap"
                  style={{ color: 'rgb(var(--destructive))' }}
                >
                  {error}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
