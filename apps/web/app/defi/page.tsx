'use client'

import { PageHeader } from '@/components/common'
import { DefiNavigationCards, DefiStatsCards } from '@/components/defi'

export default function DeFiPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="DeFi" description="Swap tokens and provide liquidity" />

      <DefiNavigationCards />

      <DefiStatsCards totalValueLocked="$0.00" volume24h="$0.00" yourPositions={0} />
    </div>
  )
}
