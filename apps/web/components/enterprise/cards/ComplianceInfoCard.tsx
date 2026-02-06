'use client'

import { Card, CardContent } from '@/components/common'

export function ComplianceInfoCard() {
  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="py-4">
        <div className="flex gap-3">
          <svg
            className="w-6 h-6 text-green-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <div>
            <p className="font-medium text-green-900">Immutable Audit Trail</p>
            <p className="text-sm text-green-700 mt-1">
              All actions are recorded on-chain with cryptographic signatures. This provides
              tamper-proof evidence for regulatory compliance and internal audits.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
