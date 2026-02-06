/**
 * Transaction Strategy Types
 *
 * Strategy pattern interface for multi-mode transaction execution.
 * Follows OCP: new modes can be added without modifying existing code.
 */

import type {
  Account,
  GasEstimate,
  MultiModeTransactionRequest,
  TransactionMode,
  TransactionResult,
} from '@stablenet/sdk-types'
import type { Address, Hash } from 'viem'
import type { AuthorizationSigner } from '../eip7702Transaction'
import type { TransactionSigner } from '../eoaTransaction'

// ============================================================================
// Strategy Interface
// ============================================================================

/**
 * Transaction signer combining both EOA and Authorization signing capabilities
 */
export type CombinedSigner = TransactionSigner & AuthorizationSigner

/**
 * Prepared transaction from a strategy
 */
export interface StrategyPreparedTransaction {
  /** Transaction mode */
  mode: TransactionMode

  /** Original request */
  request: MultiModeTransactionRequest

  /** Gas estimate */
  gasEstimate: GasEstimate

  /** Mode-specific data (opaque to router) */
  strategyData?: unknown
}

/**
 * Options for executing a prepared transaction
 */
export interface StrategyExecuteOptions {
  /** Wait for confirmation */
  waitForConfirmation?: boolean

  /** Number of confirmations to wait */
  confirmations?: number

  /** Timeout in milliseconds */
  timeout?: number
}

/**
 * Transaction execution strategy
 *
 * Each strategy handles preparation and execution for a specific transaction mode.
 * Follows SRP: each strategy handles one mode only.
 */
export interface TransactionStrategy {
  /** The transaction mode this strategy handles */
  readonly mode: TransactionMode

  /**
   * Check if this strategy supports the given account
   */
  supports(account: Account): boolean

  /**
   * Validate the request for this mode
   */
  validate(request: MultiModeTransactionRequest, account: Account): void

  /**
   * Prepare a transaction for execution
   */
  prepare(
    request: MultiModeTransactionRequest,
    account: Account
  ): Promise<StrategyPreparedTransaction>

  /**
   * Execute a prepared transaction
   */
  execute(
    prepared: StrategyPreparedTransaction,
    signer: CombinedSigner,
    options?: StrategyExecuteOptions
  ): Promise<TransactionResult>

  /**
   * Wait for transaction confirmation
   */
  waitForConfirmation(
    hash: Hash,
    options?: { confirmations?: number; timeout?: number }
  ): Promise<void>
}

// ============================================================================
// Strategy Configuration
// ============================================================================

/**
 * Base configuration for all strategies
 */
export interface BaseStrategyConfig {
  /** RPC URL */
  rpcUrl: string

  /** Chain ID */
  chainId: number
}

/**
 * Smart Account strategy configuration
 */
export interface SmartAccountStrategyConfig extends BaseStrategyConfig {
  /** Bundler URL */
  bundlerUrl: string

  /** Paymaster URL (optional) */
  paymasterUrl?: string

  /** Entry point address */
  entryPointAddress?: Address
}

// ============================================================================
// Strategy Registry
// ============================================================================

/**
 * Strategy factory function type
 */
export type StrategyFactory<TConfig = BaseStrategyConfig> = (config: TConfig) => TransactionStrategy

/**
 * Strategy registry for managing available strategies
 */
export interface StrategyRegistry {
  /** Register a strategy */
  register(strategy: TransactionStrategy): void

  /** Get strategy for a mode */
  get(mode: TransactionMode): TransactionStrategy | undefined

  /** Get all registered strategies */
  getAll(): TransactionStrategy[]

  /** Check if a mode is supported */
  supports(mode: TransactionMode): boolean
}

/**
 * Create a strategy registry
 */
export function createStrategyRegistry(): StrategyRegistry {
  const strategies = new Map<TransactionMode, TransactionStrategy>()

  return {
    register(strategy: TransactionStrategy): void {
      strategies.set(strategy.mode, strategy)
    },

    get(mode: TransactionMode): TransactionStrategy | undefined {
      return strategies.get(mode)
    },

    getAll(): TransactionStrategy[] {
      return Array.from(strategies.values())
    },

    supports(mode: TransactionMode): boolean {
      return strategies.has(mode)
    },
  }
}
