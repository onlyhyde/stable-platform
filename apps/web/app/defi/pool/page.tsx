'use client'

import { useCallback, useState } from 'react'
import { Button, ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import { AddLiquidityModal, AvailablePoolsCard, YourPositionsCard } from '@/components/defi'
import type { LiquidityFormData } from '@/components/defi/cards/AddLiquidityModal'
import { useWallet } from '@/hooks'
import { usePoolLiquidity } from '@/hooks/usePoolLiquidity'
import { usePools } from '@/hooks/usePools'
import type { LiquidityPosition, Pool } from '@/types'

export default function PoolPage() {
  const { isConnected } = useWallet()
  const { pools, positions, isLoading, isLoadingPositions, error, refresh } = usePools()
  const { addLiquidity, removeLiquidity, step, error: txError, clearError } = usePoolLiquidity()
  const { addToast } = useToast()
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)

  function handleAddLiquidity(pool: Pool) {
    setSelectedPool(pool)
    setIsAddLiquidityOpen(true)
    clearError()
  }

  const handleCloseModal = useCallback(() => {
    setIsAddLiquidityOpen(false)
    setSelectedPool(null)
    clearError()
  }, [clearError])

  const handleSubmitLiquidity = useCallback(
    async (data: LiquidityFormData) => {
      if (!selectedPool) return

      const hash = await addLiquidity({
        pool: selectedPool,
        amount0: data.token0Amount,
        amount1: data.token1Amount,
        slippageBps: data.slippageBps,
      })

      if (hash) {
        addToast({
          type: 'success',
          title: 'Liquidity Added',
          message: `Successfully added liquidity to ${selectedPool.token0.symbol}/${selectedPool.token1.symbol}`,
        })
        handleCloseModal()
        await refresh()
      }
    },
    [selectedPool, addLiquidity, addToast, handleCloseModal, refresh]
  )

  const handleRemoveLiquidity = useCallback(
    async (position: LiquidityPosition) => {
      const pool = pools.find((p) => p.address === position.poolAddress)
      if (!pool) {
        addToast({ type: 'error', title: 'Error', message: 'Pool not found' })
        return
      }

      addToast({
        type: 'loading',
        title: 'Removing Liquidity',
        message: `Removing liquidity from ${position.token0.symbol}/${position.token1.symbol}...`,
        persistent: true,
      })

      const hash = await removeLiquidity({
        pool,
        liquidity: position.liquidity,
      })

      if (hash) {
        addToast({
          type: 'success',
          title: 'Liquidity Removed',
          message: `Successfully removed liquidity from ${position.token0.symbol}/${position.token1.symbol}`,
        })
        await refresh()
      } else {
        addToast({
          type: 'error',
          title: 'Failed',
          message: 'Failed to remove liquidity. Please try again.',
        })
      }
    },
    [pools, removeLiquidity, addToast, refresh]
  )

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p style={{ color: 'rgb(var(--destructive))' }}>Error: {error.message}</p>
        <Button variant="secondary" onClick={refresh}>
          Retry
        </Button>
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

      <YourPositionsCard
        positions={positions}
        isLoading={isLoadingPositions}
        onRemoveLiquidity={handleRemoveLiquidity}
      />

      <AvailablePoolsCard pools={pools} onAddLiquidity={handleAddLiquidity} />

      <AddLiquidityModal
        isOpen={isAddLiquidityOpen}
        onClose={handleCloseModal}
        selectedPool={selectedPool}
        onSubmit={handleSubmitLiquidity}
        step={step}
        txError={txError}
      />
    </div>
  )
}
