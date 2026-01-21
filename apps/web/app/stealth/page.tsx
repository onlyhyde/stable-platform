'use client'

import { useWallet } from '@/hooks'
import { PageHeader } from '@/components/common'
import {
  StealthInfoBanner,
  StealthNavigationCards,
  HowItWorksCard,
  StealthStatsCards,
} from '@/components/stealth'

export default function StealthPage() {
  const { isConnected } = useWallet()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stealth Transactions"
        description="Send and receive with enhanced privacy"
      />

      <StealthInfoBanner />

      <StealthNavigationCards />

      <HowItWorksCard />

      {isConnected && (
        <StealthStatsCards
          addressesUsed={0}
          pendingAnnouncements={0}
          totalReceived="0 ETH"
        />
      )}
    </div>
  )
}
