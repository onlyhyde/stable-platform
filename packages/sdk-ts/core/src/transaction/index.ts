/**
 * Transaction Module
 * Multi-mode transaction builders for EOA, EIP-7702, and Smart Account
 */

// EOA Transaction Builder
export {
  createEOATransactionBuilder,
  type EOATransactionBuilder,
  type EOATransactionConfig,
  type TransactionSigner,
  type BuiltEOATransaction,
} from './eoaTransaction'

// EIP-7702 Transaction Builder
export {
  createEIP7702TransactionBuilder,
  type EIP7702TransactionBuilder,
  type EIP7702TransactionConfig,
  type AuthorizationSigner,
  type DelegationRequest,
  type BuiltEIP7702Transaction,
} from './eip7702Transaction'

// Transaction Router
export {
  createTransactionRouter,
  type TransactionRouter,
  type TransactionRouterConfig,
  type PreparedTransaction,
  type ExecuteOptions,
} from './transactionRouter'

// Transaction Strategies (for advanced usage)
export {
  // Types
  type TransactionStrategy,
  type CombinedSigner,
  type StrategyPreparedTransaction,
  type StrategyExecuteOptions,
  type BaseStrategyConfig,
  type SmartAccountStrategyConfig,
  type StrategyFactory,
  type StrategyRegistry,
  createStrategyRegistry,
  // Strategies
  createEOAStrategy,
  createEIP7702Strategy,
  createSmartAccountStrategy,
} from './strategies'

// Batch Transactions
export {
  // Constants
  MULTICALL3_ADDRESSES,
  MULTICALL3_ABI,
  EXEC_MODE,
  // Builder
  BatchBuilder,
  createBatchBuilder,
  // Encoding
  encodeAggregate,
  encodeTryAggregate,
  encodeAggregate3,
  encodeAggregate3Value,
  encodeExecution,
  encodeBatchExecution,
  encodeExecuteCall,
  createBatchExecutionCalldata,
  // Utilities
  decodeMulticallResults,
  calculateBatchValue,
  mergeBatches,
  chunkBatch,
  // Types
  type Call,
  type CallWithAllowFailure,
  type CallResult,
  type BatchMode,
  type BatchExecutionOptions,
  type Execution,
} from './batch'
