'use client'

import { SummaryStatCard } from '@/components/enterprise'

interface DefiStatsCardsProps {
  totalValueLocked: string
  volume24h: string
  yourPositions: number
}

export function DefiStatsCards({
  totalValueLocked,
  volume24h,
  yourPositions,
}: DefiStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SummaryStatCard label="Total Value Locked" value={totalValueLocked} />
      <SummaryStatCard label="24h Volume" value={volume24h} />
      <SummaryStatCard label="Your Positions" value={yourPositions} />
    </div>
  )
}
