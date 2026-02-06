'use client'

import { PageHeader } from '@/components/common'
import {
  HowItWorksCard,
  StealthInfoBanner,
  StealthNavigationCards,
  StealthStatsCards,
} from '@/components/stealth'
import { useWallet } from '@/hooks'

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
        <StealthStatsCards addressesUsed={0} pendingAnnouncements={0} totalReceived="0 ETH" />
      )}
    </div>
  )
}
