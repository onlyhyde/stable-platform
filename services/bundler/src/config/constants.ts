import type { Address } from 'viem'
import type { MempoolConfig, PriorityStrategy } from '../mempool/mempool'
import type { ReputationConfig } from '../validation/types'

/**
 * Environment variable names for bundler constants
 */
export const CONSTANTS_ENV_VARS = {
  // Validation Constants
  MIN_CALL_GAS_LIMIT: 'BUNDLER_MIN_CALL_GAS_LIMIT',
  MIN_VERIFICATION_GAS_LIMIT: 'BUNDLER_MIN_VERIFICATION_GAS_LIMIT',
  MIN_PRE_VERIFICATION_GAS: 'BUNDLER_MIN_PRE_VERIFICATION_GAS',
  MIN_SIGNATURE_LENGTH: 'BUNDLER_MIN_SIGNATURE_LENGTH',
  MAX_SIGNATURE_LENGTH: 'BUNDLER_MAX_SIGNATURE_LENGTH',
  MAX_CALLDATA_LENGTH: 'BUNDLER_MAX_CALLDATA_LENGTH',
  MAX_FACTORY_DATA_LENGTH: 'BUNDLER_MAX_FACTORY_DATA_LENGTH',
  MAX_PAYMASTER_DATA_LENGTH: 'BUNDLER_MAX_PAYMASTER_DATA_LENGTH',
  MAX_VERIFICATION_GAS: 'BUNDLER_MAX_VERIFICATION_GAS',
  MAX_BUNDLE_GAS: 'BUNDLER_MAX_BUNDLE_GAS',
  MIN_VALID_UNTIL_BUFFER: 'BUNDLER_MIN_VALID_UNTIL_BUFFER',
  MIN_MAX_FEE_PER_GAS: 'BUNDLER_MIN_MAX_FEE_PER_GAS',
  MIN_MAX_PRIORITY_FEE_PER_GAS: 'BUNDLER_MIN_MAX_PRIORITY_FEE_PER_GAS',

  // Reputation Config
  REP_MIN_INCLUSION_DENOMINATOR: 'BUNDLER_REP_MIN_INCLUSION_DENOMINATOR',
  REP_THROTTLING_SLACK: 'BUNDLER_REP_THROTTLING_SLACK',
  REP_BAN_SLACK: 'BUNDLER_REP_BAN_SLACK',
  REP_MIN_STAKE: 'BUNDLER_REP_MIN_STAKE',
  REP_MIN_UNSTAKE_DELAY: 'BUNDLER_REP_MIN_UNSTAKE_DELAY',
  REP_DECAY_INTERVAL_MS: 'BUNDLER_REP_DECAY_INTERVAL_MS',
  REP_DECAY_AMOUNT: 'BUNDLER_REP_DECAY_AMOUNT',
  REP_THROTTLE_AUTO_RELEASE_MS: 'BUNDLER_REP_THROTTLE_AUTO_RELEASE_MS',

  // Mempool Config
  MEMPOOL_MAX_SIZE: 'BUNDLER_MEMPOOL_MAX_SIZE',
  MEMPOOL_MAX_OPS_PER_SENDER: 'BUNDLER_MEMPOOL_MAX_OPS_PER_SENDER',
  MEMPOOL_TTL_MS: 'BUNDLER_MEMPOOL_TTL_MS',
  MEMPOOL_MIN_GAS_PRICE_INCREASE: 'BUNDLER_MEMPOOL_MIN_GAS_PRICE_INCREASE',
  MEMPOOL_EVICTION_INTERVAL_MS: 'BUNDLER_MEMPOOL_EVICTION_INTERVAL_MS',
  MEMPOOL_VALIDATE_NONCE_CONTINUITY: 'BUNDLER_MEMPOOL_VALIDATE_NONCE_CONTINUITY',
  MEMPOOL_MAX_NONCE_GAP: 'BUNDLER_MEMPOOL_MAX_NONCE_GAP',
  MEMPOOL_PRIORITY_STRATEGY: 'BUNDLER_MEMPOOL_PRIORITY_STRATEGY',
  MEMPOOL_AGE_WEIGHT_FACTOR: 'BUNDLER_MEMPOOL_AGE_WEIGHT_FACTOR',
  MEMPOOL_MAX_AGE_BOOST_MS: 'BUNDLER_MEMPOOL_MAX_AGE_BOOST_MS',

  // Aggregation
  ENABLE_AGGREGATION: 'BUNDLER_ENABLE_AGGREGATION',

  // Reputation Persistence
  REP_PERSISTENCE_ENABLED: 'BUNDLER_REP_PERSISTENCE_ENABLED',
  REP_PERSISTENCE_PATH: 'BUNDLER_REP_PERSISTENCE_PATH',
  REP_PERSISTENCE_INTERVAL_MS: 'BUNDLER_REP_PERSISTENCE_INTERVAL_MS',

  // Server Config
  BODY_LIMIT: 'BUNDLER_BODY_LIMIT',
  RATE_LIMIT_MAX: 'BUNDLER_RATE_LIMIT_MAX',
  RATE_LIMIT_WINDOW_MS: 'BUNDLER_RATE_LIMIT_WINDOW_MS',
  TX_TIMEOUT_MS: 'BUNDLER_TX_TIMEOUT_MS',
} as const

/**
 * Get environment variable as number
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * Get environment variable as bigint
 */
function getEnvBigInt(name: string, defaultValue: bigint): bigint {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  try {
    return BigInt(value)
  } catch {
    return defaultValue
  }
}

/**
 * Get environment variable as boolean
 */
function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  return value === 'true' || value === '1'
}

/**
 * Get environment variable as string
 */
function getEnvString<T extends string>(name: string, defaultValue: T): T {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  return value as T
}

/**
 * Default values for validation constants
 */
const VALIDATION_DEFAULTS = {
  MIN_CALL_GAS_LIMIT: 9000n,
  MIN_VERIFICATION_GAS_LIMIT: 10000n,
  MIN_PRE_VERIFICATION_GAS: 21000n,
  MIN_SIGNATURE_LENGTH: 132, // 65 bytes = 0x + 130 chars
  MAX_SIGNATURE_LENGTH: 4098, // 2KB = 0x + 4096 chars
  MAX_CALLDATA_LENGTH: 102402, // 50KB = 0x + 102400 chars
  MAX_FACTORY_DATA_LENGTH: 102402, // 50KB
  MAX_PAYMASTER_DATA_LENGTH: 20482, // 10KB = 0x + 20480 chars
  MAX_VERIFICATION_GAS: 1_000_000n,
  MAX_BUNDLE_GAS: 105_000_000n,
  MIN_VALID_UNTIL_BUFFER: 30n, // 30 seconds
  MIN_MAX_FEE_PER_GAS: 1_000_000_000n, // 1 gwei — configurable minimum gas price
  MIN_MAX_PRIORITY_FEE_PER_GAS: 0n, // no minimum by default
} as const

/**
 * Default values for reputation config
 */
const REPUTATION_DEFAULTS = {
  minInclusionDenominator: 10,
  throttlingSlack: 10,
  banSlack: 50,
  minStake: 100000000000000000n, // 0.1 ETH
  minUnstakeDelay: 86400, // 1 day in seconds
  decayIntervalMs: 0, // disabled
  decayAmount: 0, // disabled
  throttleAutoReleaseDurationMs: 0, // disabled
} as const

/**
 * Default values for mempool config
 */
const MEMPOOL_DEFAULTS = {
  maxSize: 10000,
  maxOpsPerSender: 4,
  ttlMs: 30 * 60 * 1000, // 30 minutes
  minGasPriceIncrease: 10, // 10%
  evictionIntervalMs: 60 * 1000, // 1 minute
  validateNonceContinuity: false,
  maxNonceGap: 0,
  priorityStrategy: 'gas_price' as PriorityStrategy,
  ageWeightFactor: 0,
  maxAgeBoostMs: 0,
} as const

/**
 * Default values for server config
 */
const SERVER_DEFAULTS = {
  bodyLimit: 1024 * 1024, // 1MB
  rateLimitMax: 100,
  rateLimitWindowMs: 60 * 1000, // 1 minute
  txTimeoutMs: 60000, // 60 seconds
} as const

/**
 * Get validation constants from environment or defaults
 */
export function getValidationConstants() {
  return {
    MIN_CALL_GAS_LIMIT: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_CALL_GAS_LIMIT,
      VALIDATION_DEFAULTS.MIN_CALL_GAS_LIMIT
    ),
    MIN_VERIFICATION_GAS_LIMIT: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_VERIFICATION_GAS_LIMIT,
      VALIDATION_DEFAULTS.MIN_VERIFICATION_GAS_LIMIT
    ),
    MIN_PRE_VERIFICATION_GAS: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_PRE_VERIFICATION_GAS,
      VALIDATION_DEFAULTS.MIN_PRE_VERIFICATION_GAS
    ),
    MIN_SIGNATURE_LENGTH: getEnvNumber(
      CONSTANTS_ENV_VARS.MIN_SIGNATURE_LENGTH,
      VALIDATION_DEFAULTS.MIN_SIGNATURE_LENGTH
    ),
    MAX_SIGNATURE_LENGTH: getEnvNumber(
      CONSTANTS_ENV_VARS.MAX_SIGNATURE_LENGTH,
      VALIDATION_DEFAULTS.MAX_SIGNATURE_LENGTH
    ),
    MAX_CALLDATA_LENGTH: getEnvNumber(
      CONSTANTS_ENV_VARS.MAX_CALLDATA_LENGTH,
      VALIDATION_DEFAULTS.MAX_CALLDATA_LENGTH
    ),
    MAX_FACTORY_DATA_LENGTH: getEnvNumber(
      CONSTANTS_ENV_VARS.MAX_FACTORY_DATA_LENGTH,
      VALIDATION_DEFAULTS.MAX_FACTORY_DATA_LENGTH
    ),
    MAX_PAYMASTER_DATA_LENGTH: getEnvNumber(
      CONSTANTS_ENV_VARS.MAX_PAYMASTER_DATA_LENGTH,
      VALIDATION_DEFAULTS.MAX_PAYMASTER_DATA_LENGTH
    ),
    MAX_VERIFICATION_GAS: getEnvBigInt(
      CONSTANTS_ENV_VARS.MAX_VERIFICATION_GAS,
      VALIDATION_DEFAULTS.MAX_VERIFICATION_GAS
    ),
    MAX_BUNDLE_GAS: getEnvBigInt(
      CONSTANTS_ENV_VARS.MAX_BUNDLE_GAS,
      VALIDATION_DEFAULTS.MAX_BUNDLE_GAS
    ),
    MIN_VALID_UNTIL_BUFFER: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_VALID_UNTIL_BUFFER,
      VALIDATION_DEFAULTS.MIN_VALID_UNTIL_BUFFER
    ),
    MIN_MAX_FEE_PER_GAS: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_MAX_FEE_PER_GAS,
      VALIDATION_DEFAULTS.MIN_MAX_FEE_PER_GAS
    ),
    MIN_MAX_PRIORITY_FEE_PER_GAS: getEnvBigInt(
      CONSTANTS_ENV_VARS.MIN_MAX_PRIORITY_FEE_PER_GAS,
      VALIDATION_DEFAULTS.MIN_MAX_PRIORITY_FEE_PER_GAS
    ),
    // Static constants (not configurable)
    SIG_VALIDATION_SUCCESS: '0x0000000000000000000000000000000000000000' as Address,
    SIG_VALIDATION_FAILED: '0x0000000000000000000000000000000000000001' as Address,
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000' as Address,
  } as const
}

/**
 * Get reputation config from environment or defaults
 */
export function getReputationConfig(): ReputationConfig {
  return {
    minInclusionDenominator: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_MIN_INCLUSION_DENOMINATOR,
      REPUTATION_DEFAULTS.minInclusionDenominator
    ),
    throttlingSlack: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_THROTTLING_SLACK,
      REPUTATION_DEFAULTS.throttlingSlack
    ),
    banSlack: getEnvNumber(CONSTANTS_ENV_VARS.REP_BAN_SLACK, REPUTATION_DEFAULTS.banSlack),
    minStake: getEnvBigInt(CONSTANTS_ENV_VARS.REP_MIN_STAKE, REPUTATION_DEFAULTS.minStake),
    minUnstakeDelay: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_MIN_UNSTAKE_DELAY,
      REPUTATION_DEFAULTS.minUnstakeDelay
    ),
    decayIntervalMs: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_DECAY_INTERVAL_MS,
      REPUTATION_DEFAULTS.decayIntervalMs
    ),
    decayAmount: getEnvNumber(CONSTANTS_ENV_VARS.REP_DECAY_AMOUNT, REPUTATION_DEFAULTS.decayAmount),
    throttleAutoReleaseDurationMs: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_THROTTLE_AUTO_RELEASE_MS,
      REPUTATION_DEFAULTS.throttleAutoReleaseDurationMs
    ),
  }
}

/**
 * Get mempool config from environment or defaults
 */
export function getMempoolConfig(): Required<MempoolConfig> {
  return {
    maxSize: getEnvNumber(CONSTANTS_ENV_VARS.MEMPOOL_MAX_SIZE, MEMPOOL_DEFAULTS.maxSize),
    maxOpsPerSender: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_MAX_OPS_PER_SENDER,
      MEMPOOL_DEFAULTS.maxOpsPerSender
    ),
    ttlMs: getEnvNumber(CONSTANTS_ENV_VARS.MEMPOOL_TTL_MS, MEMPOOL_DEFAULTS.ttlMs),
    minGasPriceIncrease: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_MIN_GAS_PRICE_INCREASE,
      MEMPOOL_DEFAULTS.minGasPriceIncrease
    ),
    evictionIntervalMs: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_EVICTION_INTERVAL_MS,
      MEMPOOL_DEFAULTS.evictionIntervalMs
    ),
    validateNonceContinuity: getEnvBool(
      CONSTANTS_ENV_VARS.MEMPOOL_VALIDATE_NONCE_CONTINUITY,
      MEMPOOL_DEFAULTS.validateNonceContinuity
    ),
    maxNonceGap: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_MAX_NONCE_GAP,
      MEMPOOL_DEFAULTS.maxNonceGap
    ),
    priorityStrategy: getEnvString<PriorityStrategy>(
      CONSTANTS_ENV_VARS.MEMPOOL_PRIORITY_STRATEGY,
      MEMPOOL_DEFAULTS.priorityStrategy
    ),
    ageWeightFactor: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_AGE_WEIGHT_FACTOR,
      MEMPOOL_DEFAULTS.ageWeightFactor
    ),
    maxAgeBoostMs: getEnvNumber(
      CONSTANTS_ENV_VARS.MEMPOOL_MAX_AGE_BOOST_MS,
      MEMPOOL_DEFAULTS.maxAgeBoostMs
    ),
  }
}

/**
 * Reputation persistence configuration
 */
export interface ReputationPersistenceConfig {
  enabled: boolean
  filePath: string
  saveIntervalMs: number
}

/**
 * Default values for reputation persistence
 */
const PERSISTENCE_DEFAULTS = {
  enabled: true,
  filePath: './data/reputation.json',
  saveIntervalMs: 60_000, // 60 seconds
} as const

/**
 * Get reputation persistence config from environment or defaults
 */
export function getReputationPersistenceConfig(): ReputationPersistenceConfig {
  return {
    enabled: getEnvBool(CONSTANTS_ENV_VARS.REP_PERSISTENCE_ENABLED, PERSISTENCE_DEFAULTS.enabled),
    filePath: getEnvString(CONSTANTS_ENV_VARS.REP_PERSISTENCE_PATH, PERSISTENCE_DEFAULTS.filePath),
    saveIntervalMs: getEnvNumber(
      CONSTANTS_ENV_VARS.REP_PERSISTENCE_INTERVAL_MS,
      PERSISTENCE_DEFAULTS.saveIntervalMs
    ),
  }
}

/**
 * Get server config from environment or defaults
 */
export function getServerConfig() {
  return {
    bodyLimit: getEnvNumber(CONSTANTS_ENV_VARS.BODY_LIMIT, SERVER_DEFAULTS.bodyLimit),
    rateLimitMax: getEnvNumber(CONSTANTS_ENV_VARS.RATE_LIMIT_MAX, SERVER_DEFAULTS.rateLimitMax),
    rateLimitWindowMs: getEnvNumber(
      CONSTANTS_ENV_VARS.RATE_LIMIT_WINDOW_MS,
      SERVER_DEFAULTS.rateLimitWindowMs
    ),
    txTimeoutMs: getEnvNumber(CONSTANTS_ENV_VARS.TX_TIMEOUT_MS, SERVER_DEFAULTS.txTimeoutMs),
  }
}

/**
 * Print environment variable usage help for constants
 */
export function getConstantsEnvHelp(): string {
  return `
Bundler Constants Environment Variables:

Validation Limits:
  ${CONSTANTS_ENV_VARS.MIN_CALL_GAS_LIMIT}              Min callGasLimit (default: 9000)
  ${CONSTANTS_ENV_VARS.MIN_VERIFICATION_GAS_LIMIT}     Min verificationGasLimit (default: 10000)
  ${CONSTANTS_ENV_VARS.MIN_PRE_VERIFICATION_GAS}       Min preVerificationGas (default: 21000)
  ${CONSTANTS_ENV_VARS.MIN_SIGNATURE_LENGTH}           Min signature length in hex chars (default: 132)
  ${CONSTANTS_ENV_VARS.MAX_SIGNATURE_LENGTH}           Max signature length in hex chars (default: 4098)
  ${CONSTANTS_ENV_VARS.MAX_CALLDATA_LENGTH}            Max callData length in hex chars (default: 102402)
  ${CONSTANTS_ENV_VARS.MAX_FACTORY_DATA_LENGTH}        Max factoryData length in hex chars (default: 102402)
  ${CONSTANTS_ENV_VARS.MAX_PAYMASTER_DATA_LENGTH}      Max paymasterData length in hex chars (default: 20482)
  ${CONSTANTS_ENV_VARS.MAX_VERIFICATION_GAS}           Max verification gas per op (default: 1000000)
  ${CONSTANTS_ENV_VARS.MAX_BUNDLE_GAS}                 Max gas per bundle (default: 105000000)
  ${CONSTANTS_ENV_VARS.MIN_VALID_UNTIL_BUFFER}         Min seconds before validUntil (default: 30)
  ${CONSTANTS_ENV_VARS.MIN_MAX_FEE_PER_GAS}            Min maxFeePerGas in wei (default: 1000000000 = 1 gwei)
  ${CONSTANTS_ENV_VARS.MIN_MAX_PRIORITY_FEE_PER_GAS}   Min maxPriorityFeePerGas in wei (default: 0 = no minimum)

Reputation System:
  ${CONSTANTS_ENV_VARS.REP_MIN_INCLUSION_DENOMINATOR}  Min inclusion ratio denominator (default: 10)
  ${CONSTANTS_ENV_VARS.REP_THROTTLING_SLACK}           Slack before throttling (default: 10)
  ${CONSTANTS_ENV_VARS.REP_BAN_SLACK}                  Additional slack before banning (default: 50)
  ${CONSTANTS_ENV_VARS.REP_MIN_STAKE}                  Min stake in wei (default: 100000000000000000 = 0.1 ETH)
  ${CONSTANTS_ENV_VARS.REP_MIN_UNSTAKE_DELAY}          Min unstake delay in seconds (default: 86400 = 1 day)
  ${CONSTANTS_ENV_VARS.REP_DECAY_INTERVAL_MS}          Decay interval in ms (default: 0 = disabled)
  ${CONSTANTS_ENV_VARS.REP_DECAY_AMOUNT}               Decay amount per interval (default: 0)
  ${CONSTANTS_ENV_VARS.REP_THROTTLE_AUTO_RELEASE_MS}   Throttle auto-release duration in ms (default: 0 = disabled)

Reputation Persistence:
  ${CONSTANTS_ENV_VARS.REP_PERSISTENCE_ENABLED}           Enable reputation persistence (default: true)
  ${CONSTANTS_ENV_VARS.REP_PERSISTENCE_PATH}              File path for reputation data (default: ./data/reputation.json)
  ${CONSTANTS_ENV_VARS.REP_PERSISTENCE_INTERVAL_MS}       Save interval in ms (default: 60000)

Mempool:
  ${CONSTANTS_ENV_VARS.MEMPOOL_MAX_SIZE}               Max UserOps in mempool (default: 10000)
  ${CONSTANTS_ENV_VARS.MEMPOOL_MAX_OPS_PER_SENDER}     Max pending ops per sender (default: 4)
  ${CONSTANTS_ENV_VARS.MEMPOOL_TTL_MS}                 TTL for pending ops in ms (default: 1800000 = 30 min)
  ${CONSTANTS_ENV_VARS.MEMPOOL_MIN_GAS_PRICE_INCREASE} Min gas price increase % for replacement (default: 10)
  ${CONSTANTS_ENV_VARS.MEMPOOL_EVICTION_INTERVAL_MS}   Eviction interval in ms (default: 60000)
  ${CONSTANTS_ENV_VARS.MEMPOOL_VALIDATE_NONCE_CONTINUITY} Enable nonce continuity validation (default: false)
  ${CONSTANTS_ENV_VARS.MEMPOOL_MAX_NONCE_GAP}          Max allowed nonce gap (default: 0)
  ${CONSTANTS_ENV_VARS.MEMPOOL_PRIORITY_STRATEGY}      Priority strategy: gas_price|priority_fee|profit|fifo|age_weighted (default: gas_price)
  ${CONSTANTS_ENV_VARS.MEMPOOL_AGE_WEIGHT_FACTOR}      Age weight factor for age_weighted strategy (default: 0)
  ${CONSTANTS_ENV_VARS.MEMPOOL_MAX_AGE_BOOST_MS}       Max age boost in ms (default: 0 = unlimited)

Server:
  ${CONSTANTS_ENV_VARS.BODY_LIMIT}                     Max request body size in bytes (default: 1048576 = 1MB)
  ${CONSTANTS_ENV_VARS.RATE_LIMIT_MAX}                 Max requests per window (default: 100)
  ${CONSTANTS_ENV_VARS.RATE_LIMIT_WINDOW_MS}           Rate limit window in ms (default: 60000 = 1 min)
  ${CONSTANTS_ENV_VARS.TX_TIMEOUT_MS}                  Transaction timeout in ms (default: 60000)
`.trim()
}
