'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from '@/components/common'
import type { LiquidityStep } from '@/hooks/usePoolLiquidity'
import type { Pool } from '@/types'

interface AddLiquidityModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: LiquidityFormData) => Promise<void>
  selectedPool: Pool | null
  step?: LiquidityStep
  txError?: string | null
}

export interface LiquidityFormData {
  token0Amount: string
  token1Amount: string
  poolAddress: string
  slippageBps: number
}

const SLIPPAGE_PRESETS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1.0%', value: 100 },
]

function getStepLabel(step: LiquidityStep | undefined): string {
  switch (step) {
    case 'approving-token0':
      return 'Approving Token A...'
    case 'approving-token1':
      return 'Approving Token B...'
    case 'adding':
      return 'Adding Liquidity...'
    case 'confirmed':
      return 'Liquidity Added!'
    case 'failed':
      return 'Transaction Failed'
    default:
      return ''
  }
}

export function AddLiquidityModal({
  isOpen,
  onClose,
  onSubmit,
  selectedPool,
  step = 'idle',
  txError,
}: AddLiquidityModalProps) {
  const [token0Amount, setToken0Amount] = useState('')
  const [token1Amount, setToken1Amount] = useState('')
  const [slippageBps, setSlippageBps] = useState(50)
  const [customSlippage, setCustomSlippage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setToken0Amount('')
      setToken1Amount('')
      setIsLoading(false)
      setCustomSlippage('')
    }
  }, [isOpen])

  // Auto-close on confirmed
  useEffect(() => {
    if (step === 'confirmed') {
      const timer = setTimeout(() => onClose(), 2000)
      return () => clearTimeout(timer)
    }
  }, [step, onClose])

  const poolShare = useMemo(() => {
    if (!selectedPool || !token0Amount || !token1Amount) return 0

    const amount0 = Number(token0Amount)
    const amount1 = Number(token1Amount)
    if (amount0 <= 0 || amount1 <= 0) return 0

    const reserve0 = Number(selectedPool.reserve0) / 10 ** selectedPool.token0.decimals
    const reserve1 = Number(selectedPool.reserve1) / 10 ** selectedPool.token1.decimals

    const share0 = (amount0 / (reserve0 + amount0)) * 100
    const share1 = (amount1 / (reserve1 + amount1)) * 100

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

  const isProcessing = step === 'approving-token0' || step === 'approving-token1' || step === 'adding'

  const handleSubmit = async () => {
    if (!isValid || !selectedPool || !onSubmit) return

    setIsLoading(true)
    try {
      await onSubmit({
        token0Amount,
        token1Amount,
        poolAddress: selectedPool.address,
        slippageBps,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSlippagePreset = (value: number) => {
    setSlippageBps(value)
    setCustomSlippage('')
  }

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippageBps(Math.round(num * 100))
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
                  aria-label={`${selectedPool.token1.symbol} Amount`}
                />
              </div>
            </div>

            {/* Slippage Tolerance */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <p className="text-sm mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Slippage Tolerance
              </p>
              <div className="flex gap-2">
                {SLIPPAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="px-3 py-1 text-sm rounded-md border transition-colors"
                    style={{
                      borderColor:
                        slippageBps === preset.value && !customSlippage
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--border))',
                      backgroundColor:
                        slippageBps === preset.value && !customSlippage
                          ? 'rgb(var(--primary) / 0.1)'
                          : 'transparent',
                      color:
                        slippageBps === preset.value && !customSlippage
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--foreground))',
                    }}
                    onClick={() => handleSlippagePreset(preset.value)}
                    disabled={isProcessing}
                  >
                    {preset.label}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom %"
                  className="w-24 px-2 py-1 text-sm border rounded-md"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  disabled={isProcessing}
                  min="0.01"
                  max="50"
                  step="0.1"
                />
              </div>
            </div>

            {/* Pool Info */}
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
              <div className="flex justify-between text-sm mt-2">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Slippage</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {(slippageBps / 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Transaction Progress */}
            {isProcessing && (
              <div
                className="p-3 rounded-lg text-sm text-center"
                style={{ backgroundColor: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' }}
              >
                {getStepLabel(step)}
              </div>
            )}

            {step === 'confirmed' && (
              <div
                className="p-3 rounded-lg text-sm text-center"
                style={{ backgroundColor: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' }}
              >
                Liquidity added successfully!
              </div>
            )}

            {(step === 'failed' || txError) && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgb(var(--destructive) / 0.1)',
                  color: 'rgb(var(--destructive))',
                }}
              >
                {txError || 'Transaction failed. Please try again.'}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!isValid || isLoading || isProcessing}
            >
              {isProcessing ? getStepLabel(step) : isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
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
