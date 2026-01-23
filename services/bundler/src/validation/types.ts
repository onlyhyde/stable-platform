import type { Address, Hex } from 'viem'

/**
 * Validation phases for tracking where validation failed
 */
export type ValidationPhase =
  | 'format'
  | 'reputation'
  | 'state'
  | 'simulation'
  | 'preflight'

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
 * Constants for validation
 */
export const VALIDATION_CONSTANTS = {
  /** Minimum callGasLimit */
  MIN_CALL_GAS_LIMIT: 9000n,
  /** Minimum verificationGasLimit */
  MIN_VERIFICATION_GAS_LIMIT: 10000n,
  /** Minimum preVerificationGas */
  MIN_PRE_VERIFICATION_GAS: 21000n,
  /** Minimum signature length (65 bytes = 0x + 130 chars) */
  MIN_SIGNATURE_LENGTH: 132,
  /** Maximum gas for a single operation */
  MAX_VERIFICATION_GAS: 10_000_000n,
  /** Maximum bundle gas */
  MAX_BUNDLE_GAS: 30_000_000n,
  /** Signature aggregator marker (0 address means no aggregator) */
  SIG_VALIDATION_SUCCESS: '0x0000000000000000000000000000000000000000' as Address,
  SIG_VALIDATION_FAILED: '0x0000000000000000000000000000000000000001' as Address,
  /** Time range for validity window (30 seconds minimum remaining) */
  MIN_VALID_UNTIL_BUFFER: 30n,
  /** Zero address constant */
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000' as Address,
} as const

/**
 * Default reputation configuration
 */
export const DEFAULT_REPUTATION_CONFIG: ReputationConfig = {
  minInclusionDenominator: 10,
  throttlingSlack: 10,
  banSlack: 50,
  minStake: 100000000000000000n, // 0.1 ETH
  minUnstakeDelay: 86400, // 1 day
  decayIntervalMs: 0, // disabled by default
  decayAmount: 0, // disabled by default
  throttleAutoReleaseDurationMs: 0, // disabled by default
}

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
  validateTimestamps(
    accountValidationData: bigint,
    paymasterValidationData?: bigint
  ): void
  validateSignature(
    accountValidationData: bigint,
    paymasterValidationData?: bigint
  ): void
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
  validateUserOpSignature(
    aggregator: Address,
    userOp: PackedUserOperation
  ): Promise<Hex>

  /**
   * Aggregate multiple UserOp signatures
   */
  aggregateSignatures(
    aggregator: Address,
    userOps: PackedUserOperation[]
  ): Promise<Hex>

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
