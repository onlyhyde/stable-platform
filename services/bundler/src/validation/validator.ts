import type { Address, PublicClient } from 'viem'
import type { UserOperation } from '../types'
import { RpcError, RPC_ERROR_CODES } from '../types'
import type { Logger } from '../utils/logger'
import type {
  ValidationResult,
  ReputationConfig,
  StakeInfo,
  IFormatValidator,
  ISimulationValidator,
  IReputationManager,
  IOpcodeValidator,
} from './types'
import { DEFAULT_REPUTATION_CONFIG } from './types'
import { FormatValidator } from './formatValidator'
import { SimulationValidator } from './simulationValidator'
import { ReputationManager } from './reputationManager'

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
  private readonly config: ValidatorConfig
  private readonly logger: Logger

  /**
   * Create validator with injected dependencies (recommended for production/testing)
   */
  constructor(
    config: ValidatorConfig,
    logger: Logger,
    dependencies: ValidatorDependencies
  ) {
    this.config = config
    this.logger = logger.child({ module: 'validator' })
    this.formatValidator = dependencies.formatValidator
    this.simulationValidator = dependencies.simulationValidator
    this.reputationManager = dependencies.reputationManager
    this.opcodeValidator = dependencies.opcodeValidator
  }

  /**
   * Factory method: Create validator with default implementations
   * Convenience method for simple instantiation
   */
  static create(
    publicClient: PublicClient,
    config: ValidatorConfig,
    logger: Logger
  ): UserOperationValidator {
    const dependencies: ValidatorDependencies = {
      formatValidator: new FormatValidator(),
      simulationValidator: new SimulationValidator(
        publicClient,
        config.entryPoint,
        logger
      ),
      reputationManager: new ReputationManager(
        logger,
        config.reputation ?? DEFAULT_REPUTATION_CONFIG
      ),
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

    // Phase 5: Validate simulation result
    this.validateSimulationResult(result, userOp)

    // Phase 6: Opcode validation (ERC-7562)
    if (!this.config.skipOpcodeValidation && this.opcodeValidator) {
      await this.validateOpcodes(userOp)
    }

    // Update reputation (seen)
    this.updateReputationSeen(userOp)

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
      throw new RpcError(
        `${entityType} ${address} is banned`,
        RPC_ERROR_CODES.BANNED_OR_THROTTLED
      )
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
      const onChainNonce = await this.simulationValidator.getNonce(
        userOp.sender,
        nonceKey
      )

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
      throw new RpcError(
        'Failed to validate nonce',
        RPC_ERROR_CODES.INTERNAL_ERROR
      )
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
      await this.opcodeValidator.validate(
        userOp.sender,
        userOp.factory,
        userOp.paymaster
      )
    } catch (error) {
      this.logger.debug({ error }, 'Opcode validation failed')
      throw error
    }
  }

  /**
   * Phase 5: Validate simulation result
   */
  private validateSimulationResult(
    result: ValidationResult,
    userOp: UserOperation
  ): void {
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

    // Check for aggregator (currently not supported)
    const aggregator = this.simulationValidator.validateAggregator(
      result.returnInfo.accountValidationData
    )
    if (aggregator) {
      throw new RpcError(
        `aggregator ${aggregator} not supported`,
        RPC_ERROR_CODES.UNSUPPORTED_AGGREGATOR
      )
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
  private updateReputationSeen(userOp: UserOperation): void {
    this.reputationManager.updateSeen(userOp.sender)

    if (userOp.factory) {
      this.reputationManager.updateSeen(userOp.factory)
    }

    if (userOp.paymaster) {
      this.reputationManager.updateSeen(userOp.paymaster)
    }
  }

  /**
   * Update reputation for all entities (called when UserOp is included)
   */
  updateReputationIncluded(userOp: UserOperation): void {
    this.reputationManager.updateIncluded(userOp.sender)

    if (userOp.factory) {
      this.reputationManager.updateIncluded(userOp.factory)
    }

    if (userOp.paymaster) {
      this.reputationManager.updateIncluded(userOp.paymaster)
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
