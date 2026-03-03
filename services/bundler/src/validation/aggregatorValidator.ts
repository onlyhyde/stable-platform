import type { Address, Hex, PublicClient } from 'viem'
import { AGGREGATOR_ABI, ENTRY_POINT_ABI } from '../abi'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import type {
  IAggregatorValidator,
  PackedUserOperation,
  StakeInfo,
  UserOpsPerAggregator,
} from './types'
import { VALIDATION_CONSTANTS } from './types'

/**
 * Input for groupByAggregator
 */
export interface UserOpWithAggregator {
  userOp: PackedUserOperation
  aggregator: Address
}

/**
 * Aggregator validator for ERC-4337 signature aggregation
 */
export class AggregatorValidator implements IAggregatorValidator {
  private publicClient: PublicClient
  private entryPoint: Address
  private logger: Logger

  constructor(publicClient: PublicClient, entryPoint: Address, logger: Logger) {
    this.publicClient = publicClient
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'aggregatorValidator' })
  }

  /**
   * Validate individual UserOp signature through aggregator
   * Returns the signature to be used for aggregation
   */
  async validateUserOpSignature(aggregator: Address, userOp: PackedUserOperation): Promise<Hex> {
    try {
      const result = await this.publicClient.readContract({
        address: aggregator,
        abi: AGGREGATOR_ABI,
        functionName: 'validateUserOpSignature',
        args: [this.toContractUserOp(userOp)],
      })

      return result as Hex
    } catch (error) {
      this.logger.warn({ aggregator, error }, 'Aggregator validateUserOpSignature failed')
      throw new RpcError(
        `Aggregator validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RPC_ERROR_CODES.UNSUPPORTED_AGGREGATOR
      )
    }
  }

  /**
   * Aggregate multiple UserOp signatures
   */
  async aggregateSignatures(aggregator: Address, userOps: PackedUserOperation[]): Promise<Hex> {
    if (userOps.length === 0) {
      return '0x' as Hex
    }

    try {
      const contractOps = userOps.map((op) => this.toContractUserOp(op))
      const result = await this.publicClient.readContract({
        address: aggregator,
        abi: AGGREGATOR_ABI,
        functionName: 'aggregateSignatures',
        args: [contractOps],
      })

      return result as Hex
    } catch (error) {
      this.logger.warn({ aggregator, error }, 'Aggregator aggregateSignatures failed')
      throw new RpcError(
        `Signature aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RPC_ERROR_CODES.UNSUPPORTED_AGGREGATOR
      )
    }
  }

  /**
   * Validate aggregated signature for multiple UserOps
   */
  async validateSignatures(
    aggregator: Address,
    userOps: PackedUserOperation[],
    signature: Hex
  ): Promise<void> {
    try {
      const contractOps = userOps.map((op) => this.toContractUserOp(op))
      await this.publicClient.readContract({
        address: aggregator,
        abi: AGGREGATOR_ABI,
        functionName: 'validateSignatures',
        args: [contractOps, signature],
      })
    } catch (error) {
      this.logger.warn({ aggregator, error }, 'Aggregator validateSignatures failed')
      throw new RpcError(
        `Aggregated signature validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RPC_ERROR_CODES.INVALID_SIGNATURE
      )
    }
  }

  /**
   * Get aggregator stake info from EntryPoint
   */
  async getAggregatorStakeInfo(aggregator: Address): Promise<StakeInfo> {
    const depositInfo = (await this.publicClient.readContract({
      address: this.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: 'getDepositInfo',
      args: [aggregator],
    })) as {
      deposit: bigint
      staked: boolean
      stake: bigint
      unstakeDelaySec: number
      withdrawTime: number
    }

    return {
      stake: depositInfo.stake,
      unstakeDelaySec: BigInt(depositInfo.unstakeDelaySec),
    }
  }

  /**
   * Check if aggregator is supported/valid
   */
  async isValidAggregator(aggregator: Address): Promise<boolean> {
    // Zero address means no aggregator
    if (aggregator === VALIDATION_CONSTANTS.ZERO_ADDRESS) {
      return false
    }

    // SIG_VALIDATION_FAILED marker
    if (aggregator === VALIDATION_CONSTANTS.SIG_VALIDATION_FAILED) {
      return false
    }

    // Check if aggregator has code
    const code = await this.publicClient.getCode({ address: aggregator })
    return code !== undefined && code !== '0x'
  }

  /**
   * Group userOps by their aggregator address
   */
  groupByAggregator(userOps: UserOpWithAggregator[]): Map<Address, PackedUserOperation[]> {
    const groups = new Map<Address, PackedUserOperation[]>()

    for (const { userOp, aggregator } of userOps) {
      const existing = groups.get(aggregator) || []
      existing.push(userOp)
      groups.set(aggregator, existing)
    }

    return groups
  }

  /**
   * Prepare UserOpsPerAggregator array for handleAggregatedOps
   */
  async prepareAggregatedOps(userOps: UserOpWithAggregator[]): Promise<UserOpsPerAggregator[]> {
    const groups = this.groupByAggregator(userOps)
    const result: UserOpsPerAggregator[] = []

    for (const [aggregator, ops] of groups) {
      const aggregatedSignature = await this.aggregateSignatures(aggregator, ops)

      result.push({
        userOps: ops,
        aggregator,
        signature: aggregatedSignature,
      })
    }

    return result
  }

  /**
   * Convert PackedUserOperation to contract-compatible format
   */
  private toContractUserOp(userOp: PackedUserOperation): {
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
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees: userOp.gasFees,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    }
  }
}
