'use client'

import { useMemo } from 'react'
import { PageHeader } from '@/components/common'
import { DefiNavigationCards, DefiStatsCards } from '@/components/defi'
import { usePools } from '@/hooks/usePools'

export default function DeFiPage() {
  const { pools } = usePools()

  const stats = useMemo(() => {
    const tvl = pools.reduce((sum, p) => sum + p.tvl, 0)
    // volume24h would come from indexer — not available in pool data
    return {
      totalValueLocked:
        tvl > 0
          ? `$${tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '$0.00',
      volume24h: '$0.00',
      yourPositions: pools.length,
    }
  }, [pools])

  return (
    <div className="space-y-6">
      <PageHeader title="DeFi" description="Swap tokens and provide liquidity" />

      <DefiNavigationCards />

      <DefiStatsCards
        totalValueLocked={stats.totalValueLocked}
        volume24h={stats.volume24h}
        yourPositions={stats.yourPositions}
      />
    </div>
  )
}
