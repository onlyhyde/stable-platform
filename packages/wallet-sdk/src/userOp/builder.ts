/**
 * UserOperation Builder — Fluent API for constructing EIP-4337 UserOperations.
 *
 * Provides a type-safe, step-by-step builder pattern for creating UserOperations
 * with built-in defaults and validation.
 *
 * @example
 * ```typescript
 * const userOp = new UserOperationBuilder()
 *   .setSender('0x...')
 *   .setCallData('0x...')
 *   .setNonce(5n)
 *   .setGasLimits({ callGasLimit: 100000n, verificationGasLimit: 150000n, preVerificationGas: 21000n })
 *   .setGasFees({ maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 100000000n })
 *   .setSignature('0x...')
 *   .build()
 * ```
 */

import type { UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'

/**
 * Gas limits configuration
 */
export interface GasLimitsConfig {
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
}

/**
 * Gas fees configuration (EIP-1559)
 */
export interface GasFeesConfig {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Paymaster configuration for sponsored/ERC-20 gas payment
 */
export interface PaymasterConfig {
  paymaster: Address
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
  paymasterData?: Hex
}

/**
 * Factory configuration for account deployment
 */
export interface FactoryConfig {
  factory: Address
  factoryData: Hex
}

/**
 * Validation errors from build()
 */
export class UserOperationValidationError extends Error {
  constructor(
    message: string,
    public readonly missingFields: string[]
  ) {
    super(message)
    this.name = 'UserOperationValidationError'
  }
}

/**
 * Fluent builder for EIP-4337 v0.7 UserOperations.
 *
 * Required fields: sender, callData, signature, nonce, gas limits, gas fees.
 * Optional fields: factory/factoryData, paymaster fields.
 */
export class UserOperationBuilder {
  private _sender?: Address
  private _nonce?: bigint
  private _factory?: Address
  private _factoryData?: Hex
  private _callData?: Hex
  private _callGasLimit?: bigint
  private _verificationGasLimit?: bigint
  private _preVerificationGas?: bigint
  private _maxFeePerGas?: bigint
  private _maxPriorityFeePerGas?: bigint
  private _paymaster?: Address
  private _paymasterVerificationGasLimit?: bigint
  private _paymasterPostOpGasLimit?: bigint
  private _paymasterData?: Hex
  private _signature?: Hex

  /**
   * Set the sender (smart account) address.
   */
  setSender(sender: Address): this {
    this._sender = sender
    return this
  }

  /**
   * Set the nonce (from EntryPoint.getNonce).
   */
  setNonce(nonce: bigint): this {
    this._nonce = nonce
    return this
  }

  /**
   * Set account deployment factory and data.
   * Only needed for first-time account deployment.
   */
  setFactory(config: FactoryConfig): this {
    this._factory = config.factory
    this._factoryData = config.factoryData
    return this
  }

  /**
   * Set the call data (encoded account execution).
   */
  setCallData(callData: Hex): this {
    this._callData = callData
    return this
  }

  /**
   * Set all gas limits at once.
   */
  setGasLimits(config: GasLimitsConfig): this {
    this._callGasLimit = config.callGasLimit
    this._verificationGasLimit = config.verificationGasLimit
    this._preVerificationGas = config.preVerificationGas
    return this
  }

  /**
   * Set individual gas limit fields.
   */
  setCallGasLimit(limit: bigint): this {
    this._callGasLimit = limit
    return this
  }

  setVerificationGasLimit(limit: bigint): this {
    this._verificationGasLimit = limit
    return this
  }

  setPreVerificationGas(gas: bigint): this {
    this._preVerificationGas = gas
    return this
  }

  /**
   * Set EIP-1559 gas fee parameters.
   */
  setGasFees(config: GasFeesConfig): this {
    this._maxFeePerGas = config.maxFeePerGas
    this._maxPriorityFeePerGas = config.maxPriorityFeePerGas
    return this
  }

  /**
   * Set paymaster configuration for sponsored/ERC-20 gas payment.
   */
  setPaymaster(config: PaymasterConfig): this {
    this._paymaster = config.paymaster
    this._paymasterVerificationGasLimit = config.paymasterVerificationGasLimit
    this._paymasterPostOpGasLimit = config.paymasterPostOpGasLimit
    this._paymasterData = config.paymasterData
    return this
  }

  /**
   * Set the UserOperation signature.
   */
  setSignature(signature: Hex): this {
    this._signature = signature
    return this
  }

  /**
   * Build and validate the UserOperation.
   * @throws UserOperationValidationError if required fields are missing
   */
  build(): UserOperation {
    const missing: string[] = []

    if (!this._sender) missing.push('sender')
    if (this._nonce === undefined) missing.push('nonce')
    if (!this._callData) missing.push('callData')
    if (this._callGasLimit === undefined) missing.push('callGasLimit')
    if (this._verificationGasLimit === undefined) missing.push('verificationGasLimit')
    if (this._preVerificationGas === undefined) missing.push('preVerificationGas')
    if (this._maxFeePerGas === undefined) missing.push('maxFeePerGas')
    if (this._maxPriorityFeePerGas === undefined) missing.push('maxPriorityFeePerGas')
    if (!this._signature) missing.push('signature')

    if (missing.length > 0) {
      throw new UserOperationValidationError(
        `Missing required fields: ${missing.join(', ')}`,
        missing
      )
    }

    // Validate factory consistency
    if ((this._factory && !this._factoryData) || (!this._factory && this._factoryData)) {
      throw new UserOperationValidationError(
        'factory and factoryData must both be set or both be unset',
        ['factory', 'factoryData']
      )
    }

    // Validate paymaster consistency
    if (this._paymaster) {
      if (this._paymasterVerificationGasLimit === undefined) {
        throw new UserOperationValidationError(
          'paymasterVerificationGasLimit required when paymaster is set',
          ['paymasterVerificationGasLimit']
        )
      }
      if (this._paymasterPostOpGasLimit === undefined) {
        throw new UserOperationValidationError(
          'paymasterPostOpGasLimit required when paymaster is set',
          ['paymasterPostOpGasLimit']
        )
      }
    }

    // Validate gas fee relationship
    if (this._maxPriorityFeePerGas! > this._maxFeePerGas!) {
      throw new UserOperationValidationError(
        'maxPriorityFeePerGas cannot exceed maxFeePerGas',
        ['maxPriorityFeePerGas', 'maxFeePerGas']
      )
    }

    const userOp: UserOperation = {
      sender: this._sender!,
      nonce: this._nonce!,
      callData: this._callData!,
      callGasLimit: this._callGasLimit!,
      verificationGasLimit: this._verificationGasLimit!,
      preVerificationGas: this._preVerificationGas!,
      maxFeePerGas: this._maxFeePerGas!,
      maxPriorityFeePerGas: this._maxPriorityFeePerGas!,
      signature: this._signature!,
    }

    if (this._factory) {
      userOp.factory = this._factory
      userOp.factoryData = this._factoryData
    }

    if (this._paymaster) {
      userOp.paymaster = this._paymaster
      userOp.paymasterVerificationGasLimit = this._paymasterVerificationGasLimit
      userOp.paymasterPostOpGasLimit = this._paymasterPostOpGasLimit
      userOp.paymasterData = this._paymasterData
    }

    return userOp
  }

  /**
   * Create a copy of this builder for forking configurations.
   */
  clone(): UserOperationBuilder {
    const copy = new UserOperationBuilder()
    copy._sender = this._sender
    copy._nonce = this._nonce
    copy._factory = this._factory
    copy._factoryData = this._factoryData
    copy._callData = this._callData
    copy._callGasLimit = this._callGasLimit
    copy._verificationGasLimit = this._verificationGasLimit
    copy._preVerificationGas = this._preVerificationGas
    copy._maxFeePerGas = this._maxFeePerGas
    copy._maxPriorityFeePerGas = this._maxPriorityFeePerGas
    copy._paymaster = this._paymaster
    copy._paymasterVerificationGasLimit = this._paymasterVerificationGasLimit
    copy._paymasterPostOpGasLimit = this._paymasterPostOpGasLimit
    copy._paymasterData = this._paymasterData
    copy._signature = this._signature
    return copy
  }
}
