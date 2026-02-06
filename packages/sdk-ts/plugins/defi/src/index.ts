/**
 * @stablenet/plugin-defi
 * StableNet SDK - DeFi Plugin for Executors and Hooks
 */

// ============================================================================
// ABIs
// ============================================================================
export {
  SwapExecutorAbi,
  LendingExecutorAbi,
  StakingExecutorAbi,
  HealthFactorHookAbi,
  MerchantRegistryAbi,
} from './abis'

// ============================================================================
// Permit2 (Token Approvals)
// ============================================================================
export {
  // Constants
  PERMIT2_ADDRESSES,
  PERMIT2_TYPE_HASHES,
  MAX_UINT160,
  MAX_UINT48,
  DEFAULT_PERMIT_EXPIRATION,
  PERMIT2_ABI,
  // Types
  PERMIT_SINGLE_TYPES,
  PERMIT_BATCH_TYPES,
  PERMIT_TRANSFER_FROM_TYPES,
  PERMIT_BATCH_TRANSFER_FROM_TYPES,
  // Functions
  getPermit2Domain,
  createPermitDetails,
  createPermitSingle,
  createPermitBatch,
  createPermitTransferFrom,
  getPermitSingleTypedData,
  getPermitBatchTypedData,
  getPermitTransferFromTypedData,
  encodePermitSingle,
  encodePermitBatch,
  encodeTransferFrom,
  encodeSignatureTransferFrom,
  // Type exports
  type PermitDetails,
  type PermitSingle,
  type PermitBatch,
  type TokenPermissions,
  type PermitTransferFrom,
  type PermitBatchTransferFrom,
  type SignatureTransferDetails,
  type Allowance,
} from './permit2'

// ============================================================================
// Types
// ============================================================================
export type {
  // Common
  ModuleType,
  ModuleConfig,
  DefiPluginConfig,
  TransactionRequest,
  ModuleInstallation,

  // SwapExecutor
  SwapAccountConfig,
  SwapTokenConfig,
  SwapParams,
  SwapExecutorInitData,

  // LendingExecutor
  LendingAccountConfig,
  LendingAssetConfig,
  LendingPoolConfig,
  LendingExecutorInitData,
  SupplyParams,
  WithdrawParams,
  BorrowParams,
  RepayParams,

  // StakingExecutor
  StakingAccountConfig,
  StakingPoolInfo,
  StakingExecutorInitData,
  StakeParams,
  UnstakeParams,
  ClaimRewardsParams,
  CompoundRewardsParams,

  // HealthFactorHook
  HealthFactorAccountConfig,
  HealthFactorHookInitData,
  HealthFactorCheckResult,

  // MerchantRegistry
  Merchant,
  MerchantRegistration,
  MerchantStats,

  // Events
  SwapExecutedEvent,
  SuppliedEvent,
  WithdrawnEvent,
  BorrowedEvent,
  RepaidEvent,
  StakedEvent,
  UnstakedEvent,
  RewardsClaimedEvent,
  RewardsCompoundedEvent,
  MerchantRegisteredEvent,
  MerchantVerifiedEvent,
  MerchantSuspendedEvent,
} from './types'

// Enums and Classes need value export
export { LendingPoolType } from './types'
export {
  DefiPluginError,
  SwapExecutorError,
  LendingExecutorError,
  StakingExecutorError,
  HealthFactorHookError,
  MerchantRegistryError,
} from './types'

// ============================================================================
// Constants
// ============================================================================

/** ERC-7579 Module Types */
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
} as const

/** Default configuration values */
export const DEFAULTS = {
  /** Default max slippage: 1% (100 basis points) */
  MAX_SLIPPAGE_BPS: 100,
  /** Default daily limit: 10 ETH */
  DAILY_LIMIT: BigInt('10000000000000000000'),
  /** Default max LTV: 80% (8000 basis points) */
  MAX_LTV: 8000,
  /** Default min health factor: 1.2 (1.2e18) */
  MIN_HEALTH_FACTOR: BigInt('1200000000000000000'),
  /** Default merchant fee: 2.5% (250 basis points) */
  DEFAULT_MERCHANT_FEE_BPS: 250,
  /** Max merchant fee: 10% (1000 basis points) */
  MAX_MERCHANT_FEE_BPS: 1000,
} as const

/** Scale factors for calculations */
export const SCALE = {
  /** Basis points scale: 10000 = 100% */
  BPS: 10000,
  /** 18 decimal precision */
  WAD: BigInt('1000000000000000000'),
  /** 27 decimal precision (used in some DeFi protocols) */
  RAY: BigInt('1000000000000000000000000000'),
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate health factor from collateral value, debt value, and liquidation threshold
 * @param collateralValue - Total collateral value in base currency
 * @param debtValue - Total debt value in base currency
 * @param liquidationThreshold - Liquidation threshold in basis points (e.g., 8000 = 80%)
 * @returns Health factor scaled by 1e18
 */
export function calculateHealthFactor(
  collateralValue: bigint,
  debtValue: bigint,
  liquidationThreshold: number
): bigint {
  if (debtValue === 0n) {
    return BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935') // type(uint256).max
  }

  // HF = (collateralValue * liquidationThreshold) / (debtValue * BPS)
  return (collateralValue * BigInt(liquidationThreshold) * SCALE.WAD) / (debtValue * BigInt(SCALE.BPS))
}

/**
 * Check if a position is liquidatable
 * @param healthFactor - Current health factor scaled by 1e18
 * @returns True if health factor < 1.0 (liquidatable)
 */
export function isLiquidatable(healthFactor: bigint): boolean {
  return healthFactor < SCALE.WAD
}

/**
 * Calculate slippage amount
 * @param amount - Input amount
 * @param slippageBps - Slippage in basis points
 * @returns Minimum output amount after slippage
 */
export function calculateMinOutput(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(SCALE.BPS - slippageBps)) / BigInt(SCALE.BPS)
}

/**
 * Calculate fee amount
 * @param amount - Base amount
 * @param feeBps - Fee in basis points
 * @returns Fee amount
 */
export function calculateFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / BigInt(SCALE.BPS)
}

/**
 * Encode module init data for SwapExecutor
 */
export function encodeSwapExecutorInitData(config: {
  maxSlippageBps: number
  dailyLimit: bigint
}): `0x${string}` {
  // ABI encode: (uint256 maxSlippageBps, uint256 dailyLimit)
  const maxSlippageHex = config.maxSlippageBps.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyLimit.toString(16).padStart(64, '0')
  return `0x${maxSlippageHex}${dailyLimitHex}`
}

/**
 * Encode module init data for LendingExecutor
 */
export function encodeLendingExecutorInitData(config: {
  maxLtv: number
  minHealthFactor: bigint
  dailyBorrowLimit: bigint
}): `0x${string}` {
  // ABI encode: (uint256 maxLtv, uint256 minHealthFactor, uint256 dailyBorrowLimit)
  const maxLtvHex = config.maxLtv.toString(16).padStart(64, '0')
  const minHfHex = config.minHealthFactor.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyBorrowLimit.toString(16).padStart(64, '0')
  return `0x${maxLtvHex}${minHfHex}${dailyLimitHex}`
}

/**
 * Encode module init data for StakingExecutor
 */
export function encodeStakingExecutorInitData(config: {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
}): `0x${string}` {
  // ABI encode: (uint256 maxStakePerPool, uint256 dailyStakeLimit)
  const maxStakeHex = config.maxStakePerPool.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyStakeLimit.toString(16).padStart(64, '0')
  return `0x${maxStakeHex}${dailyLimitHex}`
}

/**
 * Encode module init data for HealthFactorHook
 */
export function encodeHealthFactorHookInitData(config: {
  minHealthFactor: bigint
}): `0x${string}` {
  // ABI encode: (uint256 minHealthFactor)
  const minHfHex = config.minHealthFactor.toString(16).padStart(64, '0')
  return `0x${minHfHex}`
}
