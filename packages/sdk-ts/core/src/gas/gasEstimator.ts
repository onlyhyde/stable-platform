import type { Address, Hex } from 'viem'
import { createPublicClient, http, parseGwei, formatGwei } from 'viem'
import type {
  TransactionMode,
  GasEstimate,
  MultiModeTransactionRequest,
} from '@stablenet/sdk-types'
import { TRANSACTION_MODE, GAS_PAYMENT_TYPE } from '@stablenet/sdk-types'
import { GasEstimationError } from '../errors'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas estimator configuration
 */
export interface GasEstimatorConfig {
  /** RPC URL for the network */
  rpcUrl: string

  /** Chain ID */
  chainId: number

  /** Bundler RPC URL (for Smart Account mode) */
  bundlerUrl?: string

  /** Paymaster RPC URL (for sponsored/ERC20 gas) */
  paymasterUrl?: string
}

/**
 * Gas price information
 */
export interface GasPriceInfo {
  /** Base fee per gas */
  baseFee: bigint

  /** Max priority fee per gas */
  maxPriorityFeePerGas: bigint

  /** Max fee per gas (recommended) */
  maxFeePerGas: bigint

  /** Gas price for legacy transactions */
  gasPrice: bigint
}

/**
 * ERC20 gas payment estimate
 */
export interface ERC20GasEstimate extends GasEstimate {
  /** Token address for payment */
  tokenAddress: Address

  /** Token symbol */
  tokenSymbol: string

  /** Token decimals */
  tokenDecimals: number

  /** Estimated token amount for gas */
  tokenAmount: bigint

  /** Exchange rate: tokens per 1 ETH */
  exchangeRate: bigint
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum priority fee (1 gwei) */
const MIN_PRIORITY_FEE = parseGwei('1')

/** Maximum priority fee (50 gwei) - prevent overpaying */
const MAX_PRIORITY_FEE = parseGwei('50')

/** Gas buffer multiplier (10% extra) */
const GAS_BUFFER_MULTIPLIER = 110n
const GAS_BUFFER_DIVISOR = 100n

/** Base gas for simple ETH transfer */
const BASE_TRANSFER_GAS = 21_000n

/** Gas overhead for EIP-7702 authorization */
const EIP7702_AUTH_GAS = 25_000n

/** Gas per authorization in list */
const GAS_PER_AUTHORIZATION = 12_500n

/** Paymaster verification gas (typical) */
const PAYMASTER_VERIFICATION_GAS = 30_000n

/** Paymaster post-op gas (typical) */
const PAYMASTER_POST_OP_GAS = 50_000n

// ============================================================================
// Gas Estimator
// ============================================================================

/**
 * Create a multi-mode gas estimator
 *
 * @example
 * ```typescript
 * const estimator = createGasEstimator({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 *   bundlerUrl: 'https://bundler.example.com',
 * })
 *
 * const estimate = await estimator.estimate({
 *   mode: 'smartAccount',
 *   from: '0x...',
 *   to: '0x...',
 *   value: parseEther('1'),
 *   data: '0x',
 *   gasPayment: { type: 'sponsor' },
 * })
 * ```
 */
export function createGasEstimator(config: GasEstimatorConfig) {
  const { rpcUrl, bundlerUrl } = config

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })

  /**
   * Get current gas prices from the network
   */
  async function getGasPrices(): Promise<GasPriceInfo> {
    const [block, gasPrice] = await Promise.all([
      publicClient.getBlock({ blockTag: 'latest' }),
      publicClient.getGasPrice(),
    ])

    const baseFee = block.baseFeePerGas ?? 0n

    // Get priority fee
    let maxPriorityFeePerGas: bigint
    try {
      maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas()
    } catch {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }

    // Clamp priority fee
    if (maxPriorityFeePerGas < MIN_PRIORITY_FEE) {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }
    if (maxPriorityFeePerGas > MAX_PRIORITY_FEE) {
      maxPriorityFeePerGas = MAX_PRIORITY_FEE
    }

    // Max fee = 2 * baseFee + priorityFee (buffer for base fee fluctuation)
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

    return {
      baseFee,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasPrice,
    }
  }

  /**
   * Estimate gas for EOA transaction
   */
  async function estimateEOAGas(
    request: MultiModeTransactionRequest
  ): Promise<GasEstimate> {
    const prices = await getGasPrices()

    // Estimate gas limit
    let gasLimit: bigint
    try {
      gasLimit = await publicClient.estimateGas({
        account: request.from,
        to: request.to,
        value: request.value,
        data: request.data,
      })
    } catch (error) {
      // Fallback to base transfer gas for simple transfers
      if (!request.data || request.data === '0x') {
        gasLimit = BASE_TRANSFER_GAS
      } else {
        throw new GasEstimationError(
          `EOA gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { operation: 'estimateEOAGas', reason: 'ESTIMATION_FAILED' }
        )
      }
    }

    // Apply buffer
    gasLimit = (gasLimit * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

    return {
      gasLimit,
      maxFeePerGas: prices.maxFeePerGas,
      maxPriorityFeePerGas: prices.maxPriorityFeePerGas,
      estimatedCost: gasLimit * prices.maxFeePerGas,
    }
  }

  /**
   * Estimate gas for EIP-7702 transaction
   */
  async function estimateEIP7702Gas(
    request: MultiModeTransactionRequest
  ): Promise<GasEstimate> {
    const prices = await getGasPrices()

    // Base EOA estimation
    let baseGas: bigint
    try {
      baseGas = await publicClient.estimateGas({
        account: request.from,
        to: request.to,
        value: request.value,
        data: request.data,
      })
    } catch {
      baseGas = BASE_TRANSFER_GAS
    }

    // Add EIP-7702 specific overhead
    const authCount = request.authorizationList?.length ?? 1
    const authGas = EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * BigInt(authCount)

    const gasLimit =
      ((baseGas + authGas) * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

    return {
      gasLimit,
      maxFeePerGas: prices.maxFeePerGas,
      maxPriorityFeePerGas: prices.maxPriorityFeePerGas,
      estimatedCost: gasLimit * prices.maxFeePerGas,
    }
  }

  /**
   * Estimate gas for Smart Account (UserOperation)
   */
  async function estimateSmartAccountGas(
    request: MultiModeTransactionRequest
  ): Promise<GasEstimate> {
    if (!bundlerUrl) {
      throw new GasEstimationError(
        'Bundler URL required for Smart Account gas estimation',
        { operation: 'estimateSmartAccountGas', reason: 'BUNDLER_NOT_CONFIGURED' }
      )
    }

    const prices = await getGasPrices()

    // For now, use simplified estimation
    // Real implementation would call bundler's eth_estimateUserOperationGas
    let callGasLimit: bigint
    try {
      callGasLimit = await publicClient.estimateGas({
        account: request.from,
        to: request.to,
        value: request.value,
        data: request.data,
      })
    } catch {
      callGasLimit = BASE_TRANSFER_GAS * 2n
    }

    // Apply buffer
    callGasLimit = (callGasLimit * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

    // Standard verification gas limits
    const verificationGasLimit = 150_000n
    const preVerificationGas = 50_000n

    // Add paymaster gas if needed
    let paymasterVerificationGasLimit = 0n
    let paymasterPostOpGasLimit = 0n

    if (request.gasPayment?.type !== GAS_PAYMENT_TYPE.NATIVE) {
      paymasterVerificationGasLimit = PAYMASTER_VERIFICATION_GAS
      paymasterPostOpGasLimit = PAYMASTER_POST_OP_GAS
    }

    // Total gas
    const totalGas =
      preVerificationGas +
      verificationGasLimit +
      callGasLimit +
      paymasterVerificationGasLimit +
      paymasterPostOpGasLimit

    // For sponsored transactions, user cost is 0
    const isSponsoredOrERC20 =
      request.gasPayment?.type === GAS_PAYMENT_TYPE.SPONSOR ||
      request.gasPayment?.type === GAS_PAYMENT_TYPE.ERC20

    return {
      gasLimit: totalGas,
      maxFeePerGas: prices.maxFeePerGas,
      maxPriorityFeePerGas: prices.maxPriorityFeePerGas,
      estimatedCost: isSponsoredOrERC20 ? 0n : totalGas * prices.maxFeePerGas,
      // Smart Account specific fields
      preVerificationGas,
      verificationGasLimit,
      callGasLimit,
      paymasterVerificationGasLimit:
        paymasterVerificationGasLimit > 0n
          ? paymasterVerificationGasLimit
          : undefined,
      paymasterPostOpGasLimit:
        paymasterPostOpGasLimit > 0n ? paymasterPostOpGasLimit : undefined,
    }
  }

  /**
   * Estimate gas based on transaction mode
   */
  async function estimate(
    request: MultiModeTransactionRequest
  ): Promise<GasEstimate> {
    switch (request.mode) {
      case TRANSACTION_MODE.EOA:
        return estimateEOAGas(request)

      case TRANSACTION_MODE.EIP7702:
        return estimateEIP7702Gas(request)

      case TRANSACTION_MODE.SMART_ACCOUNT:
        return estimateSmartAccountGas(request)

      default:
        throw new GasEstimationError(`Unknown transaction mode: ${request.mode}`, {
          operation: 'estimate',
          reason: 'INVALID_MODE',
        })
    }
  }

  /**
   * Estimate gas for all available modes (for mode comparison UI)
   */
  async function estimateAllModes(
    request: Omit<MultiModeTransactionRequest, 'mode'>
  ): Promise<Record<TransactionMode, GasEstimate | null>> {
    const results: Record<TransactionMode, GasEstimate | null> = {
      eoa: null,
      eip7702: null,
      smartAccount: null,
    }

    // Run all estimations in parallel
    const [eoaResult, eip7702Result, smartAccountResult] =
      await Promise.allSettled([
        estimateEOAGas({
          ...request,
          mode: 'eoa',
        } as MultiModeTransactionRequest),
        estimateEIP7702Gas({
          ...request,
          mode: 'eip7702',
        } as MultiModeTransactionRequest),
        bundlerUrl
          ? estimateSmartAccountGas({
              ...request,
              mode: 'smartAccount',
            } as MultiModeTransactionRequest)
          : Promise.reject(new Error('Bundler not configured')),
      ])

    if (eoaResult.status === 'fulfilled') {
      results.eoa = eoaResult.value
    }
    if (eip7702Result.status === 'fulfilled') {
      results.eip7702 = eip7702Result.value
    }
    if (smartAccountResult.status === 'fulfilled') {
      results.smartAccount = smartAccountResult.value
    }

    return results
  }

  /**
   * Format gas estimate for display
   */
  function formatEstimate(estimate: GasEstimate): {
    gasLimit: string
    maxFeePerGas: string
    estimatedCost: string
    estimatedCostEth: string
  } {
    return {
      gasLimit: estimate.gasLimit.toString(),
      maxFeePerGas: formatGwei(estimate.maxFeePerGas) + ' gwei',
      estimatedCost: estimate.estimatedCost.toString() + ' wei',
      estimatedCostEth:
        (Number(estimate.estimatedCost) / 1e18).toFixed(6) + ' ETH',
    }
  }

  return {
    estimate,
    estimateAllModes,
    estimateEOAGas,
    estimateEIP7702Gas,
    estimateSmartAccountGas,
    getGasPrices,
    formatEstimate,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type GasEstimator = ReturnType<typeof createGasEstimator>
