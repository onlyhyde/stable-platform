import type { Address, Hex } from 'viem'

/**
 * Validation phases for tracking where validation failed
 */
export type ValidationPhase = 'format' | 'reputation' | 'state' | 'simulation' | 'preflight'

/**
 * Return info from simulation
 */
export interface ReturnInfo {
  preOpGas: bigint
  prefund: bigint
  accountValidationData: bigint
  paymasterValidationData: bigint
  paymasterContext: Hex
}

/**
 * Stake info for an entity (sender, factory, paymaster)
 */
export interface StakeInfo {
  stake: bigint
  unstakeDelaySec: bigint
}

/**
 * Full validation result from simulateValidation
 */
export interface ValidationResult {
  returnInfo: ReturnInfo
  senderInfo: StakeInfo
  factoryInfo: StakeInfo
  paymasterInfo: StakeInfo
  /** Aggregator address if detected during validation (EIP-4337 Section 15) */
  aggregator?: Address
}

/**
 * Aggregator info for aggregated signatures
 */
export interface AggregatorInfo {
  aggregator: Address
  stakeInfo: StakeInfo
}

/**
 * Validation result with aggregator (for signature aggregation)
 */
export interface ValidationResultWithAggregation extends ValidationResult {
  aggregatorInfo: AggregatorInfo
}

/**
 * Deposit info for an account
 */
export interface DepositInfo {
  deposit: bigint
  staked: boolean
  stake: bigint
  unstakeDelaySec: number
  withdrawTime: number
}

/**
 * Reputation status for an entity
 */
export type ReputationStatus = 'ok' | 'throttled' | 'banned'

/**
 * Reputation entry for tracking entity behavior
 */
export interface ReputationEntry {
  address: Address
  opsSeen: number
  opsIncluded: number
  status: ReputationStatus
  lastUpdated: number
}

/**
 * Reputation configuration
 */
export interface ReputationConfig {
  /** Minimum ratio of included to seen ops (default: 10) */
  minInclusionDenominator: number
  /** Slack before throttling (default: 10) */
  throttlingSlack: number
  /** Additional slack before banning (default: 50) */
  banSlack: number
  /** Minimum stake required (default: 0.1 ETH) */
  minStake: bigint
  /** Minimum unstake delay in seconds (default: 86400 = 1 day) */
  minUnstakeDelay: number
  /** Time interval for opsSeen decay in milliseconds (default: 0 = disabled) */
  decayIntervalMs: number
  /** Amount to decay opsSeen per interval (default: 0) */
  decayAmount: number
  /** Duration before throttle auto-releases in milliseconds (default: 0 = disabled) */
  throttleAutoReleaseDurationMs: number
}

/**
 * Parsed validation data (from accountValidationData or paymasterValidationData)
 */
export interface ParsedValidationData {
  aggregator: Address
  validAfter: bigint
  validUntil: bigint
}

/**
 * Validation error details
 */
export interface ValidationErrorDetails {
  phase: ValidationPhase
  entity?: 'account' | 'paymaster' | 'factory' | 'aggregator'
  reason: string
  inner?: Hex
}

/**
 * Execution result from simulateHandleOp
 */
export interface ExecutionResult {
  preOpGas: bigint
  paid: bigint
  accountValidationData: bigint
  paymasterValidationData: bigint
  targetSuccess: boolean
  targetResult: Hex
}

/**
 * UserOperation event data from logs
 */
export interface UserOperationEventData {
  userOpHash: Hex
  sender: Address
  paymaster: Address
  nonce: bigint
  success: boolean
  actualGasCost: bigint
  actualGasUsed: bigint
}

/**
 * Account deployed event data
 */
export interface AccountDeployedEventData {
  userOpHash: Hex
  sender: Address
  factory: Address
  paymaster: Address
}

/**
 * UserOperation revert reason event data
 */
export interface UserOperationRevertReasonData {
  userOpHash: Hex
  sender: Address
  nonce: bigint
  revertReason: Hex
}

/**
 * Get validation constants from environment or defaults
 * Import from config module for environment-aware configuration
 */
import { getValidationConstants } from '../config/constants'

/**
 * Constants for validation (configurable via environment variables)
 *
 * Environment variables:
 * - BUNDLER_MIN_CALL_GAS_LIMIT: Min callGasLimit (default: 9000)
 * - BUNDLER_MIN_VERIFICATION_GAS_LIMIT: Min verificationGasLimit (default: 10000)
 * - BUNDLER_MIN_PRE_VERIFICATION_GAS: Min preVerificationGas (default: 21000)
 * - BUNDLER_MIN_SIGNATURE_LENGTH: Min signature length in hex chars (default: 132)
 * - BUNDLER_MAX_SIGNATURE_LENGTH: Max signature length in hex chars (default: 4098)
 * - BUNDLER_MAX_CALLDATA_LENGTH: Max callData length in hex chars (default: 102402)
 * - BUNDLER_MAX_FACTORY_DATA_LENGTH: Max factoryData length in hex chars (default: 102402)
 * - BUNDLER_MAX_PAYMASTER_DATA_LENGTH: Max paymasterData length in hex chars (default: 20482)
 * - BUNDLER_MAX_VERIFICATION_GAS: Max verification gas per op (default: 500000)
 * - BUNDLER_MAX_BUNDLE_GAS: Max gas per bundle (default: 30000000)
 * - BUNDLER_MIN_VALID_UNTIL_BUFFER: Min seconds before validUntil (default: 30)
 */
export const VALIDATION_CONSTANTS = getValidationConstants()

/**
 * Get default reputation configuration from environment or defaults
 * Import from config module for environment-aware configuration
 */
import { getReputationConfig } from '../config/constants'

/**
 * Default reputation configuration (configurable via environment variables)
 *
 * Environment variables:
 * - BUNDLER_REP_MIN_INCLUSION_DENOMINATOR: Min inclusion ratio denominator (default: 10)
 * - BUNDLER_REP_THROTTLING_SLACK: Slack before throttling (default: 10)
 * - BUNDLER_REP_BAN_SLACK: Additional slack before banning (default: 50)
 * - BUNDLER_REP_MIN_STAKE: Min stake in wei (default: 0.1 ETH)
 * - BUNDLER_REP_MIN_UNSTAKE_DELAY: Min unstake delay in seconds (default: 86400 = 1 day)
 * - BUNDLER_REP_DECAY_INTERVAL_MS: Decay interval in ms (default: 0 = disabled)
 * - BUNDLER_REP_DECAY_AMOUNT: Decay amount per interval (default: 0)
 * - BUNDLER_REP_THROTTLE_AUTO_RELEASE_MS: Throttle auto-release duration in ms (default: 0 = disabled)
 */
export const DEFAULT_REPUTATION_CONFIG: ReputationConfig = getReputationConfig()

// ============================================================================
// Validator Interfaces (for Dependency Injection)
// ============================================================================

/**
 * Interface for format validation
 */
export interface IFormatValidator {
  validate(userOp: unknown): void
  validateSignatureFormat(signature: Hex): boolean
  validateAddressFormat(address: string): address is Address
  validateHexFormat(hex: string): hex is Hex
}

/**
 * Interface for simulation validation
 */
export interface ISimulationValidator {
  simulate(userOp: unknown): Promise<ValidationResult>
  simulateExecution(
    userOp: unknown,
    target?: Address,
    targetCallData?: Hex
  ): Promise<ExecutionResult>
  validateTimestamps(accountValidationData: bigint, paymasterValidationData?: bigint): void
  validateSignature(accountValidationData: bigint, paymasterValidationData?: bigint): void
  validateAggregator(accountValidationData: bigint): Address | null
  validateStakeInfo(
    stakeInfo: StakeInfo,
    entityType: 'sender' | 'factory' | 'paymaster',
    minStake: bigint,
    minUnstakeDelay: number
  ): void
  getNonce(sender: Address, key?: bigint): Promise<bigint>
  getDepositInfo(account: Address): Promise<{
    deposit: bigint
    staked: boolean
    stake: bigint
    unstakeDelaySec: number
    withdrawTime: number
  }>
  getBalance(account: Address): Promise<bigint>
  hasCode(address: Address): Promise<boolean>
}

/**
 * Entity type for reputation tracking
 */
export type EntityType = 'account' | 'factory' | 'paymaster' | 'aggregator'

/**
 * Reputation check result with stake info
 */
export interface ReputationCheckResult {
  status: ReputationStatus
  isStaked: boolean
  reason?: string
}

/**
 * Interface for reputation management
 */
export interface IReputationManager {
  checkReputation(address: Address): ReputationStatus
  checkReputationWithStake(
    address: Address,
    stakeInfo: StakeInfo,
    entityType: EntityType
  ): ReputationCheckResult
  isStaked(stakeInfo: StakeInfo): boolean
  updateSeen(address: Address): void
  updateIncluded(address: Address): void
  ban(address: Address, reason: string): void
  throttle(address: Address, reason: string): void
  clearReputation(address: Address): void
  clearAll(): void
  getEntry(address: Address): ReputationEntry | undefined
  getAllEntries(): ReputationEntry[]
  getBannedAddresses(): Address[]
  getThrottledAddresses(): Address[]
  setReputation(
    address: Address,
    opsSeen: number,
    opsIncluded: number,
    status?: ReputationStatus
  ): void
  dump(): ReputationEntry[]
  getConfig(): ReputationConfig
  updateConfig(config: Partial<ReputationConfig>): void
  getStats(): { total: number; ok: number; throttled: number; banned: number }
}

/**
 * Interface for opcode validation (ERC-7562)
 */
export interface IOpcodeValidator {
  validate(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Promise<void>
}

// ============================================================================
// Aggregator Types (ERC-4337 Signature Aggregation)
// ============================================================================

/**
 * UserOps grouped by aggregator for handleAggregatedOps
 */
export interface UserOpsPerAggregator {
  /** UserOperations using this aggregator */
  userOps: PackedUserOperation[]
  /** Aggregator contract address */
  aggregator: Address
  /** Aggregated signature produced by aggregator */
  signature: Hex
}

/**
 * Packed UserOperation (for contract calls)
 */
export interface PackedUserOperation {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
}

/**
 * Aggregator validation result
 */
export interface AggregatorValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Aggregator address */
  aggregator: Address
  /** Aggregator stake info */
  stakeInfo: StakeInfo
  /** Error reason if validation failed */
  reason?: string
}

/**
 * Interface for aggregator validation
 */
export interface IAggregatorValidator {
  /**
   * Validate individual UserOp signature through aggregator
   * Returns the signature to be used for aggregation
   */
  validateUserOpSignature(aggregator: Address, userOp: PackedUserOperation): Promise<Hex>

  /**
   * Aggregate multiple UserOp signatures
   */
  aggregateSignatures(aggregator: Address, userOps: PackedUserOperation[]): Promise<Hex>

  /**
   * Validate aggregated signature for multiple UserOps
   */
  validateSignatures(
    aggregator: Address,
    userOps: PackedUserOperation[],
    signature: Hex
  ): Promise<void>

  /**
   * Get aggregator stake info
   */
  getAggregatorStakeInfo(aggregator: Address): Promise<StakeInfo>

  /**
   * Check if aggregator is supported/valid
   */
  isValidAggregator(aggregator: Address): Promise<boolean>
}
