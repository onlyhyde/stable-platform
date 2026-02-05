/**
 * @stablenet/plugin-defi - TypeScript Types
 * Types for DeFi executors and hooks
 */

import type { Address, Hex } from 'viem'

// ============================================================================
// Common Types
// ============================================================================

export type ModuleType = 1 | 2 | 3 | 4 // Validator, Executor, Fallback, Hook

export interface ModuleConfig {
  moduleAddress: Address
  initData: Hex
}

// ============================================================================
// SwapExecutor Types
// ============================================================================

export interface SwapAccountConfig {
  maxSlippageBps: number // basis points (100 = 1%)
  dailyLimit: bigint
  dailyUsed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}

export interface SwapTokenConfig {
  isWhitelisted: boolean
  minAmount: bigint
  maxAmount: bigint
}

export interface SwapParams {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  minAmountOut: bigint
  router: Address
  deadline: bigint
}

export interface SwapExecutorInitData {
  maxSlippageBps: number
  dailyLimit: bigint
}

// ============================================================================
// LendingExecutor Types
// ============================================================================

export interface LendingAccountConfig {
  maxLtv: number // basis points (8000 = 80%)
  minHealthFactor: bigint // scaled by 1e18
  dailyBorrowLimit: bigint
  dailyBorrowed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}

export interface LendingAssetConfig {
  isSupported: boolean
  maxSupplyAmount: bigint
  maxBorrowAmount: bigint
}

export interface LendingPoolConfig {
  isWhitelisted: boolean
  poolType: LendingPoolType
}

export enum LendingPoolType {
  UNKNOWN = 0,
  AAVE_V3 = 1,
  COMPOUND_V3 = 2,
  MORPHO = 3,
}

export interface LendingExecutorInitData {
  maxLtv: number
  minHealthFactor: bigint
  dailyBorrowLimit: bigint
}

export interface SupplyParams {
  pool: Address
  asset: Address
  amount: bigint
}

export interface WithdrawParams {
  pool: Address
  asset: Address
  amount: bigint
}

export interface BorrowParams {
  pool: Address
  asset: Address
  amount: bigint
}

export interface RepayParams {
  pool: Address
  asset: Address
  amount: bigint
}

// ============================================================================
// StakingExecutor Types
// ============================================================================

export interface StakingAccountConfig {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
  dailyUsed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}

export interface StakingPoolInfo {
  isRegistered: boolean
  stakingToken: Address
  rewardToken: Address
  minStake: bigint
  maxStake: bigint
}

export interface StakingExecutorInitData {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
}

export interface StakeParams {
  pool: Address
  amount: bigint
}

export interface UnstakeParams {
  pool: Address
  amount: bigint
}

export interface ClaimRewardsParams {
  pool: Address
}

export interface CompoundRewardsParams {
  pool: Address
}

// ============================================================================
// HealthFactorHook Types
// ============================================================================

export interface HealthFactorAccountConfig {
  minHealthFactor: bigint // scaled by 1e18 (1.2e18 = 1.2)
  enabled: boolean
  initialized: boolean
}

export interface HealthFactorHookInitData {
  minHealthFactor: bigint
  monitoredTargets: Address[]
}

export interface HealthFactorCheckResult {
  preHealthFactor: bigint
  postHealthFactor: bigint
  isValid: boolean
}

// ============================================================================
// MerchantRegistry Types
// ============================================================================

export interface Merchant {
  name: string
  website: string
  email: string
  isRegistered: boolean
  isVerified: boolean
  isSuspended: boolean
  registeredAt: bigint
  verifiedAt: bigint
  verifiedBy: Address
  customFeeBps: number
}

export interface MerchantRegistration {
  name: string
  website: string
  email: string
}

export interface MerchantStats {
  totalMerchants: number
  verifiedMerchants: number
  suspendedMerchants: number
}

// ============================================================================
// SDK Client Types
// ============================================================================

export interface DefiPluginConfig {
  swapExecutor?: Address
  lendingExecutor?: Address
  stakingExecutor?: Address
  healthFactorHook?: Address
  merchantRegistry?: Address
}

export interface TransactionRequest {
  to: Address
  data: Hex
  value?: bigint
}

export interface ModuleInstallation {
  moduleType: ModuleType
  moduleAddress: Address
  initData: Hex
}

// ============================================================================
// Event Types
// ============================================================================

// SwapExecutor Events
export interface SwapExecutedEvent {
  account: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOut: bigint
}

// LendingExecutor Events
export interface SuppliedEvent {
  account: Address
  pool: Address
  asset: Address
  amount: bigint
}

export interface WithdrawnEvent {
  account: Address
  pool: Address
  asset: Address
  amount: bigint
}

export interface BorrowedEvent {
  account: Address
  pool: Address
  asset: Address
  amount: bigint
}

export interface RepaidEvent {
  account: Address
  pool: Address
  asset: Address
  amount: bigint
}

// StakingExecutor Events
export interface StakedEvent {
  account: Address
  pool: Address
  amount: bigint
}

export interface UnstakedEvent {
  account: Address
  pool: Address
  amount: bigint
}

export interface RewardsClaimedEvent {
  account: Address
  pool: Address
  amount: bigint
}

export interface RewardsCompoundedEvent {
  account: Address
  pool: Address
  amount: bigint
}

// MerchantRegistry Events
export interface MerchantRegisteredEvent {
  merchant: Address
  name: string
  website: string
}

export interface MerchantVerifiedEvent {
  merchant: Address
  verifier: Address
}

export interface MerchantSuspendedEvent {
  merchant: Address
  reason: string
}

// ============================================================================
// Error Types
// ============================================================================

export class DefiPluginError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'DefiPluginError'
  }
}

export class SwapExecutorError extends DefiPluginError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'SwapExecutorError'
  }
}

export class LendingExecutorError extends DefiPluginError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'LendingExecutorError'
  }
}

export class StakingExecutorError extends DefiPluginError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'StakingExecutorError'
  }
}

export class HealthFactorHookError extends DefiPluginError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'HealthFactorHookError'
  }
}

export class MerchantRegistryError extends DefiPluginError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'MerchantRegistryError'
  }
}
