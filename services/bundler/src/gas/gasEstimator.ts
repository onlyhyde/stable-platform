import type { Address, Hex, PublicClient } from 'viem'
import { concat, encodeAbiParameters, encodeFunctionData, hexToBytes, pad, slice as sliceHex, toHex } from 'viem'
import { ENTRY_POINT_ABI } from '../abi'
import {
  ENTRY_POINT_SIMULATIONS_ABI,
  ENTRY_POINT_SIMULATIONS_BYTECODE,
} from '../abi/entryPointSimulations'
import type { GasEstimation, UserOperation } from '../types'
import type { Logger } from '../utils/logger'

/**
 * Gas estimator configuration
 */
export interface GasEstimatorConfig {
  /** Buffer percentage for verification gas (default: 10) */
  verificationGasBufferPercent?: number
  /** Buffer percentage for call gas (default: 10) */
  callGasBufferPercent?: number
  /** Buffer percentage for preVerification gas (default: 5) */
  preVerificationGasBufferPercent?: number
  /** Buffer percentage for paymaster verification gas (default: 10) */
  paymasterVerificationGasBufferPercent?: number
  /** Buffer percentage for paymaster postOp gas (default: 10) */
  paymasterPostOpGasBufferPercent?: number
  /** Fixed overhead for EntryPoint handling (default: 21000) */
  fixedOverhead?: bigint
  /** Per UserOp overhead (default: 18300) */
  perUserOpOverhead?: bigint
  /** Maximum iterations for binary search (default: 20) */
  maxBinarySearchIterations?: number
  /** Initial gas for binary search upper bound (default: 10_000_000) */
  initialGasUpperBound?: bigint
  /** Whether this is an L2 chain (default: false) */
  isL2Chain?: boolean
  /** L1 gas price for L2 data cost calculation (optional, fetched dynamically if not set) */
  l1GasPrice?: bigint
  /** L2 gas price for L1 data cost ratio (optional) */
  l2GasPrice?: bigint
  /** Gas to add for factory deployment in fallback estimation (default: 200000n) */
  factoryDeploymentGas?: bigint
  /** Whether EIP-7702 authorization is used (adds PER_AUTHORIZATION_GAS to preVerificationGas, default: false) */
  isEIP7702?: boolean
}

/**
 * Gas overhead constants
 */
const DEFAULT_GAS_OVERHEAD = {
  /** Fixed overhead for EntryPoint handling */
  FIXED: 21000n,
  /** Per UserOp overhead */
  PER_USER_OP: 18300n,
  /** Per zero byte in calldata */
  ZERO_BYTE: 4n,
  /** Per non-zero byte in calldata */
  NON_ZERO_BYTE: 16n,
  /** L1 data cost multiplier for L2 chains */
  L1_DATA_COST_MULTIPLIER: 16n,
  /** EIP-7702 per-authorization gas cost */
  PER_AUTHORIZATION_GAS: 25000n,
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  verificationGasBufferPercent: 10,
  callGasBufferPercent: 10,
  preVerificationGasBufferPercent: 5,
  paymasterVerificationGasBufferPercent: 10,
  paymasterPostOpGasBufferPercent: 10,
  fixedOverhead: DEFAULT_GAS_OVERHEAD.FIXED,
  perUserOpOverhead: DEFAULT_GAS_OVERHEAD.PER_USER_OP,
  maxBinarySearchIterations: 20,
  initialGasUpperBound: 10_000_000n,
  isL2Chain: false,
  l1GasPrice: undefined as bigint | undefined,
  l2GasPrice: undefined as bigint | undefined,
  factoryDeploymentGas: 200000n,
  isEIP7702: false,
}

type RequiredConfig = typeof DEFAULT_CONFIG

/**
 * Gas profiles for Kernel v0.3.3 module operations.
 * Maps function selector → fallback gas estimate when binary search fails.
 */
const MODULE_OP_GAS_PROFILES: Record<string, bigint> = {
  '0x856b02ec': 350000n, // forceUninstallModule — state cleanup + ExcessivelySafeCall (uninstall + 10% buffer)
  '0x166add9c': 600000n, // replaceModule — uninstall + install combined
  '0xb5c13e39': 25000n,  // setHookGasLimit — single storage write
  '0x19a6f00a': 25000n,  // setDelegatecallWhitelist — single mapping write
  '0xdb01ebce': 25000n,  // setEnforceDelegatecallWhitelist — single storage write
}

/**
 * Validate buffer percentage is within valid range
 */
function validateBufferPercent(value: number | undefined, name: string): void {
  if (value === undefined) return
  if (value < 0) {
    throw new Error(`${name} cannot be negative: ${value}`)
  }
  if (value > 100) {
    throw new Error(`${name} cannot exceed 100%: ${value}`)
  }
}

/**
 * Gas estimator for UserOperations
 * Uses simulation-based estimation with binary search for accurate gas limits
 */
export class GasEstimator {
  private client: PublicClient
  private entryPoint: Address
  private logger: Logger
  private config: RequiredConfig

  constructor(
    client: PublicClient,
    entryPoint: Address,
    logger: Logger,
    config: GasEstimatorConfig = {}
  ) {
    // Validate buffer percentages
    validateBufferPercent(config.verificationGasBufferPercent, 'verificationGasBufferPercent')
    validateBufferPercent(config.callGasBufferPercent, 'callGasBufferPercent')
    validateBufferPercent(config.preVerificationGasBufferPercent, 'preVerificationGasBufferPercent')
    validateBufferPercent(
      config.paymasterVerificationGasBufferPercent,
      'paymasterVerificationGasBufferPercent'
    )
    validateBufferPercent(config.paymasterPostOpGasBufferPercent, 'paymasterPostOpGasBufferPercent')

    this.client = client
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'gasEstimator' })
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimate(userOp: UserOperation): Promise<GasEstimation> {
    this.logger.debug({ sender: userOp.sender }, 'Estimating gas for UserOp')

    // Calculate preVerificationGas using packed format (includes L2 cost if applicable)
    const preVerificationGas = await this.calculatePreVerificationGas(userOp)

    // Estimate verification gas using binary search simulation
    const verificationGasLimit = await this.estimateVerificationGas(userOp)

    // Estimate call gas using simulateHandleOp
    const callGasLimit = await this.estimateCallGas(userOp)

    // Estimate paymaster gas if paymaster is present
    let paymasterVerificationGasLimit: bigint | undefined
    let paymasterPostOpGasLimit: bigint | undefined

    if (userOp.paymaster) {
      paymasterVerificationGasLimit = await this.estimatePaymasterVerificationGas(userOp)
      paymasterPostOpGasLimit = await this.estimatePaymasterPostOpGas(userOp)
    }

    const estimation: GasEstimation = {
      preVerificationGas,
      verificationGasLimit,
      callGasLimit,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
    }

    this.logger.debug({ estimation: this.formatEstimation(estimation) }, 'Gas estimation complete')

    return estimation
  }

  /**
   * Calculate preVerificationGas based on packed UserOp format
   * Includes L1 data cost for L2 chains
   */
  private async calculatePreVerificationGas(userOp: UserOperation): Promise<bigint> {
    // Pack UserOp for accurate byte calculation
    const packedBytes = this.packUserOpForGasCalculation(userOp)

    let calldataGas = 0n
    for (let i = 0; i < packedBytes.length; i++) {
      if (packedBytes[i] === 0) {
        calldataGas += DEFAULT_GAS_OVERHEAD.ZERO_BYTE
      } else {
        calldataGas += DEFAULT_GAS_OVERHEAD.NON_ZERO_BYTE
      }
    }

    let baseGas = calldataGas + this.config.fixedOverhead + this.config.perUserOpOverhead

    // Add EIP-7702 authorization gas (v0.9 spec requirement)
    if (this.config.isEIP7702) {
      baseGas += DEFAULT_GAS_OVERHEAD.PER_AUTHORIZATION_GAS
    }

    // Add L1 data cost for L2 chains
    if (this.config.isL2Chain) {
      const l1DataCost = await this.calculateL1DataCost(packedBytes)
      baseGas += l1DataCost
    }

    // Apply buffer
    const buffer = (baseGas * BigInt(this.config.preVerificationGasBufferPercent)) / 100n
    return baseGas + buffer
  }

  /**
   * Calculate L1 data posting cost for L2 chains
   */
  private async calculateL1DataCost(packedBytes: Uint8Array): Promise<bigint> {
    // Get L1 gas price (use configured or fetch dynamically)
    let l1GasPrice = this.config.l1GasPrice
    if (l1GasPrice === undefined) {
      try {
        l1GasPrice = await this.client.getGasPrice()
      } catch {
        // Fallback to a reasonable default
        l1GasPrice = 30000000000n // 30 gwei
      }
    }

    // Get L2 gas price for ratio calculation
    let l2GasPrice = this.config.l2GasPrice
    if (l2GasPrice === undefined) {
      l2GasPrice = 100000000n // 0.1 gwei default
    }

    // Calculate L1 data cost
    // Formula: (data_bytes * 16) * (l1_gas_price / l2_gas_price)
    const dataBytes = BigInt(packedBytes.length)
    const l1Gas = dataBytes * DEFAULT_GAS_OVERHEAD.L1_DATA_COST_MULTIPLIER

    // Convert L1 cost to L2 gas units
    // Prevent division by zero with minimum gas price threshold
    const MIN_GAS_PRICE = 1000000n // 0.001 gwei minimum
    if (l2GasPrice < MIN_GAS_PRICE) {
      this.logger.warn(
        { l2GasPrice: l2GasPrice.toString() },
        'L2 gas price below minimum threshold, using minimum'
      )
      l2GasPrice = MIN_GAS_PRICE
    }
    const l1CostInL2Gas = (l1Gas * l1GasPrice) / l2GasPrice

    return l1CostInL2Gas
  }

  /**
   * Pack UserOperation for gas calculation (v0.7 format)
   */
  private packUserOpForGasCalculation(userOp: UserOperation): Uint8Array {
    // Build initCode
    const initCode =
      userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

    // Build accountGasLimits (verificationGasLimit || callGasLimit)
    const accountGasLimits = concat([
      pad(toHex(userOp.verificationGasLimit), { size: 16 }),
      pad(toHex(userOp.callGasLimit), { size: 16 }),
    ])

    // Build gasFees (maxPriorityFeePerGas || maxFeePerGas)
    const gasFees = concat([
      pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
      pad(toHex(userOp.maxFeePerGas), { size: 16 }),
    ])

    // Build paymasterAndData
    let paymasterAndData: Hex = '0x'
    if (userOp.paymaster) {
      paymasterAndData = concat([
        userOp.paymaster,
        pad(toHex(userOp.paymasterVerificationGasLimit || 0n), { size: 16 }),
        pad(toHex(userOp.paymasterPostOpGasLimit || 0n), { size: 16 }),
        userOp.paymasterData || '0x',
      ])
    }

    // Encode as ABI-packed tuple (approximation for gas calculation)
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes' },
        { type: 'bytes' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes' },
        { type: 'bytes' },
      ],
      [
        userOp.sender,
        userOp.nonce,
        initCode as Hex,
        userOp.callData,
        accountGasLimits as Hex,
        userOp.preVerificationGas,
        gasFees as Hex,
        paymasterAndData,
        userOp.signature,
      ]
    )

    return hexToBytes(encoded)
  }

  /**
   * Estimate verification gas limit using binary search simulation
   */
  private async estimateVerificationGas(userOp: UserOperation): Promise<bigint> {
    // Try to use binary search simulation
    try {
      const estimatedGas = await this.binarySearchVerificationGas(userOp)
      // Apply buffer
      const buffer = (estimatedGas * BigInt(this.config.verificationGasBufferPercent)) / 100n
      return estimatedGas + buffer
    } catch (error) {
      this.logger.warn({ error }, 'Binary search simulation failed, using fallback estimation')
      return this.fallbackVerificationGasEstimate(userOp)
    }
  }

  /**
   * Binary search to find minimum verification gas
   */
  private async binarySearchVerificationGas(userOp: UserOperation): Promise<bigint> {
    let low = 10000n
    let high = this.config.initialGasUpperBound
    let found = false
    let result = high

    for (let i = 0; i < this.config.maxBinarySearchIterations; i++) {
      const mid = (low + high) / 2n

      const success = await this.trySimulateValidation(userOp, mid)

      if (success) {
        found = true
        result = mid
        high = mid - 1n
      } else {
        low = mid + 1n
      }

      // Early exit if range is small enough
      if (high - low < 1000n) {
        break
      }
    }

    if (!found) {
      throw new Error('Verification gas binary search: no simulation succeeded within gas range')
    }
    return result
  }

  /**
   * Try to simulate validation with a given gas limit.
   * Uses EntryPointSimulations via state override. Normal return = success, revert = failure.
   */
  private async trySimulateValidation(userOp: UserOperation, gasLimit: bigint): Promise<boolean> {
    try {
      const packedOp = this.packUserOpForSimulation({
        ...userOp,
        verificationGasLimit: gasLimit,
      })

      const calldata = encodeFunctionData({
        abi: ENTRY_POINT_SIMULATIONS_ABI,
        functionName: 'simulateValidation',
        args: [packedOp],
      })

      await this.client.call({
        to: this.entryPoint,
        data: calldata,
        gas: gasLimit,
        stateOverride: [
          {
            address: this.entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      // Normal return = validation succeeded
      return true
    } catch (error: unknown) {
      const errorStr = String(error)

      // Out of gas → gas limit was insufficient
      if (
        errorStr.includes('out of gas') ||
        errorStr.includes('OutOfGas') ||
        errorStr.includes('gas required exceeds')
      ) {
        return false
      }

      // FailedOp means validation logic failed (not gas) — gas was sufficient
      if (this.isFailedOpError(error)) {
        return true
      }

      // Execution revert with known signatures → gas was sufficient but logic failed
      if (
        errorStr.includes('execution reverted') ||
        errorStr.includes('revert') ||
        errorStr.includes('CALL_EXCEPTION')
      ) {
        return true
      }

      // Unknown error (network, state override unsupported, etc.) → propagate to trigger fallback
      throw error
    }
  }

  /**
   * Check if error is a FailedOp error
   */
  private isFailedOpError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const errObj = error as Record<string, unknown>
      if (typeof errObj.data === 'string') {
        // FailedOp selector: 0x220266b6
        // FailedOpWithRevert selector: 0x65c8fd4d
        return errObj.data.startsWith('0x220266b6') || errObj.data.startsWith('0x65c8fd4d')
      }
    }
    return false
  }

  /**
   * Pack UserOperation for simulation call
   */
  private packUserOpForSimulation(userOp: UserOperation): {
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
    const initCode =
      userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

    const accountGasLimits = concat([
      pad(toHex(userOp.verificationGasLimit), { size: 16 }),
      pad(toHex(userOp.callGasLimit), { size: 16 }),
    ])

    const gasFees = concat([
      pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
      pad(toHex(userOp.maxFeePerGas), { size: 16 }),
    ])

    let paymasterAndData: Hex = '0x'
    if (userOp.paymaster) {
      paymasterAndData = concat([
        userOp.paymaster,
        pad(toHex(userOp.paymasterVerificationGasLimit || 0n), { size: 16 }),
        pad(toHex(userOp.paymasterPostOpGasLimit || 0n), { size: 16 }),
        userOp.paymasterData || '0x',
      ])
    }

    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: initCode as Hex,
      callData: userOp.callData,
      accountGasLimits: accountGasLimits as Hex,
      preVerificationGas: userOp.preVerificationGas,
      gasFees: gasFees as Hex,
      paymasterAndData,
      signature: userOp.signature,
    }
  }

  /**
   * Fallback verification gas estimation (when simulation fails)
   */
  private fallbackVerificationGasEstimate(userOp: UserOperation): bigint {
    // Smart account validateUserOp typically needs 200k-400k gas
    // (ECDSA verification + storage reads + ERC-7579 validation hooks)
    let baseGas = 300000n

    if (userOp.factory) {
      // Add deployment gas (configurable)
      baseGas += this.config.factoryDeploymentGas
    }

    // Apply buffer
    const buffer = (baseGas * BigInt(this.config.verificationGasBufferPercent)) / 100n
    return baseGas + buffer
  }

  /**
   * Estimate call gas limit using simulateHandleOp
   */
  private async estimateCallGas(userOp: UserOperation): Promise<bigint> {
    try {
      // Check if account is deployed
      const code = await this.client.getCode({ address: userOp.sender })
      const isDeployed = code !== undefined && code !== '0x'

      if (!isDeployed) {
        // Can't estimate for non-deployed account, use default
        return this.applyCallGasBuffer(100000n)
      }

      // Try to use simulateHandleOp for accurate call gas estimation
      const estimatedGas = await this.binarySearchCallGas(userOp)
      return this.applyCallGasBuffer(estimatedGas)
    } catch (error) {
      this.logger.warn({ error }, 'Failed to estimate call gas, using fallback')
      return this.fallbackCallGasEstimate(userOp)
    }
  }

  /**
   * Binary search to find minimum call gas using simulateHandleOp
   */
  private async binarySearchCallGas(userOp: UserOperation): Promise<bigint> {
    let low = 21000n
    let high = this.config.initialGasUpperBound
    let found = false
    let result = high

    for (let i = 0; i < this.config.maxBinarySearchIterations; i++) {
      const mid = (low + high) / 2n

      const success = await this.trySimulateHandleOp(userOp, mid)

      if (success) {
        found = true
        result = mid
        high = mid - 1n
      } else {
        low = mid + 1n
      }

      // Early exit if range is small enough
      if (high - low < 1000n) {
        break
      }
    }

    if (!found) {
      throw new Error('Call gas binary search: no simulation succeeded within gas range')
    }
    return result
  }

  /**
   * Try to simulate handle op with a given gas limit.
   * Uses EntryPointSimulations via state override. Normal return = success.
   */
  private async trySimulateHandleOp(userOp: UserOperation, gasLimit: bigint): Promise<boolean> {
    try {
      const packedOp = this.packUserOpForSimulation({
        ...userOp,
        callGasLimit: gasLimit,
        verificationGasLimit: userOp.verificationGasLimit || this.config.initialGasUpperBound,
      })

      const calldata = encodeFunctionData({
        abi: ENTRY_POINT_SIMULATIONS_ABI,
        functionName: 'simulateHandleOp',
        args: [packedOp, userOp.sender, '0x'],
      })

      await this.client.call({
        to: this.entryPoint,
        data: calldata,
        gas: gasLimit + (userOp.verificationGasLimit || this.config.initialGasUpperBound),
        stateOverride: [
          {
            address: this.entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      // Normal return = execution completed successfully
      return true
    } catch (error: unknown) {
      const errorStr = String(error)

      // Out of gas → gas limit was insufficient
      if (
        errorStr.includes('out of gas') ||
        errorStr.includes('OutOfGas') ||
        errorStr.includes('gas required exceeds')
      ) {
        return false
      }

      // FailedOp means logic failed but gas was sufficient
      if (this.isFailedOpError(error)) {
        return true
      }

      // Execution revert with known signatures → gas was sufficient but logic failed
      if (
        errorStr.includes('execution reverted') ||
        errorStr.includes('revert') ||
        errorStr.includes('CALL_EXCEPTION')
      ) {
        return true
      }

      // Unknown error (network, state override unsupported, etc.) → propagate to trigger fallback
      throw error
    }
  }

  /**
   * Fallback call gas estimation (when simulateHandleOp fails)
   */
  private async fallbackCallGasEstimate(userOp: UserOperation): Promise<bigint> {
    try {
      // Try eth_estimateGas as fallback
      const gasEstimate = await this.client.estimateGas({
        account: userOp.sender,
        to: userOp.sender,
        data: userOp.callData,
      })
      return this.applyCallGasBuffer(gasEstimate)
    } catch {
      // Check for known module operation selectors with pre-computed gas profiles
      if (userOp.callData && userOp.callData.length >= 10) {
        const selector = sliceHex(userOp.callData, 0, 4)
        const profileGas = MODULE_OP_GAS_PROFILES[selector]
        if (profileGas !== undefined) {
          return this.applyCallGasBuffer(profileGas)
        }
      }
      // Last resort: return a reasonable default
      return this.applyCallGasBuffer(200000n)
    }
  }

  /**
   * Apply buffer to call gas estimate
   */
  private applyCallGasBuffer(gas: bigint): bigint {
    const buffer = (gas * BigInt(this.config.callGasBufferPercent)) / 100n
    return gas + buffer
  }

  /**
   * Estimate paymaster verification gas using binary search
   */
  private async estimatePaymasterVerificationGas(userOp: UserOperation): Promise<bigint> {
    try {
      // Use binary search with simulateValidation
      const estimatedGas = await this.binarySearchPaymasterVerificationGas(userOp)
      // Apply buffer
      const buffer =
        (estimatedGas * BigInt(this.config.paymasterVerificationGasBufferPercent)) / 100n
      return estimatedGas + buffer
    } catch (error) {
      this.logger.warn({ error }, 'Failed to estimate paymaster verification gas, using default')
      // Return reasonable default with buffer
      const defaultGas = 100000n
      const buffer = (defaultGas * BigInt(this.config.paymasterVerificationGasBufferPercent)) / 100n
      return defaultGas + buffer
    }
  }

  /**
   * Binary search to find minimum paymaster verification gas
   */
  private async binarySearchPaymasterVerificationGas(userOp: UserOperation): Promise<bigint> {
    let low = 10000n
    let high = 500000n // Paymasters typically need less gas
    let result = high

    for (let i = 0; i < this.config.maxBinarySearchIterations; i++) {
      const mid = (low + high) / 2n

      // Create a modified userOp with the test gas limit
      const testOp: UserOperation = {
        ...userOp,
        paymasterVerificationGasLimit: mid,
      }

      const success = await this.trySimulateValidation(testOp, this.config.initialGasUpperBound)

      if (success) {
        result = mid
        high = mid - 1n
      } else {
        low = mid + 1n
      }

      if (high - low < 1000n) {
        break
      }
    }

    return result
  }

  /**
   * Estimate paymaster postOp gas using simulation
   */
  private async estimatePaymasterPostOpGas(userOp: UserOperation): Promise<bigint> {
    try {
      // Use binary search with simulateHandleOp
      const estimatedGas = await this.binarySearchPaymasterPostOpGas(userOp)
      // Apply buffer
      const buffer = (estimatedGas * BigInt(this.config.paymasterPostOpGasBufferPercent)) / 100n
      return estimatedGas + buffer
    } catch (error) {
      this.logger.warn({ error }, 'Failed to estimate paymaster postOp gas, using default')
      // Return reasonable default with buffer
      const defaultGas = 50000n
      const buffer = (defaultGas * BigInt(this.config.paymasterPostOpGasBufferPercent)) / 100n
      return defaultGas + buffer
    }
  }

  /**
   * Binary search to find minimum paymaster postOp gas
   */
  private async binarySearchPaymasterPostOpGas(userOp: UserOperation): Promise<bigint> {
    let low = 5000n
    let high = 200000n // PostOp typically needs less gas than verification
    let result = high

    for (let i = 0; i < this.config.maxBinarySearchIterations; i++) {
      const mid = (low + high) / 2n

      // Create a modified userOp with the test gas limit
      const testOp: UserOperation = {
        ...userOp,
        paymasterPostOpGasLimit: mid,
      }

      const success = await this.trySimulateHandleOp(testOp, this.config.initialGasUpperBound)

      if (success) {
        result = mid
        high = mid - 1n
      } else {
        low = mid + 1n
      }

      if (high - low < 500n) {
        break
      }
    }

    return result
  }

  /**
   * Format estimation for logging
   */
  private formatEstimation(est: GasEstimation): Record<string, string> {
    return {
      preVerificationGas: est.preVerificationGas.toString(),
      verificationGasLimit: est.verificationGasLimit.toString(),
      callGasLimit: est.callGasLimit.toString(),
      paymasterVerificationGasLimit: est.paymasterVerificationGasLimit?.toString() || 'N/A',
      paymasterPostOpGasLimit: est.paymasterPostOpGasLimit?.toString() || 'N/A',
    }
  }
}
