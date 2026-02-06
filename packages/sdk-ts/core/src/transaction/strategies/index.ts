/**
 * Transaction Strategies Module
 *
 * Strategy pattern implementations for multi-mode transactions.
 */

// Types
export {
  type TransactionStrategy,
  type CombinedSigner,
  type StrategyPreparedTransaction,
  type StrategyExecuteOptions,
  type BaseStrategyConfig,
  type SmartAccountStrategyConfig,
  type StrategyFactory,
  type StrategyRegistry,
  createStrategyRegistry,
} from './types'

// Strategies
export { createEOAStrategy } from './eoaStrategy'
export { createEIP7702Strategy } from './eip7702Strategy'
export { createSmartAccountStrategy } from './smartAccountStrategy'
