'use client'

import { Card, CardContent } from '@/components/common'
import type { Address } from 'viem'

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">EIP-7702 Transaction</h3>
        <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-lg overflow-hidden">
          {txHash && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-2 border-b border-gray-200">
              <span className="text-gray-500">Transaction Hash:</span>
              <span className="text-gray-900 font-mono break-all text-xs">{txHash}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-gray-500">Chain ID:</span>
            <span className="text-gray-900 font-mono">{authorization.chainId}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-gray-500">Delegate Address:</span>
            <span className="text-gray-900 font-mono break-all">{authorization.contractAddress}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-gray-500">Nonce:</span>
            <span className="text-gray-900 font-mono">{authorization.nonce}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {txHash
            ? 'EIP-7702 SetCode transaction has been submitted. Your EOA is now delegated to the specified contract.'
            : 'Authorization signed. Waiting for transaction submission.'}
        </p>
      </CardContent>
    </Card>
  )
}
