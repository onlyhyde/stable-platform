'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/common'
import { DefiNavigationCards, DefiStatsCards } from '@/components/defi'
import { usePools } from '@/hooks/usePools'
import { formatUSD } from '@/lib/utils'

export default function DeFiPage() {
  const { pools, positions, isLoading } = usePools()

  const stats = useMemo(() => {
    const tvl = pools.reduce((sum, p) => sum + p.tvl, 0)
    return {
      totalValueLocked:
        tvl > 0
          ? `$${tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '$0.00',
      volume24h: 'Coming soon',
      yourPositions: positions.length,
    }
  }, [pools, positions])

  return (
    <div className="space-y-6">
      <PageHeader title="DeFi" description="Swap tokens and provide liquidity" />

      <DefiNavigationCards />

      <DefiStatsCards
        totalValueLocked={stats.totalValueLocked}
        volume24h={stats.volume24h}
        yourPositions={stats.yourPositions}
      />

      {/* Pool Overview */}
      {pools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Pools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {pools.map((pool) => (
                <div key={pool.address} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: 'rgb(var(--primary) / 0.1)',
                        color: 'rgb(var(--primary))',
                      }}
                    >
                      {pool.token0.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        Fee: {pool.fee}%{pool.apr > 0 ? ` · APR: ${pool.apr.toFixed(1)}%` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {pool.tvl > 0 ? formatUSD(pool.tvl) : '-'}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        TVL
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/defi/swap?tokenIn=${pool.token0.address}&tokenOut=${pool.token1.address}`}
                        className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: 'rgb(var(--primary) / 0.1)',
                          color: 'rgb(var(--primary))',
                        }}
                      >
                        Swap
                      </Link>
                      <Link
                        href={`/defi/pool?add=${pool.address}`}
                        className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: 'rgb(var(--secondary))',
                          color: 'rgb(var(--foreground))',
                        }}
                      >
                        Add Liquidity
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && pools.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p style={{ color: 'rgb(var(--muted-foreground))' }}>
              No pools available yet. Check back later.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
