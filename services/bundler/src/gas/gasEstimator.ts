import type { Address, PublicClient } from 'viem'
import type { GasEstimation, UserOperation } from '../types'
import type { Logger } from '../utils/logger'

/**
 * Entry Point ABI for simulation
 * @todo Use for actual simulation calls
 */
const _ENTRY_POINT_SIMULATE_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
        name: 'userOp',
        type: 'tuple',
      },
    ],
    name: 'simulateValidation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * Gas overhead constants
 */
const GAS_OVERHEAD = {
  /** Fixed overhead for EntryPoint handling */
  FIXED: 21000n,
  /** Per UserOp overhead */
  PER_USER_OP: 18300n,
  /** Per zero byte in calldata */
  ZERO_BYTE: 4n,
  /** Per non-zero byte in calldata */
  NON_ZERO_BYTE: 16n,
  /** Verification overhead buffer */
  VERIFICATION_BUFFER: 10000n,
  /** Call overhead buffer */
  CALL_BUFFER: 5000n,
}

/**
 * Gas estimator for UserOperations
 */
export class GasEstimator {
  private client: PublicClient
  private entryPoint: Address
  private logger: Logger

  constructor(client: PublicClient, entryPoint: Address, logger: Logger) {
    this.client = client
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'gasEstimator' })
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimate(userOp: UserOperation): Promise<GasEstimation> {
    this.logger.debug({ sender: userOp.sender }, 'Estimating gas for UserOp')

    // Calculate preVerificationGas
    const preVerificationGas = this.calculatePreVerificationGas(userOp)

    // Estimate verification gas
    const verificationGasLimit = await this.estimateVerificationGas(userOp)

    // Estimate call gas
    const callGasLimit = await this.estimateCallGas(userOp)

    // Estimate paymaster gas if paymaster is present
    let paymasterVerificationGasLimit: bigint | undefined
    let paymasterPostOpGasLimit: bigint | undefined

    if (userOp.paymaster) {
      paymasterVerificationGasLimit = await this.estimatePaymasterVerificationGas(
        userOp
      )
      paymasterPostOpGasLimit = await this.estimatePaymasterPostOpGas(userOp)
    }

    const estimation: GasEstimation = {
      preVerificationGas,
      verificationGasLimit,
      callGasLimit,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
    }

    this.logger.debug(
      { estimation: this.formatEstimation(estimation) },
      'Gas estimation complete'
    )

    return estimation
  }

  /**
   * Calculate preVerificationGas (calldata cost)
   */
  private calculatePreVerificationGas(userOp: UserOperation): bigint {
    // Serialize to calldata (simplified)
    const calldataBytes = this.serializeUserOp(userOp)

    let calldataGas = 0n
    for (let i = 0; i < calldataBytes.length; i++) {
      if (calldataBytes[i] === 0) {
        calldataGas += GAS_OVERHEAD.ZERO_BYTE
      } else {
        calldataGas += GAS_OVERHEAD.NON_ZERO_BYTE
      }
    }

    return calldataGas + GAS_OVERHEAD.FIXED + GAS_OVERHEAD.PER_USER_OP
  }

  /**
   * Estimate verification gas limit
   */
  private async estimateVerificationGas(
    userOp: UserOperation
  ): Promise<bigint> {
    // For accounts with factory (deployment), add deployment gas
    let baseGas = 100000n

    if (userOp.factory) {
      // Estimate factory deployment gas
      baseGas += 200000n
    }

    // Add buffer
    return baseGas + GAS_OVERHEAD.VERIFICATION_BUFFER
  }

  /**
   * Estimate call gas limit
   */
  private async estimateCallGas(userOp: UserOperation): Promise<bigint> {
    try {
      // Check if account is deployed
      const code = await this.client.getCode({ address: userOp.sender })
      const isDeployed = code !== undefined && code !== '0x'

      if (!isDeployed) {
        // Can't estimate for non-deployed account, use default
        return 100000n + GAS_OVERHEAD.CALL_BUFFER
      }

      // Estimate gas for the call
      const gasEstimate = await this.client.estimateGas({
        account: userOp.sender,
        to: userOp.sender,
        data: userOp.callData,
      })

      return gasEstimate + GAS_OVERHEAD.CALL_BUFFER
    } catch (error) {
      this.logger.warn({ error }, 'Failed to estimate call gas, using default')
      return 200000n + GAS_OVERHEAD.CALL_BUFFER
    }
  }

  /**
   * Estimate paymaster verification gas
   */
  private async estimatePaymasterVerificationGas(
    _userOp: UserOperation
  ): Promise<bigint> {
    // Default paymaster verification gas
    return 100000n
  }

  /**
   * Estimate paymaster postOp gas
   */
  private async estimatePaymasterPostOpGas(
    _userOp: UserOperation
  ): Promise<bigint> {
    // Default paymaster postOp gas
    return 50000n
  }

  /**
   * Serialize UserOperation for gas calculation
   */
  private serializeUserOp(userOp: UserOperation): Uint8Array {
    // Simplified serialization - in production, use actual packed format
    const json = JSON.stringify({
      sender: userOp.sender,
      nonce: userOp.nonce.toString(),
      factory: userOp.factory,
      factoryData: userOp.factoryData,
      callData: userOp.callData,
      signature: userOp.signature,
      paymaster: userOp.paymaster,
      paymasterData: userOp.paymasterData,
    })
    return new TextEncoder().encode(json)
  }

  /**
   * Format estimation for logging
   */
  private formatEstimation(est: GasEstimation): Record<string, string> {
    return {
      preVerificationGas: est.preVerificationGas.toString(),
      verificationGasLimit: est.verificationGasLimit.toString(),
      callGasLimit: est.callGasLimit.toString(),
      paymasterVerificationGasLimit:
        est.paymasterVerificationGasLimit?.toString() || 'N/A',
      paymasterPostOpGasLimit:
        est.paymasterPostOpGasLimit?.toString() || 'N/A',
    }
  }
}
