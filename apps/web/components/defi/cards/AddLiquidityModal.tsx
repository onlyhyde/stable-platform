'use client'

import { Modal, Button } from '@/components/common'
import type { Pool } from '@/types'

interface AddLiquidityModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPool: Pool | null
}

export function AddLiquidityModal({ isOpen, onClose, selectedPool }: AddLiquidityModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Liquidity"
    >
      <div className="space-y-4">
        {selectedPool ? (
          <>
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                  {selectedPool.token0.symbol[0]}
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium">
                  {selectedPool.token1.symbol[0]}
                </div>
              </div>
              <span className="text-lg font-medium">
                {selectedPool.token0.symbol}/{selectedPool.token1.symbol}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg">
                <label htmlFor="token0-amount" className="text-sm text-gray-500 block mb-2">{selectedPool.token0.symbol} Amount</label>
                <input
                  id="token0-amount"
                  type="number"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <label htmlFor="token1-amount" className="text-sm text-gray-500 block mb-2">{selectedPool.token1.symbol} Amount</label>
                <input
                  id="token1-amount"
                  type="number"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pool Share</span>
                <span className="text-gray-900">0.00%</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">APR</span>
                <span className="text-green-600 font-medium">{selectedPool.apr.toFixed(2)}%</span>
              </div>
            </div>

            <Button className="w-full">
              Add Liquidity
            </Button>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Select a pool to add liquidity</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
