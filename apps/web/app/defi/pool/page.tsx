'use client'

import { useCallback, useState } from 'react'
import { Button, ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import { AddLiquidityModal, AvailablePoolsCard, YourPositionsCard } from '@/components/defi'
import type { LiquidityFormData } from '@/components/defi/cards/AddLiquidityModal'
import { useWallet } from '@/hooks'
import { usePools } from '@/hooks/usePools'
import type { LiquidityPosition, Pool } from '@/types'

export default function PoolPage() {
  const { isConnected } = useWallet()
  const { pools, isLoading, error } = usePools()
  const { addToast } = useToast()
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)

  function handleAddLiquidity(pool: Pool) {
    setSelectedPool(pool)
    setIsAddLiquidityOpen(true)
  }

  function handleCloseModal() {
    setIsAddLiquidityOpen(false)
    setSelectedPool(null)
  }

  const handleSubmitLiquidity = useCallback(async (data: LiquidityFormData) => {
    addToast({
      type: 'loading',
      title: 'Adding Liquidity',
      message: `Adding liquidity to pool ${data.poolAddress.slice(0, 8)}...`,
      persistent: true,
    })
    handleCloseModal()
  }, [addToast])

  const handleRemoveLiquidity = useCallback((position: LiquidityPosition) => {
    addToast({
      type: 'loading',
      title: 'Removing Liquidity',
      message: `Removing liquidity from ${position.token0.symbol}/${position.token1.symbol} pool...`,
      persistent: true,
    })
  }, [addToast])

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to view pools" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading pools...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--destructive))' }}>Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Liquidity Pools" description="Provide liquidity and earn trading fees" />
        <Button onClick={() => setIsAddLiquidityOpen(true)}>
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Liquidity
        </Button>
      </div>

      <YourPositionsCard onRemoveLiquidity={handleRemoveLiquidity} />

      <AvailablePoolsCard pools={pools} onAddLiquidity={handleAddLiquidity} />

      <AddLiquidityModal
        isOpen={isAddLiquidityOpen}
        onClose={handleCloseModal}
        selectedPool={selectedPool}
        onSubmit={handleSubmitLiquidity}
      />
    </div>
  )
}
