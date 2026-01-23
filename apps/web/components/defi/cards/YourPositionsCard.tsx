'use client'

import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/common'
import { EmptyState } from '@/components/enterprise'
import type { LiquidityPosition } from '@/types'

interface YourPositionsCardProps {
  positions?: LiquidityPosition[]
  isLoading?: boolean
  onRemoveLiquidity?: (position: LiquidityPosition) => void
}

export function YourPositionsCard({
  positions = [],
  isLoading = false,
  onRemoveLiquidity,
}: YourPositionsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">Loading positions...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={
              <svg
                className="w-16 h-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            title="No liquidity positions yet"
            description="Add liquidity to start earning fees"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-gray-200">
          {positions.map((position) => (
            <PositionItem
              key={position.poolAddress}
              position={position}
              onRemove={onRemoveLiquidity}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface PositionItemProps {
  position: LiquidityPosition
  onRemove?: (position: LiquidityPosition) => void
}

function PositionItem({ position, onRemove }: PositionItemProps) {
  const formatAmount = (amount: bigint, decimals: number) => {
    const value = Number(amount) / 10 ** decimals
    return value.toLocaleString('en-US', { maximumFractionDigits: 6 })
  }

  return (
    <div className="py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 border-2 border-white">
            {position.token0.symbol.slice(0, 2)}
          </div>
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-600 border-2 border-white">
            {position.token1.symbol.slice(0, 2)}
          </div>
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {position.token0.symbol} / {position.token1.symbol}
          </p>
          <p className="text-sm text-gray-500">
            {(position.shareOfPool * 100).toFixed(2)}% share
          </p>
        </div>
      </div>
      <div className="text-right flex items-center gap-4">
        <div>
          <p className="text-sm text-gray-900">
            {formatAmount(position.token0Amount, position.token0.decimals)} {position.token0.symbol}
          </p>
          <p className="text-sm text-gray-500">
            {formatAmount(position.token1Amount, position.token1.decimals)} {position.token1.symbol}
          </p>
        </div>
        {onRemove && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRemove(position)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
