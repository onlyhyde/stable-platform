/**
 * Transaction Strategies Module
 *
 * Strategy pattern implementations for multi-mode transactions.
 */

export { createEIP7702Strategy } from './eip7702Strategy'

// Strategies
export { createEOAStrategy } from './eoaStrategy'
export { createSmartAccountStrategy } from './smartAccountStrategy'
// Types
export {
  type BaseStrategyConfig,
  type CombinedSigner,
  createStrategyRegistry,
  type SmartAccountStrategyConfig,
  type StrategyExecuteOptions,
  type StrategyFactory,
  type StrategyPreparedTransaction,
  type StrategyRegistry,
  type TransactionStrategy,
} from './types'
