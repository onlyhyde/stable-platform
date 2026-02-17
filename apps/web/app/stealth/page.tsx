'use client'

import { useMemo } from 'react'
import { formatEther } from 'viem'
import { PageHeader } from '@/components/common'
import {
  HowItWorksCard,
  StealthInfoBanner,
  StealthNavigationCards,
  StealthStatsCards,
} from '@/components/stealth'
import { useStealth, useWallet } from '@/hooks'

export default function StealthPage() {
  const { isConnected } = useWallet()
  const { announcements } = useStealth()

  const stats = useMemo(() => {
    const uniqueAddresses = new Set(announcements.map((a) => a.stealthAddress))
    const totalWei = announcements.reduce((sum, a) => sum + a.value, BigInt(0))
    return {
      addressesUsed: uniqueAddresses.size,
      pendingAnnouncements: announcements.length,
      totalReceived: `${formatEther(totalWei)} ETH`,
    }
  }, [announcements])

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
          addressesUsed={stats.addressesUsed}
          pendingAnnouncements={stats.pendingAnnouncements}
          totalReceived={stats.totalReceived}
        />
      )}
    </div>
  )
}
