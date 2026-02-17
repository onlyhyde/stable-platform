'use client'

import { Card, CardContent } from '../../../components/common/Card'
import { MerchantDashboard } from '../../../components/merchant/MerchantDashboard'
import { useWallet } from '../../../hooks/useWallet'

export default function MerchantDashboardPage() {
  const { isConnected } = useWallet()

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                aria-hidden="true"
                className="w-8 h-8"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Connect to Continue
            </h2>
            <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Connect your wallet to access the merchant dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <MerchantDashboard />
}
