import type { Address, Hex, PublicClient } from 'viem'
import { concat, pad, toHex } from 'viem'
import type { UserOperation } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import { FormatValidator } from './formatValidator'
import { OpcodeValidator } from './opcodeValidator'
import { ReputationManager } from './reputationManager'
import { SimulationValidator } from './simulationValidator'
import { DebugTraceCallTracer } from './tracer'
import type {
  IAggregatorValidator,
  IFormatValidator,
  IOpcodeValidator,
  IReputationManager,
  ISimulationValidator,
  PackedUserOperation,
  ReputationConfig,
  StakeInfo,
  ValidationResult,
} from './types'
import { DEFAULT_REPUTATION_CONFIG } from './types'

/**
 * Configuration for UserOperationValidator
 */
export interface ValidatorConfig {
  /** EntryPoint address */
  entryPoint: Address
  /** Reputation configuration */
  reputation?: Partial<ReputationConfig>
  /** Skip simulation (for testing only) */
  skipSimulation?: boolean
  /** Skip reputation checks */
  skipReputation?: boolean
  /** Skip opcode validation (for testing without tracer) */
  skipOpcodeValidation?: boolean
  /** Require staking for all entities */
  requireStaking?: boolean
  /** Maximum allowed nonce gap from on-chain nonce (default: 10) */
  maxNonceGap?: bigint
  /** Minimum seconds before validUntil for a valid operation (default: 30) */
  minValidUntilBuffer?: bigint
  /** Enable aggregator support (EIP-4337 Section 15, default: false) */
  enableAggregation?: boolean
}

/**
 * Default validator configuration values
 */
export const DEFAULT_VALIDATOR_CONFIG = {
  maxNonceGap: 10n,
  minValidUntilBuffer: 30n,
} as const

/**
 * Dependencies for UserOperationValidator (Dependency Injection)
 */
export interface ValidatorDependencies {
  formatValidator: IFormatValidator
  simulationValidator: ISimulationValidator
  reputationManager: IReputationManager
  /** Optional opcode validator for ERC-7562 compliance */
  opcodeValidator?: IOpcodeValidator
  /** Optional aggregator validator for EIP-4337 Section 15 signature aggregation */
  aggregatorValidator?: IAggregatorValidator
}

/**
 * Main UserOperation validator
 * Orchestrates format, reputation, state, simulation, and opcode validation
 */
export class UserOperationValidator {
  private readonly formatValidator: IFormatValidator
  private readonly simulationValidator: ISimulationValidator
  private readonly reputationManager: IReputationManager
  private readonly opcodeValidator?: IOpcodeValidator
  private readonly aggregatorValidator?: IAggregatorValidator
  private readonly config: ValidatorConfig
  private readonly logger: Logger

  /**
   * Create validator with injected dependencies (recommended for production/testing)
   */
  constructor(config: ValidatorConfig, logger: Logger, dependencies: ValidatorDependencies) {
    this.config = config
    this.logger = logger.child({ module: 'validator' })
    this.formatValidator = dependencies.formatValidator
    this.simulationValidator = dependencies.simulationValidator
    this.reputationManager = dependencies.reputationManager
    this.opcodeValidator = dependencies.opcodeValidator
    this.aggregatorValidator = dependencies.aggregatorValidator
  }

  /**
   * Factory method: Create validator with default implementations
   * Convenience method for simple instantiation
   */
  static create(
    publicClient: PublicClient,
    config: ValidatorConfig,
    logger: Logger,
    aggregatorValidator?: IAggregatorValidator
  ): UserOperationValidator {
    // Warn if skip flags are used in production — these bypass critical security checks
    if (process.env.NODE_ENV === 'production') {
      const skipFlags = [
        config.skipSimulation && 'skipSimulation',
        config.skipReputation && 'skipReputation',
        config.skipOpcodeValidation && 'skipOpcodeValidation',
      ].filter(Boolean)

      if (skipFlags.length > 0) {
        logger.warn(
          { skipFlags },
          'Validation skip flags are active in production. This weakens security and may allow malicious UserOperations.'
        )
      }
    }

    let opcodeValidator: IOpcodeValidator | undefined
    if (!config.skipOpcodeValidation) {
      const tracer = new DebugTraceCallTracer(publicClient, config.entryPoint, logger)
      opcodeValidator = new OpcodeValidator(tracer, config.entryPoint, logger)
    }

    const dependencies: ValidatorDependencies = {
      formatValidator: new FormatValidator(),
      simulationValidator: new SimulationValidator(publicClient, config.entryPoint, logger),
      reputationManager: new ReputationManager(
        logger,
        config.reputation ?? DEFAULT_REPUTATION_CONFIG
      ),
      opcodeValidator,
      aggregatorValidator,
    }

    return new UserOperationValidator(config, logger, dependencies)
  }

  /**
   * Validate a UserOperation
   * @returns ValidationResult if successful
   * @throws RpcError if validation fails
   */
  async validate(userOp: UserOperation): Promise<ValidationResult> {
    this.logger.debug(
      { sender: userOp.sender, nonce: userOp.nonce.toString() },
      'Starting validation'
    )

    // Phase 1: Format validation (fast, no RPC)
    this.validateFormat(userOp)

    // Phase 2: Reputation check
    if (!this.config.skipReputation) {
      this.checkReputations(userOp)
    }

    // Phase 3: State validation (RPC calls)
    await this.validateState(userOp)

    // Phase 4: Simulation
    let result: ValidationResult
    if (this.config.skipSimulation) {
      // Create dummy result for testing
      result = this.createDummyValidationResult()
    } else {
      result = await this.simulationValidator.simulate(userOp)
    }

    // Phase 5: Validate simulation result (may set aggregator on result)
    await this.validateSimulationResult(result, userOp)

    // Phase 6: Opcode validation (ERC-7562)
    if (!this.config.skipOpcodeValidation && this.opcodeValidator) {
      await this.validateOpcodes(userOp)
    }

    // Update reputation (seen) — includes aggregator if present
    this.updateReputationSeen(userOp, result.aggregator)

    this.logger.debug(
      { sender: userOp.sender, preOpGas: result.returnInfo.preOpGas.toString() },
      'Validation successful'
    )

    return result
  }

  /**
   * Phase 1: Validate UserOperation format
   */
  private validateFormat(userOp: UserOperation): void {
    try {
      this.formatValidator.validate(userOp)
    } catch (error) {
      this.logger.debug({ error }, 'Format validation failed')
      throw error
    }
  }

  /**
   * Phase 2: Check reputation of all entities
   */
  private checkReputations(userOp: UserOperation): void {
    // Check sender reputation (always required)
    this.checkEntityReputation(userOp.sender, 'sender')

    // Check factory reputation (if present)
    if (userOp.factory) {
      this.checkEntityReputation(userOp.factory, 'factory')
    }

    // Check paymaster reputation (if present)
    if (userOp.paymaster) {
      this.checkEntityReputation(userOp.paymaster, 'paymaster')
    }
  }

  /**
   * Check reputation for a single entity and throw if banned/throttled
   */
  private checkEntityReputation(
    address: Address,
    entityType: 'sender' | 'factory' | 'paymaster'
  ): void {
    const status = this.reputationManager.checkReputation(address)

    if (status === 'banned') {
      throw new RpcError(`${entityType} ${address} is banned`, RPC_ERROR_CODES.BANNED_OR_THROTTLED)
    }

    if (status === 'throttled') {
      throw new RpcError(
        `${entityType} ${address} is throttled`,
        RPC_ERROR_CODES.BANNED_OR_THROTTLED
      )
    }
  }

  /**
   * Phase 3: Validate on-chain state
   */
  private async validateState(userOp: UserOperation): Promise<void> {
    // Validate nonce
    await this.validateNonce(userOp)

    // Validate account exists or factory is specified
    await this.validateAccountExists(userOp)

    // EIP-4337 Section 7.1: Validate paymaster on-chain state
    if (userOp.paymaster) {
      await this.validatePaymasterOnChain(userOp)
    }
  }

  /**
   * EIP-4337 Section 7.1: Validate paymaster on-chain state
   * - paymaster must have deployed code
   * - paymaster must have sufficient deposit to cover the UserOp gas
   */
  private async validatePaymasterOnChain(userOp: UserOperation): Promise<void> {
    const paymaster = userOp.paymaster!

    // Check paymaster has deployed code
    try {
      const hasCode = await this.simulationValidator.hasCode(paymaster)
      if (!hasCode) {
        throw new RpcError(
          `paymaster ${paymaster} has no deployed code`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    } catch (error) {
      if (error instanceof RpcError) throw error
      this.logger.error({ error, paymaster }, 'Failed to check paymaster code')
      throw new RpcError('Failed to check paymaster code', RPC_ERROR_CODES.INTERNAL_ERROR)
    }

    // Check paymaster has sufficient deposit
    try {
      const depositInfo = await this.simulationValidator.getDepositInfo(paymaster)
      const maxGasCost =
        (userOp.verificationGasLimit +
          userOp.callGasLimit +
          (userOp.paymasterVerificationGasLimit ?? 0n) +
          (userOp.paymasterPostOpGasLimit ?? 0n) +
          userOp.preVerificationGas) *
        userOp.maxFeePerGas

      if (depositInfo.deposit < maxGasCost) {
        throw new RpcError(
          `paymaster ${paymaster} deposit (${depositInfo.deposit}) insufficient for UserOp max cost (${maxGasCost})`,
          RPC_ERROR_CODES.REJECTED_BY_PAYMASTER
        )
      }
    } catch (error) {
      if (error instanceof RpcError) throw error
      this.logger.error({ error, paymaster }, 'Failed to check paymaster deposit')
      throw new RpcError('Failed to check paymaster deposit', RPC_ERROR_CODES.INTERNAL_ERROR)
    }
  }

  /**
   * Validate nonce is correct
   */
  private async validateNonce(userOp: UserOperation): Promise<void> {
    // Extract nonce key (upper 192 bits)
    const nonceKey = userOp.nonce >> 64n
    // Extract nonce sequence (lower 64 bits)
    const nonceSequence = userOp.nonce & ((1n << 64n) - 1n)

    try {
      const onChainNonce = await this.simulationValidator.getNonce(userOp.sender, nonceKey)

      // Extract on-chain sequence
      const onChainSequence = onChainNonce & ((1n << 64n) - 1n)

      if (nonceSequence < onChainSequence) {
        throw new RpcError(
          `nonce too low: got ${nonceSequence}, expected >= ${onChainSequence}`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }

      // Allow some gap for pending operations
      const maxGap = this.config.maxNonceGap ?? DEFAULT_VALIDATOR_CONFIG.maxNonceGap
      if (nonceSequence > onChainSequence + maxGap) {
        throw new RpcError(
          `nonce too high: got ${nonceSequence}, expected <= ${onChainSequence + maxGap}`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    } catch (error) {
      if (error instanceof RpcError) throw error

      this.logger.error({ error }, 'Failed to validate nonce')
      throw new RpcError('Failed to validate nonce', RPC_ERROR_CODES.INTERNAL_ERROR)
    }
  }

  /**
   * Validate account exists or factory is specified for deployment
   */
  private async validateAccountExists(userOp: UserOperation): Promise<void> {
    const hasCode = await this.simulationValidator.hasCode(userOp.sender)

    if (!hasCode) {
      // Account doesn't exist, must have factory
      if (!userOp.factory) {
        throw new RpcError(
          `account ${userOp.sender} does not exist and no factory specified`,
          RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
        )
      }
    }
  }

  /**
   * Phase 6: Validate opcodes (ERC-7562)
   */
  private async validateOpcodes(userOp: UserOperation): Promise<void> {
    if (!this.opcodeValidator) {
      return
    }

    try {
      await this.opcodeValidator.validate(userOp.sender, userOp.factory, userOp.paymaster)
    } catch (error) {
      this.logger.debug({ error }, 'Opcode validation failed')
      throw error
    }
  }

  /**
   * Phase 5: Validate simulation result
   */
  private async validateSimulationResult(
    result: ValidationResult,
    userOp: UserOperation
  ): Promise<void> {
    // Validate signatures
    this.simulationValidator.validateSignature(
      result.returnInfo.accountValidationData,
      userOp.paymaster ? result.returnInfo.paymasterValidationData : undefined
    )

    // Validate timestamps
    this.simulationValidator.validateTimestamps(
      result.returnInfo.accountValidationData,
      userOp.paymaster ? result.returnInfo.paymasterValidationData : undefined
    )

    // Check for aggregator
    const aggregator = this.simulationValidator.validateAggregator(
      result.returnInfo.accountValidationData
    )
    if (aggregator) {
      if (!this.config.enableAggregation) {
        throw new RpcError(
          `aggregator ${aggregator} not supported`,
          RPC_ERROR_CODES.UNSUPPORTED_AGGREGATOR
        )
      }

      // EIP-4337 Section 15: Aggregator must be staked
      const { minStake, minUnstakeDelay } = this.reputationManager.getConfig()
      this.simulationValidator.validateStakeInfo(
        result.senderInfo, // aggregator stake info comes from simulation
        'sender', // entityType for error message (the aggregator)
        minStake,
        minUnstakeDelay
      )

      // EIP-4337 Section 15: Validate individual signature through aggregator contract
      if (this.aggregatorValidator) {
        const packedOp = this.packUserOp(userOp)
        await this.aggregatorValidator.validateUserOpSignature(aggregator, packedOp)
        this.logger.debug(
          { aggregator, sender: userOp.sender },
          'Aggregator individual signature validation passed'
        )
      }

      // Store aggregator address in result for upstream consumption
      result.aggregator = aggregator

      this.logger.debug({ aggregator }, 'Aggregator accepted for UserOperation')
    }

    // Validate stake info if required
    if (this.config.requireStaking) {
      const { minStake, minUnstakeDelay } = this.reputationManager.getConfig()

      // Check factory stake
      if (userOp.factory) {
        this.simulationValidator.validateStakeInfo(
          result.factoryInfo,
          'factory',
          minStake,
          minUnstakeDelay
        )
      }

      // Check paymaster stake
      if (userOp.paymaster) {
        this.simulationValidator.validateStakeInfo(
          result.paymasterInfo,
          'paymaster',
          minStake,
          minUnstakeDelay
        )
      }
    }
  }

  /**
   * Update reputation for all entities (called when UserOp is seen)
   */
  private updateReputationSeen(userOp: UserOperation, aggregator?: Address): void {
    this.reputationManager.updateSeen(userOp.sender)

    if (userOp.factory) {
      this.reputationManager.updateSeen(userOp.factory)
    }

    if (userOp.paymaster) {
      this.reputationManager.updateSeen(userOp.paymaster)
    }

    if (aggregator) {
      this.reputationManager.updateSeen(aggregator)
    }
  }

  /**
   * Update reputation for all entities (called when UserOp is included)
   */
  updateReputationIncluded(userOp: UserOperation, aggregator?: Address): void {
    this.reputationManager.updateIncluded(userOp.sender)

    if (userOp.factory) {
      this.reputationManager.updateIncluded(userOp.factory)
    }

    if (userOp.paymaster) {
      this.reputationManager.updateIncluded(userOp.paymaster)
    }

    if (aggregator) {
      this.reputationManager.updateIncluded(aggregator)
    }
  }

  /**
   * Ban an address
   */
  banAddress(address: Address, reason: string): void {
    this.reputationManager.ban(address, reason)
  }

  /**
   * Throttle an address
   */
  throttleAddress(address: Address, reason: string): void {
    this.reputationManager.throttle(address, reason)
  }

  /**
   * Clear reputation for an address
   */
  clearReputation(address: Address): void {
    this.reputationManager.clearReputation(address)
  }

  /**
   * Clear all reputation data
   */
  clearAllReputation(): void {
    this.reputationManager.clearAll()
  }

  /**
   * Get reputation manager for advanced operations
   */
  getReputationManager(): IReputationManager {
    return this.reputationManager
  }

  /**
   * Get simulation validator for advanced operations
   */
  getSimulationValidator(): ISimulationValidator {
    return this.simulationValidator
  }

  /**
   * Get format validator for advanced operations
   */
  getFormatValidator(): IFormatValidator {
    return this.formatValidator
  }

  /**
   * Get opcode validator for advanced operations
   */
  getOpcodeValidator(): IOpcodeValidator | undefined {
    return this.opcodeValidator
  }

  /**
   * Get aggregator validator for advanced operations
   */
  getAggregatorValidator(): IAggregatorValidator | undefined {
    return this.aggregatorValidator
  }

  /**
   * Pack a UserOperation into the packed format required by aggregator contracts
   */
  private packUserOp(userOp: UserOperation): PackedUserOperation {
    const initCode =
      userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

    const accountGasLimits = concat([
      pad(toHex(userOp.verificationGasLimit), { size: 16 }),
      pad(toHex(userOp.callGasLimit), { size: 16 }),
    ]) as Hex

    const gasFees = concat([
      pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
      pad(toHex(userOp.maxFeePerGas), { size: 16 }),
    ]) as Hex

    let paymasterAndData: Hex = '0x'
    if (userOp.paymaster) {
      paymasterAndData = concat([
        userOp.paymaster,
        pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
        pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
        userOp.paymasterData ?? '0x',
      ]) as Hex
    }

    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode,
      callData: userOp.callData,
      accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: userOp.signature,
    }
  }

  /**
   * Create dummy validation result for testing
   */
  private createDummyValidationResult(): ValidationResult {
    const zeroStakeInfo: StakeInfo = {
      stake: 0n,
      unstakeDelaySec: 0n,
    }

    return {
      returnInfo: {
        preOpGas: 50000n,
        prefund: 0n,
        accountValidationData: 0n,
        paymasterValidationData: 0n,
        paymasterContext: '0x',
      },
      senderInfo: zeroStakeInfo,
      factoryInfo: zeroStakeInfo,
      paymasterInfo: zeroStakeInfo,
    }
  }
}
