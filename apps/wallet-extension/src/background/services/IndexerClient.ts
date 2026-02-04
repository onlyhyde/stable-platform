/**
 * IndexerClient
 *
 * Re-exports the IndexerClient from @stablenet/core SDK.
 * This ensures consistent implementation across all StableNet products.
 *
 * The SDK IndexerClient provides:
 * - Token balance queries (ERC-20, ERC-721, ERC-1155)
 * - Transaction history
 * - Gas statistics
 * - ERC-20 transfer events
 */

// Re-export everything from SDK
export {
  IndexerClient,
  createIndexerClient,
  formatTokenBalance,
  parseTokenAmount,
  type IndexerClientConfig,
  type GasStats,
  type TokenBalance,
  type TokenTransfer,
  type IndexedTransaction,
  type PaginatedResult,
} from '@stablenet/core'

// Legacy type aliases for backward compatibility
export type IndexerConfig = import('@stablenet/core').IndexerClientConfig
export type IndexerTokenBalance = import('@stablenet/core').TokenBalance
export type ERC20Transfer = import('@stablenet/core').TokenTransfer
export type IndexerTransaction = import('@stablenet/core').IndexedTransaction
