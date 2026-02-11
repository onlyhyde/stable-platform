'use client'

import type { Address } from 'viem'
import { Card, CardContent } from '@/components/common'

interface AuthorizationDetailsCardProps {
  authorization: {
    chainId: number
    contractAddress: Address
    nonce: number
  }
  txHash?: `0x${string}` | null
}

export function AuthorizationDetailsCard({ authorization, txHash }: AuthorizationDetailsCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          EIP-7702 Transaction
        </h3>
        <div
          className="space-y-3 text-sm p-4 rounded-lg overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          {txHash && (
            <div
              className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-2"
              style={{ borderBottom: '1px solid rgb(var(--border))' }}
            >
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Transaction Hash:</span>
              <span
                className="font-mono break-all text-xs"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {txHash}
              </span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Chain ID:</span>
            <span className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
              {authorization.chainId}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Delegate Address:</span>
            <span className="font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
              {authorization.contractAddress}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Nonce:</span>
            <span className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
              {authorization.nonce}
            </span>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {txHash
            ? 'EIP-7702 SetCode transaction has been submitted. Your EOA is now delegated to the specified contract.'
            : 'Authorization signed. Waiting for transaction submission.'}
        </p>
      </CardContent>
    </Card>
  )
}
