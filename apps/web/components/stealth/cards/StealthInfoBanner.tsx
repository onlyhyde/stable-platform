'use client'

import { Card, CardContent } from '@/components/common'

export function StealthInfoBanner() {
  return (
    <Card className="bg-primary-50 border-primary-200">
      <CardContent className="py-4">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-primary-900">What are Stealth Addresses?</p>
            <p className="text-sm text-primary-700 mt-1">
              Stealth addresses provide privacy by generating unique one-time addresses for each transaction.
              Only the recipient can detect and access funds sent to their stealth meta-address.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
