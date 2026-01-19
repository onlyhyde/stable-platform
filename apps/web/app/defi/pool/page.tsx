'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Modal } from '@/components/common'
import type { Pool } from '@/types'

// Mock pools for demo
const mockPools: Pool[] = [
  {
    address: '0x1234567890123456789012345678901234567890',
    token0: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    token1: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    reserve0: BigInt('1000000000000000000000'),
    reserve1: BigInt('2000000000000'),
    fee: 0.3,
    tvl: 4000000,
    apr: 12.5,
  },
  {
    address: '0x2345678901234567890123456789012345678901',
    token0: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    token1: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    reserve0: BigInt('5000000000000'),
    reserve1: BigInt('5000000000000'),
    fee: 0.05,
    tvl: 10000000,
    apr: 5.2,
  },
]

export default function PoolPage() {
  const { isConnected } = useWallet()
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to view pools</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidity Pools</h1>
          <p className="text-gray-500">Provide liquidity and earn trading fees</p>
        </div>
        <Button onClick={() => setIsAddLiquidityOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Liquidity
        </Button>
      </div>

      {/* Your Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
            <p className="text-gray-500">No liquidity positions yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add liquidity to start earning fees
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Pools */}
      <Card>
        <CardHeader>
          <CardTitle>Available Pools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Pool</th>
                  <th className="pb-3 font-medium">TVL</th>
                  <th className="pb-3 font-medium">APR</th>
                  <th className="pb-3 font-medium">Fee</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockPools.map((pool) => (
                  <tr key={pool.address} className="group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                            {pool.token0.symbol[0]}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">
                            {pool.token1.symbol[0]}
                          </div>
                        </div>
                        <span className="font-medium text-gray-900">
                          {pool.token0.symbol}/{pool.token1.symbol}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-900">
                      ${pool.tvl.toLocaleString()}
                    </td>
                    <td className="py-4">
                      <span className="text-green-600 font-medium">
                        {pool.apr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4 text-gray-500">
                      {pool.fee}%
                    </td>
                    <td className="py-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedPool(pool)
                          setIsAddLiquidityOpen(true)
                        }}
                      >
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

      {/* Add Liquidity Modal */}
      <Modal
        isOpen={isAddLiquidityOpen}
        onClose={() => {
          setIsAddLiquidityOpen(false)
          setSelectedPool(null)
        }}
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
    </div>
  )
}
