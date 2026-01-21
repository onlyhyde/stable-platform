'use client'

import { Card, CardContent, Button } from '@/components/common'
import { formatAddress } from '@/lib/utils'
import type { Address } from 'viem'

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
            <h3 className="text-lg font-semibold text-gray-900">Account Status</h3>
            <p className="text-sm text-gray-500">
              {address && formatAddress(address)}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={status.isLoading}>
            {status.isLoading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>

        {status.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50">
              <div className={`w-3 h-3 rounded-full ${status.isSmartAccount ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="font-medium text-gray-900">
                  {status.isSmartAccount ? 'Smart Account Active' : 'Regular EOA'}
                </p>
                <p className="text-sm text-gray-500">
                  {status.isSmartAccount
                    ? 'Your account is delegated to a smart contract'
                    : 'Your account is a standard Externally Owned Account'}
                </p>
              </div>
            </div>

            {status.isSmartAccount && status.implementation && (
              <div className="p-4 rounded-lg border border-gray-200 overflow-hidden">
                <p className="text-sm text-gray-500 mb-1">Delegated Implementation</p>
                <p className="font-mono text-sm text-gray-900 break-all">{status.implementation}</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 overflow-hidden">
                <p className="text-sm text-red-700 break-words whitespace-pre-wrap">{error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
