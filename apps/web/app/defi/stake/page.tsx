'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { useWallet } from '@/hooks'
import { useStaking } from '@/hooks/useStaking'
import type { StakingPool, StakingPosition } from '@/types/defi'

export default function StakingPage() {
  const { isConnected } = useWallet()
  const { addToast } = useToast()
  const {
    pools,
    positions,
    accountConfig,
    isLoading,
    isExecuting,
    error,
    executorInstalled,
    stake,
    unstake,
    claimRewards,
    compoundRewards,
    refetch,
  } = useStaking()

  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakePool, setUnstakePool] = useState<Address | null>(null)
  const [unstakeAmount, setUnstakeAmount] = useState('')

  const handleStake = async () => {
    if (!selectedPool || !stakeAmount) return
    const amount = parseUnits(stakeAmount, selectedPool.stakingToken.decimals)
    const result = await stake(selectedPool.address, amount)
    if (result) {
      addToast({
        type: 'success',
        title: 'Staking Submitted',
        message: `Staking ${stakeAmount} ${selectedPool.stakingToken.symbol}`,
      })
      setStakeAmount('')
      setSelectedPool(null)
    }
  }

  const handleUnstake = async () => {
    if (!unstakePool || !unstakeAmount) return
    const position = positions.find((p) => p.pool === unstakePool)
    if (!position) return
    const amount = parseUnits(unstakeAmount, position.stakingToken.decimals)
    const result = await unstake(unstakePool, amount)
    if (result) {
      addToast({
        type: 'success',
        title: 'Unstake Submitted',
        message: `Unstaking ${unstakeAmount} ${position.stakingToken.symbol}`,
      })
      setUnstakeAmount('')
      setUnstakePool(null)
    }
  }

  const handleClaim = async (pool: Address) => {
    const result = await claimRewards(pool)
    if (result) {
      addToast({ type: 'success', title: 'Claim Submitted', message: 'Rewards claim initiated' })
    }
  }

  const handleCompound = async (pool: Address) => {
    const result = await compoundRewards(pool)
    if (result) {
      addToast({ type: 'success', title: 'Compound Submitted', message: 'Rewards compounding initiated' })
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to access staking
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/defi"
              className="text-sm transition-colors"
              style={{ color: 'rgb(var(--primary))' }}
            >
              DeFi
            </Link>
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>/</span>
            <span className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>Staking</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Staking
          </h1>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>
            Earn rewards by staking your tokens
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'rgb(var(--primary))' }}
        >
          Refresh
        </button>
      </div>

      {/* Module Not Installed Banner */}
      {!executorInstalled && !isLoading && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            borderColor: 'rgb(var(--warning) / 0.3)',
          }}
        >
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Staking Executor Not Installed
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            You need to install the Staking Executor module on your Smart Account to use staking
            features.{' '}
            <Link href="/marketplace" className="underline" style={{ color: 'rgb(var(--primary))' }}>
              Go to Marketplace
            </Link>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>{error}</p>
        </div>
      )}

      {/* Account Config */}
      {accountConfig && executorInstalled && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Daily Limit
                </p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatEther(accountConfig.dailyStakeLimit)} KRC
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Used Today
                </p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatEther(accountConfig.dailyUsed)} KRC
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Status
                </p>
                <p
                  className="font-semibold"
                  style={{
                    color: accountConfig.isPaused
                      ? 'rgb(var(--destructive))'
                      : 'rgb(var(--primary))',
                  }}
                >
                  {accountConfig.isPaused ? 'Paused' : 'Active'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Positions */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.map((position) => (
              <PositionCard
                key={position.pool}
                position={position}
                isExecuting={isExecuting}
                onClaim={() => handleClaim(position.pool)}
                onCompound={() => handleCompound(position.pool)}
                onUnstake={() => {
                  setUnstakePool(position.pool)
                  setUnstakeAmount('')
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unstake Modal */}
      {unstakePool && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Unstake</CardTitle>
              <button
                type="button"
                onClick={() => setUnstakePool(null)}
                className="text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Cancel
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const position = positions.find((p) => p.pool === unstakePool)
              if (!position) return null
              return (
                <>
                  <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Currently staked: {formatUnits(position.stakedAmount, position.stakingToken.decimals)}{' '}
                    {position.stakingToken.symbol}
                  </p>
                  <Input
                    label="Amount"
                    type="number"
                    placeholder="0.0"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUnstakeAmount(
                          formatUnits(position.stakedAmount, position.stakingToken.decimals)
                        )
                      }
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'rgb(var(--primary))' }}
                    >
                      MAX
                    </button>
                  </div>
                  <Button
                    onClick={handleUnstake}
                    isLoading={isExecuting}
                    disabled={!unstakeAmount || Number(unstakeAmount) <= 0}
                    className="w-full"
                  >
                    Unstake
                  </Button>
                </>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Available Pools */}
      <Card>
        <CardHeader>
          <CardTitle>Available Pools</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p
              className="text-center py-8 text-sm"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              Loading pools...
            </p>
          ) : (
            <div className="space-y-3">
              {pools.map((pool) => (
                <PoolCard
                  key={pool.address}
                  pool={pool}
                  isSelected={selectedPool?.address === pool.address}
                  onSelect={() =>
                    setSelectedPool(
                      selectedPool?.address === pool.address ? null : pool
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stake Form */}
      {selectedPool && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Stake {selectedPool.stakingToken.symbol}</CardTitle>
              <button
                type="button"
                onClick={() => setSelectedPool(null)}
                className="text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Cancel
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>APR</p>
                <p className="font-semibold" style={{ color: 'rgb(var(--primary))' }}>
                  {selectedPool.apr}%
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>TVL</p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatUnits(selectedPool.tvl, selectedPool.stakingToken.decimals)}{' '}
                  {selectedPool.stakingToken.symbol}
                </p>
              </div>
            </div>

            <Input
              label="Amount"
              type="number"
              placeholder="0.0"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />

            <div className="flex items-center justify-between text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <span>
                Min: {formatUnits(selectedPool.minStake, selectedPool.stakingToken.decimals)}{' '}
                {selectedPool.stakingToken.symbol}
              </span>
              <span>
                Max: {formatUnits(selectedPool.maxStake, selectedPool.stakingToken.decimals)}{' '}
                {selectedPool.stakingToken.symbol}
              </span>
            </div>

            <Button
              onClick={handleStake}
              isLoading={isExecuting}
              disabled={
                !stakeAmount ||
                Number(stakeAmount) <= 0 ||
                !executorInstalled
              }
              className="w-full"
            >
              {executorInstalled ? 'Stake' : 'Install Staking Module First'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function PositionCard({
  position,
  isExecuting,
  onClaim,
  onCompound,
  onUnstake,
}: {
  position: StakingPosition
  isExecuting: boolean
  onClaim: () => void
  onCompound: () => void
  onUnstake: () => void
}) {
  const hasRewards = position.rewardsEarned > 0n

  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {position.stakingToken.symbol} Staking
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Pool: {position.pool.slice(0, 10)}...
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {formatUnits(position.stakedAmount, position.stakingToken.decimals)}{' '}
            {position.stakingToken.symbol}
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>Staked</p>
        </div>
      </div>

      {hasRewards && (
        <div
          className="p-2 rounded-md mb-3"
          style={{ backgroundColor: 'rgb(var(--primary) / 0.05)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Pending Rewards
            </span>
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--primary))' }}>
              {formatUnits(position.rewardsEarned, position.rewardToken.decimals)}{' '}
              {position.rewardToken.symbol}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {hasRewards && (
          <>
            <button
              type="button"
              onClick={onClaim}
              disabled={isExecuting}
              className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors"
              style={{
                borderColor: 'rgb(var(--primary))',
                color: 'rgb(var(--primary))',
              }}
            >
              Claim
            </button>
            <button
              type="button"
              onClick={onCompound}
              disabled={isExecuting}
              className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors"
              style={{
                borderColor: 'rgb(var(--primary))',
                color: 'rgb(var(--primary))',
              }}
            >
              Compound
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onUnstake}
          disabled={isExecuting}
          className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors"
          style={{
            borderColor: 'rgb(var(--border))',
            color: 'rgb(var(--muted-foreground))',
          }}
        >
          Unstake
        </button>
      </div>
    </div>
  )
}

function PoolCard({
  pool,
  isSelected,
  onSelect,
}: {
  pool: StakingPool
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full p-4 rounded-lg border text-left transition-all"
      style={{
        borderColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
        backgroundColor: isSelected ? 'rgb(var(--primary) / 0.05)' : 'transparent',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {pool.stakingToken.symbol} Staking
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Rewards in {pool.rewardToken.symbol}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold" style={{ color: 'rgb(var(--primary))' }}>
            {pool.apr}% APR
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            TVL: {formatUnits(pool.tvl, pool.stakingToken.decimals)} {pool.stakingToken.symbol}
          </p>
        </div>
      </div>
    </button>
  )
}
