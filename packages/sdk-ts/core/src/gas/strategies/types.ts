/**
 * Gas Estimation Strategy Types
 *
 * Strategy pattern interface for mode-specific gas estimation.
 * Follows OCP: new modes can be added without modifying existing code.
 */

import type {
  GasEstimate,
  MultiModeTransactionRequest,
  TransactionMode,
} from '@stablenet/sdk-types'
import type { RpcProvider } from '../../providers'

// ============================================================================
// Strategy Interface
// ============================================================================

/**
 * Gas estimation strategy configuration
 */
export interface GasStrategyConfig {
  /** RPC Provider for blockchain calls */
  provider: RpcProvider

  /** Chain ID */
  chainId: number

  /** Bundler URL (for Smart Account) */
  bundlerUrl?: string

  /** Paymaster URL */
  paymasterUrl?: string
}

/**
 * Gas price information (shared across strategies)
 */
export interface GasPrices {
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
 * Gas estimation strategy interface
 *
 * Each transaction mode has its own strategy implementation.
 * New modes can be added by implementing this interface.
 */
export interface GasEstimationStrategy {
  /** Transaction mode this strategy handles */
  readonly mode: TransactionMode

  /**
   * Check if this strategy supports the given request
   */
  supports(request: MultiModeTransactionRequest): boolean

  /**
   * Estimate gas for the request
   */
  estimate(request: MultiModeTransactionRequest, gasPrices: GasPrices): Promise<GasEstimate>
}

// ============================================================================
// Strategy Registry
// ============================================================================

/**
 * Gas estimation strategy registry
 *
 * Manages strategy registration and lookup.
 */
export interface GasStrategyRegistry {
  /** Register a strategy */
  register(strategy: GasEstimationStrategy): void

  /** Get strategy for a mode */
  getStrategy(mode: TransactionMode): GasEstimationStrategy | undefined

  /** Get all registered strategies */
  getAllStrategies(): GasEstimationStrategy[]
}

/**
 * Create a gas strategy registry
 */
export function createGasStrategyRegistry(): GasStrategyRegistry {
  const strategies = new Map<TransactionMode, GasEstimationStrategy>()

  return {
    register(strategy: GasEstimationStrategy): void {
      strategies.set(strategy.mode, strategy)
    },

    getStrategy(mode: TransactionMode): GasEstimationStrategy | undefined {
      return strategies.get(mode)
    },

    getAllStrategies(): GasEstimationStrategy[] {
      return Array.from(strategies.values())
    },
  }
}
