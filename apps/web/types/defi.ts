import type { Address } from 'viem'
import type { Token } from './index'

// ============================================================================
// Staking Types
// ============================================================================

export interface StakingPool {
  address: Address
  stakingToken: Token
  rewardToken: Token
  minStake: bigint
  maxStake: bigint
  apr: number
  tvl: bigint
  isRegistered: boolean
}

export interface StakingPosition {
  pool: Address
  stakedAmount: bigint
  rewardsEarned: bigint
  stakingToken: Token
  rewardToken: Token
  stakedAt: number
}

export interface StakingAccountConfig {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
  dailyUsed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}

// ============================================================================
// Lending Types
// ============================================================================

export type LendingPoolType = 'AAVE_V3' | 'COMPOUND_V3' | 'MORPHO'

export interface LendingMarket {
  asset: Token
  supplyAPY: number
  borrowAPY: number
  totalSupply: bigint
  totalBorrow: bigint
  availableLiquidity: bigint
  utilizationRate: number
}

export interface LendingPosition {
  asset: Token
  suppliedAmount: bigint
  borrowedAmount: bigint
  supplyAPY: number
  borrowAPY: number
}

export interface LendingAccountConfig {
  minHealthFactor: bigint
  maxBorrowLimit: bigint
  totalBorrowed: bigint
  isActive: boolean
}

export interface HealthFactorInfo {
  value: bigint
  isEnabled: boolean
  isInitialized: boolean
}
