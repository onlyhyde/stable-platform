import type {
  GasEstimate,
  MultiModeTransactionRequest,
  TransactionMode,
} from '@stablenet/sdk-types'
import type { Address } from 'viem'
import { formatGwei } from 'viem'
import { MAX_PRIORITY_FEE, MIN_PRIORITY_FEE } from '../config'
import { GasEstimationError } from '../errors'
import { createViemProvider, type RpcProvider } from '../providers'
import {
  createEIP7702GasStrategy,
  createEOAGasStrategy,
  createGasStrategyRegistry,
  createSmartAccountGasStrategy,
} from './strategies'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas estimator configuration
 */
export interface GasEstimatorConfig {
  /** RPC URL for the network (used if provider not specified) */
  rpcUrl?: string

  /** Chain ID */
  chainId: number

  /** Bundler RPC URL (for Smart Account mode) */
  bundlerUrl?: string

  /** Paymaster RPC URL (for sponsored/ERC20 gas) */
  paymasterUrl?: string

  /** RPC Provider instance (DIP: allows dependency injection) */
  provider?: RpcProvider
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
// Gas Estimator
// ============================================================================

/**
 * Create a multi-mode gas estimator
 *
 * Uses Strategy pattern (OCP) for extensible gas estimation.
 * New transaction modes can be added by registering new strategies.
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
  const { rpcUrl, chainId, bundlerUrl, provider: injectedProvider } = config

  // DIP: Use injected provider or create one from rpcUrl
  if (!injectedProvider && !rpcUrl) {
    throw new GasEstimationError('Either provider or rpcUrl must be provided', {
      operation: 'createGasEstimator',
      reason: 'MISSING_PROVIDER',
    })
  }

  const provider: RpcProvider =
    injectedProvider ??
    createViemProvider({
      rpcUrl: rpcUrl!,
      chainId,
    })

  // Create strategy config
  const strategyConfig = {
    provider,
    chainId,
    bundlerUrl,
    paymasterUrl: config.paymasterUrl,
  }

  // OCP: Create strategy registry and register built-in strategies
  const strategyRegistry = createGasStrategyRegistry()
  strategyRegistry.register(createEOAGasStrategy(strategyConfig))
  strategyRegistry.register(createEIP7702GasStrategy(strategyConfig))
  strategyRegistry.register(createSmartAccountGasStrategy(strategyConfig))

  /**
   * Get current gas prices from the network
   */
  async function getGasPrices(): Promise<GasPriceInfo> {
    const [block, gasPrice] = await Promise.all([
      provider.getBlock('latest'),
      provider.getGasPrice(),
    ])

    const baseFee = block.baseFeePerGas ?? 0n

    // Get priority fee
    let maxPriorityFeePerGas: bigint
    try {
      maxPriorityFeePerGas = await provider.estimateMaxPriorityFeePerGas()
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
   * Estimate gas based on transaction mode (OCP: uses strategy pattern)
   */
  async function estimate(request: MultiModeTransactionRequest): Promise<GasEstimate> {
    const strategy = strategyRegistry.getStrategy(request.mode)

    if (!strategy) {
      throw new GasEstimationError(`Unknown transaction mode: ${request.mode}`, {
        operation: 'estimate',
        reason: 'INVALID_MODE',
      })
    }

    const gasPrices = await getGasPrices()
    return strategy.estimate(request, gasPrices)
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

    const gasPrices = await getGasPrices()

    // Run all estimations in parallel using strategies
    const strategies = strategyRegistry.getAllStrategies()
    const estimatePromises = strategies.map(async (strategy) => {
      try {
        const fullRequest = {
          ...request,
          mode: strategy.mode,
        } as MultiModeTransactionRequest

        if (strategy.supports(fullRequest)) {
          return {
            mode: strategy.mode,
            estimate: await strategy.estimate(fullRequest, gasPrices),
          }
        }
        return { mode: strategy.mode, estimate: null }
      } catch {
        return { mode: strategy.mode, estimate: null }
      }
    })

    const estimateResults = await Promise.all(estimatePromises)

    for (const result of estimateResults) {
      results[result.mode] = result.estimate
    }

    return results
  }

  /**
   * Format gas estimate for display
   */
  function formatEstimate(gasEstimate: GasEstimate): {
    gasLimit: string
    maxFeePerGas: string
    estimatedCost: string
    estimatedCostEth: string
  } {
    return {
      gasLimit: gasEstimate.gasLimit.toString(),
      maxFeePerGas: `${formatGwei(gasEstimate.maxFeePerGas)} gwei`,
      estimatedCost: `${gasEstimate.estimatedCost.toString()} wei`,
      estimatedCostEth: `${(Number(gasEstimate.estimatedCost) / 1e18).toFixed(6)} ETH`,
    }
  }

  /**
   * Register a custom gas estimation strategy (OCP: extensibility point)
   */
  function registerStrategy(strategy: ReturnType<typeof createEOAGasStrategy>) {
    strategyRegistry.register(strategy)
  }

  return {
    estimate,
    estimateAllModes,
    getGasPrices,
    formatEstimate,
    registerStrategy,
    // Expose registry for advanced usage
    strategyRegistry,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type GasEstimator = ReturnType<typeof createGasEstimator>
