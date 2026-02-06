'use client'

import { Button, Modal } from '@/components/common'
import type { Pool } from '@/types'
import { useEffect, useMemo, useState } from 'react'

interface AddLiquidityModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: LiquidityFormData) => Promise<void>
  selectedPool: Pool | null
}

export interface LiquidityFormData {
  token0Amount: string
  token1Amount: string
  poolAddress: string
}

export function AddLiquidityModal({
  isOpen,
  onClose,
  onSubmit,
  selectedPool,
}: AddLiquidityModalProps) {
  const [token0Amount, setToken0Amount] = useState('')
  const [token1Amount, setToken1Amount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset form when modal closes or pool changes
  useEffect(() => {
    if (!isOpen) {
      setToken0Amount('')
      setToken1Amount('')
      setIsLoading(false)
    }
  }, [isOpen])

  // Calculate pool share based on input amounts
  const poolShare = useMemo(() => {
    if (!selectedPool || !token0Amount || !token1Amount) return 0

    const amount0 = Number(token0Amount)
    const amount1 = Number(token1Amount)

    if (amount0 <= 0 || amount1 <= 0) return 0

    // Calculate share based on reserve ratio
    const reserve0 = Number(selectedPool.reserve0) / 10 ** selectedPool.token0.decimals
    const reserve1 = Number(selectedPool.reserve1) / 10 ** selectedPool.token1.decimals

    const share0 = (amount0 / (reserve0 + amount0)) * 100
    const share1 = (amount1 / (reserve1 + amount1)) * 100

    // Return the minimum share (to be conservative)
    return Math.min(share0, share1)
  }, [selectedPool, token0Amount, token1Amount])

  const isValid = useMemo(() => {
    return (
      selectedPool &&
      token0Amount &&
      token1Amount &&
      Number(token0Amount) > 0 &&
      Number(token1Amount) > 0
    )
  }, [selectedPool, token0Amount, token1Amount])

  const handleSubmit = async () => {
    if (!isValid || !selectedPool || !onSubmit) return

    setIsLoading(true)
    try {
      await onSubmit({
        token0Amount,
        token1Amount,
        poolAddress: selectedPool.address,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Liquidity">
      <div className="space-y-4">
        {selectedPool ? (
          <>
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="flex -space-x-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                >
                  {selectedPool.token0.symbol[0]}
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                >
                  {selectedPool.token1.symbol[0]}
                </div>
              </div>
              <span className="text-lg font-medium">
                {selectedPool.token0.symbol}/{selectedPool.token1.symbol}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
                <label
                  htmlFor="token0-amount"
                  className="text-sm block mb-2"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {selectedPool.token0.symbol} Amount
                </label>
                <input
                  id="token0-amount"
                  type="number"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  value={token0Amount}
                  onChange={(e) => setToken0Amount(e.target.value)}
                  aria-label={`${selectedPool.token0.symbol} Amount`}
                />
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
                <label
                  htmlFor="token1-amount"
                  className="text-sm block mb-2"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {selectedPool.token1.symbol} Amount
                </label>
                <input
                  id="token1-amount"
                  type="number"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  value={token1Amount}
                  onChange={(e) => setToken1Amount(e.target.value)}
                  aria-label={`${selectedPool.token1.symbol} Amount`}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Pool Share</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>{poolShare.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>APR</span>
                <span className="font-medium" style={{ color: 'rgb(var(--success))' }}>
                  {selectedPool.apr.toFixed(2)}%
                </span>
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={!isValid || isLoading}>
              {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
            </Button>
          </>
        ) : (
          <div className="text-center py-8">
            <p style={{ color: 'rgb(var(--muted-foreground))' }}>Select a pool to add liquidity</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
