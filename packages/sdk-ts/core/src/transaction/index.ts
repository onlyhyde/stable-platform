/**
 * Transaction Module
 * Multi-mode transaction builders for EOA, EIP-7702, and Smart Account
 */

// Batch Transactions
export {
  // Builder
  BatchBuilder,
  type BatchExecutionOptions,
  type BatchMode,
  // Types
  type Call,
  type CallResult,
  type CallWithAllowFailure,
  calculateBatchValue,
  chunkBatch,
  createBatchBuilder,
  createBatchExecutionCalldata,
  // Utilities
  decodeMulticallResults,
  EXEC_MODE,
  type Execution,
  // Encoding
  encodeAggregate,
  encodeAggregate3,
  encodeAggregate3Value,
  encodeBatchExecution,
  encodeExecuteCall,
  encodeExecution,
  encodeTryAggregate,
  MULTICALL3_ABI,
  // Constants
  MULTICALL3_ADDRESSES,
  mergeBatches,
} from './batch'

// EIP-7702 Transaction Builder
export {
  type AuthorizationSigner,
  type BuiltEIP7702Transaction,
  createEIP7702TransactionBuilder,
  type DelegationRequest,
  type EIP7702TransactionBuilder,
  type EIP7702TransactionConfig,
} from './eip7702Transaction'
// EOA Transaction Builder
export {
  type BuiltEOATransaction,
  createEOATransactionBuilder,
  type EOATransactionBuilder,
  type EOATransactionConfig,
  type TransactionSigner,
} from './eoaTransaction'

// Transaction Strategies (for advanced usage)
export {
  type BaseStrategyConfig,
  type CombinedSigner,
  createEIP7702Strategy,
  // Strategies
  createEOAStrategy,
  createSmartAccountStrategy,
  createStrategyRegistry,
  type SmartAccountStrategyConfig,
  type StrategyExecuteOptions,
  type StrategyFactory,
  type StrategyPreparedTransaction,
  type StrategyRegistry,
  // Types
  type TransactionStrategy,
} from './strategies'
// Transaction Router
export {
  createTransactionRouter,
  type ExecuteOptions,
  type PreparedTransaction,
  type TransactionRouter,
  type TransactionRouterConfig,
} from './transactionRouter'
