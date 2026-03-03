import type { Address, Hex, PublicClient } from 'viem'
import { concat, encodeFunctionData, pad, toHex } from 'viem'
import { ENTRY_POINT_ABI } from '../abi'
import {
  ENTRY_POINT_SIMULATIONS_ABI,
  ENTRY_POINT_SIMULATIONS_BYTECODE,
} from '../abi/entryPointSimulations'
import type { UserOperation } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import type { ExecutionResult, ISimulationValidator, StakeInfo, ValidationResult } from './types'
import { VALIDATION_CONSTANTS } from './types'

const { ZERO_ADDRESS } = VALIDATION_CONSTANTS

import {
  decodeExecutionResultReturn,
  decodeFailedOp,
  decodeFailedOpWithRevert,
  decodeValidationResultReturn,
  extractErrorData,
  isSignatureFailure,
  matchesErrorSelector,
  parseValidationData,
  validateTimestamps,
} from './errors'

/**
 * Pack a UserOperation for EntryPoint ABI (uses bigint for nonce and preVerificationGas)
 */
function packUserOperationForAbi(userOp: UserOperation): {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
} {
  // Build initCode
  const initCode =
    userOp.factory && userOp.factoryData
      ? (concat([userOp.factory, userOp.factoryData]) as Hex)
      : '0x'

  // Build accountGasLimits (verificationGasLimit + callGasLimit)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  // Build gasFees (maxPriorityFeePerGas + maxFeePerGas)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  // Build paymasterAndData
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
 * Simulation validator for UserOperations
 * Calls EntryPoint.simulateValidation to verify operations
 */
export class SimulationValidator implements ISimulationValidator {
  private publicClient: PublicClient
  private entryPoint: Address
  private logger: Logger

  constructor(publicClient: PublicClient, entryPoint: Address, logger: Logger) {
    this.publicClient = publicClient
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'simulation' })
  }

  /**
   * Simulate validation of a UserOperation
   *
   * Uses EntryPointSimulations contract via eth_call state override.
   * The simulation contract is injected at the EntryPoint address, so
   * simulateValidation returns results normally (not via revert).
   * FailedOp/FailedOpWithRevert still arrive as reverts on validation failure.
   *
   * @returns ValidationResult if successful
   * @throws RpcError if validation fails
   */
  async simulate(userOp: UserOperation): Promise<ValidationResult> {
    const packedOp = packUserOperationForAbi(userOp)

    this.logger.debug(
      { sender: userOp.sender, nonce: userOp.nonce.toString() },
      'Starting simulation'
    )

    const calldata = encodeFunctionData({
      abi: ENTRY_POINT_SIMULATIONS_ABI,
      functionName: 'simulateValidation',
      args: [packedOp],
    })

    try {
      const { data } = await this.publicClient.call({
        to: this.entryPoint,
        data: calldata,
        stateOverride: [
          {
            address: this.entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      if (!data) {
        throw new RpcError(
          'simulateValidation returned empty data',
          RPC_ERROR_CODES.INTERNAL_ERROR
        )
      }

      // Normal return — decode ValidationResult
      const result = decodeValidationResultReturn(data)

      this.logger.debug(
        {
          preOpGas: result.returnInfo.preOpGas.toString(),
          prefund: result.returnInfo.prefund.toString(),
        },
        'Simulation successful'
      )

      return result
    } catch (error) {
      if (error instanceof RpcError) throw error
      // FailedOp/FailedOpWithRevert still arrive as reverts
      return this.parseSimulationError(error)
    }
  }

  /**
   * Simulate execution of a UserOperation (for gas estimation)
   * Uses EntryPointSimulations via state override. Returns ExecutionResult normally.
   * @returns ExecutionResult if successful
   */
  async simulateExecution(
    userOp: UserOperation,
    target: Address = ZERO_ADDRESS,
    targetCallData: Hex = '0x'
  ): Promise<ExecutionResult> {
    const packedOp = packUserOperationForAbi(userOp)

    const calldata = encodeFunctionData({
      abi: ENTRY_POINT_SIMULATIONS_ABI,
      functionName: 'simulateHandleOp',
      args: [packedOp, target, targetCallData],
    })

    try {
      const { data } = await this.publicClient.call({
        to: this.entryPoint,
        data: calldata,
        stateOverride: [
          {
            address: this.entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      if (!data) {
        throw new RpcError(
          'simulateHandleOp returned empty data',
          RPC_ERROR_CODES.INTERNAL_ERROR
        )
      }

      return decodeExecutionResultReturn(data)
    } catch (error) {
      if (error instanceof RpcError) throw error
      return this.parseExecutionError(error)
    }
  }

  /**
   * Validate timestamps from validation data
   */
  validateTimestamps(accountValidationData: bigint, paymasterValidationData?: bigint): void {
    // Parse and validate account timestamps
    const accountParsed = parseValidationData(accountValidationData)
    const accountTimestampResult = validateTimestamps(
      accountParsed.validAfter,
      accountParsed.validUntil
    )

    if (!accountTimestampResult.valid) {
      throw new RpcError(
        `Account validation failed: ${accountTimestampResult.reason}`,
        RPC_ERROR_CODES.SHORT_DEADLINE
      )
    }

    // Parse and validate paymaster timestamps if present
    if (paymasterValidationData !== undefined && paymasterValidationData !== 0n) {
      const paymasterParsed = parseValidationData(paymasterValidationData)
      const paymasterTimestampResult = validateTimestamps(
        paymasterParsed.validAfter,
        paymasterParsed.validUntil
      )

      if (!paymasterTimestampResult.valid) {
        throw new RpcError(
          `Paymaster validation failed: ${paymasterTimestampResult.reason}`,
          RPC_ERROR_CODES.SHORT_DEADLINE
        )
      }
    }
  }

  /**
   * Validate signature from validation data
   */
  validateSignature(accountValidationData: bigint, paymasterValidationData?: bigint): void {
    // Check account signature
    if (isSignatureFailure(accountValidationData)) {
      throw new RpcError('Account signature validation failed', RPC_ERROR_CODES.INVALID_SIGNATURE)
    }

    // Check paymaster signature if present
    if (paymasterValidationData !== undefined && paymasterValidationData !== 0n) {
      if (isSignatureFailure(paymasterValidationData)) {
        throw new RpcError(
          'Paymaster signature validation failed',
          RPC_ERROR_CODES.INVALID_SIGNATURE
        )
      }
    }
  }

  /**
   * Validate aggregator from validation data
   */
  validateAggregator(accountValidationData: bigint): Address | null {
    const { aggregator } = parseValidationData(accountValidationData)

    // Check for signature failure marker
    if (aggregator === VALIDATION_CONSTANTS.SIG_VALIDATION_FAILED) {
      throw new RpcError('Signature validation failed', RPC_ERROR_CODES.INVALID_SIGNATURE)
    }

    // Check for success marker (no aggregator)
    if (aggregator === VALIDATION_CONSTANTS.SIG_VALIDATION_SUCCESS) {
      return null
    }

    // Return aggregator address
    return aggregator
  }

  /**
   * Validate stake info for an entity
   */
  validateStakeInfo(
    stakeInfo: StakeInfo,
    entityType: 'sender' | 'factory' | 'paymaster',
    minStake: bigint,
    minUnstakeDelay: number
  ): void {
    if (stakeInfo.stake < minStake) {
      throw new RpcError(
        `${entityType} stake (${stakeInfo.stake}) below minimum (${minStake})`,
        RPC_ERROR_CODES.STAKE_OR_UNSTAKE_DELAY
      )
    }

    if (stakeInfo.unstakeDelaySec < BigInt(minUnstakeDelay)) {
      throw new RpcError(
        `${entityType} unstake delay (${stakeInfo.unstakeDelaySec}) below minimum (${minUnstakeDelay})`,
        RPC_ERROR_CODES.STAKE_OR_UNSTAKE_DELAY
      )
    }
  }

  /**
   * Get nonce from EntryPoint
   */
  async getNonce(sender: Address, key = 0n): Promise<bigint> {
    try {
      const nonce = await this.publicClient.readContract({
        address: this.entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [sender, key],
      })
      return nonce as bigint
    } catch (error) {
      this.logger.error({ error, sender, key }, 'Failed to get nonce')
      throw new RpcError('Failed to get nonce from EntryPoint', RPC_ERROR_CODES.INTERNAL_ERROR)
    }
  }

  /**
   * Get deposit info from EntryPoint
   */
  async getDepositInfo(account: Address): Promise<{
    deposit: bigint
    staked: boolean
    stake: bigint
    unstakeDelaySec: number
    withdrawTime: number
  }> {
    try {
      const result = await this.publicClient.readContract({
        address: this.entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getDepositInfo',
        args: [account],
      })

      const info = result as {
        deposit: bigint
        staked: boolean
        stake: bigint
        unstakeDelaySec: number
        withdrawTime: number
      }

      return info
    } catch (error) {
      this.logger.error({ error, account }, 'Failed to get deposit info')
      throw new RpcError(
        'Failed to get deposit info from EntryPoint',
        RPC_ERROR_CODES.INTERNAL_ERROR
      )
    }
  }

  /**
   * Get balance from EntryPoint
   */
  async getBalance(account: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'balanceOf',
        args: [account],
      })
      return balance as bigint
    } catch (error) {
      this.logger.error({ error, account }, 'Failed to get balance')
      throw new RpcError('Failed to get balance from EntryPoint', RPC_ERROR_CODES.INTERNAL_ERROR)
    }
  }

  /**
   * Check if account code exists
   */
  async hasCode(address: Address): Promise<boolean> {
    const code = await this.publicClient.getCode({ address })
    return code !== undefined && code !== '0x'
  }

  /**
   * Parse simulation error from FailedOp/FailedOpWithRevert reverts.
   * With EntryPointSimulations + state override, successful results are returned
   * normally. Only failure cases (FailedOp, FailedOpWithRevert) arrive here as reverts.
   */
  private parseSimulationError(error: unknown): never {
    const data = extractErrorData(error)

    if (!data) {
      this.logger.error({ error }, 'Failed to extract error data')
      throw new RpcError(
        `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
      )
    }

    // FailedOp
    if (matchesErrorSelector(data, 'FailedOp')) {
      const { opIndex, reason } = decodeFailedOp(data)

      this.logger.warn({ opIndex: opIndex.toString(), reason }, 'Simulation failed: FailedOp')

      throw this.mapFailedOpToRpcError(reason)
    }

    // FailedOpWithRevert
    if (matchesErrorSelector(data, 'FailedOpWithRevert')) {
      const { opIndex, reason, inner } = decodeFailedOpWithRevert(data)

      this.logger.warn(
        { opIndex: opIndex.toString(), reason, inner },
        'Simulation failed: FailedOpWithRevert'
      )

      throw this.mapFailedOpToRpcError(reason, inner)
    }

    // Unknown error format
    this.logger.error({ data }, 'Unknown simulation error format')
    throw new RpcError(
      `Unknown simulation error: ${data}`,
      RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
    )
  }

  /**
   * Parse execution simulation error (FailedOp/FailedOpWithRevert only).
   * Successful ExecutionResult is now returned normally via state override.
   */
  private parseExecutionError(error: unknown): never {
    const data = extractErrorData(error)

    if (!data) {
      throw new RpcError(
        `Execution simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
      )
    }

    // FailedOp error
    if (matchesErrorSelector(data, 'FailedOp')) {
      const { reason } = decodeFailedOp(data)
      throw this.mapFailedOpToRpcError(reason)
    }

    // FailedOpWithRevert error
    if (matchesErrorSelector(data, 'FailedOpWithRevert')) {
      const { reason, inner } = decodeFailedOpWithRevert(data)
      throw this.mapFailedOpToRpcError(reason, inner)
    }

    throw new RpcError(
      `Unknown execution error: ${data}`,
      RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
    )
  }

  /**
   * Map FailedOp reason to appropriate RPC error code
   */
  private mapFailedOpToRpcError(reason: string, inner?: Hex): RpcError {
    const message = inner ? `${reason}: ${inner}` : reason

    // Account Abstraction errors
    if (reason.startsWith('AA1')) {
      // AA1x: Account creation errors
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
    }

    if (reason.startsWith('AA2')) {
      // AA2x: Sender/Account errors
      if (reason === "AA21 didn't pay prefund" || reason.includes('prefund')) {
        return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
      }
      if (reason === 'AA23 reverted' || reason === 'AA24 signature error') {
        return new RpcError(message, RPC_ERROR_CODES.INVALID_SIGNATURE)
      }
      if (reason === 'AA25 invalid account nonce') {
        return new RpcError(message, RPC_ERROR_CODES.INVALID_PARAMS)
      }
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
    }

    if (reason.startsWith('AA3')) {
      // AA3x: Paymaster errors
      if (reason === 'AA33 reverted' || reason === 'AA34 signature error') {
        return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_PAYMASTER)
      }
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_PAYMASTER)
    }

    if (reason.startsWith('AA4')) {
      // AA4x: Verification errors
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
    }

    if (reason.startsWith('AA5')) {
      // AA5x: Execution errors
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
    }

    if (reason.startsWith('AA9')) {
      // AA9x: Inner errors
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
    }

    // Paymaster errors
    if (reason.startsWith('PM')) {
      return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_PAYMASTER)
    }

    // Kernel v0.3.3 module operation errors (detected in inner revert data)
    if (inner) {
      if (matchesErrorSelector(inner, 'ModuleOnUninstallFailed')) {
        return new RpcError(
          'Module rejected uninstall operation. Use forceUninstallModule for emergency removal.',
          RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
        )
      }
      if (matchesErrorSelector(inner, 'Reentrancy')) {
        return new RpcError(
          'Reentrancy detected in module operation.',
          RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
        )
      }
      if (matchesErrorSelector(inner, 'DelegatecallTargetNotWhitelisted')) {
        return new RpcError(
          'Delegatecall target not whitelisted. Call setDelegatecallWhitelist first.',
          RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT
        )
      }
    }

    // Default
    return new RpcError(message, RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT)
  }
}
