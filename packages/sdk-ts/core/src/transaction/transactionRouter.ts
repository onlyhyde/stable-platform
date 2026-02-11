/**
 * Transaction Router
 *
 * Multi-mode transaction orchestrator using Strategy pattern.
 * Follows SRP: only handles mode resolution and strategy coordination.
 * Follows OCP: new modes can be added by registering new strategies.
 * Follows DIP: depends on TransactionStrategy abstraction.
 */

import type {
  Account,
  GasEstimate,
  MultiModeTransactionRequest,
  TransactionMode,
} from '@stablenet/sdk-types'
import {
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  TRANSACTION_MODE,
} from '@stablenet/sdk-types'
import type { Address } from 'viem'
import { createTransactionError } from '../errors'
import { createGasEstimator, type GasEstimator } from '../gas'
import {
  type CombinedSigner,
  createEIP7702Strategy,
  createEOAStrategy,
  createSmartAccountStrategy,
  createStrategyRegistry,
  type StrategyExecuteOptions,
  type StrategyPreparedTransaction,
  type StrategyRegistry,
  type TransactionStrategy,
} from './strategies'

// Re-export for backwards compatibility
export type { CombinedSigner as TransactionSigner } from './strategies'

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction router configuration
 */
export interface TransactionRouterConfig {
  /** RPC URL for the network */
  rpcUrl: string

  /** Chain ID */
  chainId: number

  /** Bundler RPC URL (required for Smart Account mode) */
  bundlerUrl?: string

  /** Paymaster RPC URL (required for sponsored/ERC20 gas) */
  paymasterUrl?: string

  /** Entry point address for ERC-4337 */
  entryPointAddress?: Address
}

/**
 * Prepared transaction ready for execution
 */
export interface PreparedTransaction extends StrategyPreparedTransaction {
  /** Original request with resolved mode */
  request: MultiModeTransactionRequest
}

/**
 * Transaction execution options
 */
export interface ExecuteOptions extends StrategyExecuteOptions {}

// ============================================================================
// Transaction Router Implementation
// ============================================================================

/**
 * Create a multi-mode transaction router
 *
 * @example
 * ```typescript
 * const router = createTransactionRouter({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 *   bundlerUrl: 'https://bundler.example.com',
 *   paymasterUrl: 'https://paymaster.example.com',
 * })
 *
 * // Prepare and execute
 * const prepared = await router.prepare(request, account)
 * const result = await router.execute(prepared, signer)
 * ```
 */
export function createTransactionRouter(config: TransactionRouterConfig) {
  const { rpcUrl, chainId, bundlerUrl, paymasterUrl, entryPointAddress } = config

  // Create strategy registry
  const strategyRegistry: StrategyRegistry = createStrategyRegistry()

  // Register strategies
  strategyRegistry.register(createEOAStrategy({ rpcUrl, chainId }))
  strategyRegistry.register(createEIP7702Strategy({ rpcUrl, chainId }))

  // Only register Smart Account strategy if bundler URL is provided
  if (bundlerUrl) {
    strategyRegistry.register(
      createSmartAccountStrategy({
        rpcUrl,
        chainId,
        bundlerUrl,
        paymasterUrl,
        entryPointAddress,
      })
    )
  }

  // Create gas estimator for multi-mode estimation
  const gasEstimator: GasEstimator = createGasEstimator({
    rpcUrl,
    chainId,
    bundlerUrl,
    paymasterUrl,
  })

  /**
   * Get strategy for a mode (throws if not available)
   */
  function getStrategy(mode: TransactionMode): TransactionStrategy {
    const strategy = strategyRegistry.get(mode)

    if (!strategy) {
      throw createTransactionError(`No strategy available for mode '${mode}'`, {
        reason: 'UNSUPPORTED_MODE',
      })
    }

    return strategy
  }

  /**
   * Validate that the requested mode is available for the account
   */
  function validateMode(mode: TransactionMode, account: Account): void {
    const availableModes = getAvailableTransactionModes(account)

    if (!availableModes.includes(mode)) {
      throw createTransactionError(
        `Transaction mode '${mode}' is not available for account type '${account.type}'. ` +
          `Available modes: ${availableModes.join(', ')}`,
        { reason: 'INVALID_MODE' }
      )
    }

    // Get the strategy and check if it supports this account
    const strategy = getStrategy(mode)
    if (!strategy.supports(account)) {
      throw createTransactionError(
        `Transaction mode '${mode}' does not support this account configuration`,
        { reason: 'ACCOUNT_NOT_SUPPORTED' }
      )
    }

    // Additional validation for Smart Account mode
    if (mode === TRANSACTION_MODE.SMART_ACCOUNT && !bundlerUrl) {
      throw createTransactionError('Bundler URL is required for Smart Account mode', {
        reason: 'BUNDLER_NOT_CONFIGURED',
      })
    }
  }

  /**
   * Resolve the transaction mode based on account state and preferences
   */
  function resolveMode(request: MultiModeTransactionRequest, account: Account): TransactionMode {
    // If mode is explicitly specified, validate and use it
    if (request.mode) {
      validateMode(request.mode, account)
      return request.mode
    }

    // Otherwise, use default for account type
    return getDefaultTransactionMode(account)
  }

  /**
   * Prepare a transaction for execution
   */
  async function prepare(
    request: MultiModeTransactionRequest,
    account: Account
  ): Promise<PreparedTransaction> {
    // Resolve mode
    const mode = resolveMode(request, account)

    // Get the appropriate strategy
    const strategy = getStrategy(mode)

    // Delegate to strategy
    const prepared = await strategy.prepare(request, account)

    return {
      ...prepared,
      request: { ...request, mode },
    }
  }

  /**
   * Execute a prepared transaction
   */
  async function execute(
    prepared: PreparedTransaction,
    signer: CombinedSigner,
    options: ExecuteOptions = {}
  ) {
    // Get the appropriate strategy
    const strategy = getStrategy(prepared.mode)

    // Delegate to strategy
    return strategy.execute(prepared, signer, options)
  }

  /**
   * Get all available modes for an account with gas estimates
   */
  async function getAvailableModesWithEstimates(
    request: Omit<MultiModeTransactionRequest, 'mode'>,
    account: Account
  ): Promise<Array<{ mode: TransactionMode; estimate: GasEstimate; available: boolean }>> {
    const availableModes = getAvailableTransactionModes(account)
    const estimates = await gasEstimator.estimateAllModes(request)

    return Object.entries(estimates).map(([mode, estimate]) => {
      const transactionMode = mode as TransactionMode
      const strategy = strategyRegistry.get(transactionMode)

      return {
        mode: transactionMode,
        estimate: estimate ?? {
          gasLimit: 0n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
          estimatedCost: 0n,
        },
        available:
          availableModes.includes(transactionMode) &&
          estimate !== null &&
          strategy !== undefined &&
          strategy.supports(account),
      }
    })
  }

  /**
   * Get supported modes
   */
  function getSupportedModes(): TransactionMode[] {
    return strategyRegistry.getAll().map((s) => s.mode)
  }

  /**
   * Check if a mode is supported
   */
  function isSupported(mode: TransactionMode): boolean {
    return strategyRegistry.supports(mode)
  }

  /**
   * Register a custom strategy
   */
  function registerStrategy(strategy: TransactionStrategy): void {
    strategyRegistry.register(strategy)
  }

  return {
    // Core operations
    prepare,
    execute,
    resolveMode,
    validateMode,
    getAvailableModesWithEstimates,

    // Configuration
    getSupportedModes,
    isSupported,
    registerStrategy,

    // Expose underlying components for advanced usage
    gasEstimator,
    strategyRegistry,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type TransactionRouter = ReturnType<typeof createTransactionRouter>
