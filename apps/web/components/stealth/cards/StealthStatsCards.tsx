'use client'

import { SummaryStatCard } from '@/components/enterprise'

interface StealthStatsCardsProps {
  addressesUsed: number
  pendingAnnouncements: number
  totalReceived: string
}

export function StealthStatsCards({
  addressesUsed,
  pendingAnnouncements,
  totalReceived,
}: StealthStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SummaryStatCard label="Stealth Addresses Used" value={addressesUsed} />
      <SummaryStatCard label="Pending Announcements" value={pendingAnnouncements} />
      <SummaryStatCard label="Total Received" value={totalReceived} />
    </div>
  )
}
