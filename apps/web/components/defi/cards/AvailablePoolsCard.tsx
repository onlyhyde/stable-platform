'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import type { Pool } from '@/types'

interface AvailablePoolsCardProps {
  pools: Pool[]
  onAddLiquidity: (pool: Pool) => void
}

export function AvailablePoolsCard({ pools, onAddLiquidity }: AvailablePoolsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Pools</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="text-left text-sm border-b"
                style={{ color: 'rgb(var(--muted-foreground))', borderColor: 'rgb(var(--border))' }}
              >
                <th className="pb-3 font-medium">Pool</th>
                <th className="pb-3 font-medium">TVL</th>
                <th className="pb-3 font-medium">APR</th>
                <th className="pb-3 font-medium">Fee</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {pools.map((pool) => (
                <tr key={pool.address} className="group">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                          style={{ backgroundColor: 'rgb(var(--secondary))' }}
                        >
                          {pool.token0.symbol[0]}
                        </div>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                          style={{ backgroundColor: 'rgb(var(--secondary))' }}
                        >
                          {pool.token1.symbol[0]}
                        </div>
                      </div>
                      <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="py-4" style={{ color: 'rgb(var(--foreground))' }}>
                    ${pool.tvl.toLocaleString()}
                  </td>
                  <td className="py-4">
                    <span className="font-medium" style={{ color: 'rgb(var(--success))' }}>
                      {pool.apr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {pool.fee}%
                  </td>
                  <td className="py-4 text-right">
                    <Button variant="secondary" size="sm" onClick={() => onAddLiquidity(pool)}>
                      Add
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
