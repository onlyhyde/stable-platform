'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { PageHeader, ConnectWalletCard, Button } from '@/components/common'
import {
  YourPositionsCard,
  AvailablePoolsCard,
  AddLiquidityModal,
} from '@/components/defi'
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

  function handleAddLiquidity(pool: Pool) {
    setSelectedPool(pool)
    setIsAddLiquidityOpen(true)
  }

  function handleCloseModal() {
    setIsAddLiquidityOpen(false)
    setSelectedPool(null)
  }

  if (!isConnected) {
    return (
      <ConnectWalletCard message="Please connect your wallet to view pools" />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Liquidity Pools"
          description="Provide liquidity and earn trading fees"
        />
        <Button onClick={() => setIsAddLiquidityOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Liquidity
        </Button>
      </div>

      <YourPositionsCard />

      <AvailablePoolsCard
        pools={mockPools}
        onAddLiquidity={handleAddLiquidity}
      />

      <AddLiquidityModal
        isOpen={isAddLiquidityOpen}
        onClose={handleCloseModal}
        selectedPool={selectedPool}
      />
    </div>
  )
}
