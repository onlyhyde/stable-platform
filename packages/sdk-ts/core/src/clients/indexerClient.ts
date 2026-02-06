/**
 * IndexerClient
 *
 * Client for interacting with blockchain indexer APIs (GraphQL/JSON-RPC).
 * Provides token balances, transaction history, and other indexed data.
 *
 * This client is designed to work with indexer-go compatible APIs.
 */

import { DEFAULT_INDEXER_TIMEOUT } from '../config'
import { SDK_ERROR_CODES, SdkError } from '../errors'

/**
 * Indexer client configuration
 */
export interface IndexerClientConfig {
  /** Base URL of the indexer API */
  baseUrl: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Gas statistics from indexer
 */
export interface GasStats {
  totalGasUsed: string
  totalGasLimit: string
  averageGasUsed: string
  averageGasPrice: string
  blockCount: number
  transactionCount: number
}

/**
 * Token balance from indexer
 */
export interface TokenBalance {
  /** Token contract address */
  address: string
  /** Raw balance in smallest unit */
  balance: string
  /** Token type */
  tokenType: 'ERC20' | 'ERC721' | 'ERC1155'
  /** Token symbol */
  symbol?: string
  /** Token decimals */
  decimals?: number
  /** Token name */
  name?: string
}

/**
 * ERC-20 transfer event
 */
export interface TokenTransfer {
  /** Token contract address */
  contractAddress: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Transfer value in smallest unit */
  value: string
  /** Transaction hash */
  transactionHash: string
  /** Block number */
  blockNumber: number
  /** Log index in block */
  logIndex: number
  /** Unix timestamp */
  timestamp: number
}

/**
 * Transaction from indexer
 */
export interface IndexedTransaction {
  /** Transaction hash */
  hash: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Value in wei */
  value: string
  /** Gas price in wei */
  gasPrice: string
  /** Gas used */
  gasUsed: string
  /** Block number */
  blockNumber: number
  /** Unix timestamp */
  timestamp: number
  /** Transaction status (1 = success, 0 = failed) */
  status: number
}

/**
 * Pagination result
 */
export interface PaginatedResult<T> {
  nodes: T[]
  pageInfo: {
    hasNextPage: boolean
    endCursor?: string
  }
}

/**
 * IndexerClient
 *
 * Provides access to indexed blockchain data via GraphQL and JSON-RPC APIs.
 *
 * @example
 * ```typescript
 * const indexer = createIndexerClient({ baseUrl: 'https://indexer.example.com' })
 *
 * // Get token balances
 * const balances = await indexer.getTokenBalances('0x...')
 *
 * // Get transaction history
 * const txs = await indexer.getTransactionsByAddress('0x...')
 * ```
 */
export class IndexerClient {
  private baseUrl: string
  private timeout: number

  constructor(config: IndexerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout ?? DEFAULT_INDEXER_TIMEOUT
  }

  /**
   * Update base URL (e.g., when network changes)
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Execute GraphQL query
   */
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new SdkError({
          code: SDK_ERROR_CODES.RPC_ERROR,
          message: `GraphQL request failed: ${response.status}`,
          context: { operation: 'indexerClient.graphql' },
        })
      }

      const result = await response.json()

      if (result.errors) {
        throw new SdkError({
          code: SDK_ERROR_CODES.RPC_ERROR,
          message: result.errors[0]?.message ?? 'GraphQL error',
          context: { operation: 'indexerClient.graphql' },
        })
      }

      return result.data as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SdkError({
          code: SDK_ERROR_CODES.NETWORK_ERROR,
          message: 'Request timeout',
          context: { operation: 'indexerClient.graphql' },
        })
      }
      throw error
    }
  }

  /**
   * Execute JSON-RPC call
   */
  private async rpc<T>(method: string, params?: unknown[]): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: params ?? [],
          id: Date.now(),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new SdkError({
          code: SDK_ERROR_CODES.RPC_ERROR,
          message: `RPC request failed (${method}): ${response.status}`,
          context: { operation: `indexerClient.rpc.${method}` },
        })
      }

      const result = await response.json()

      if (result.error) {
        throw new SdkError({
          code: SDK_ERROR_CODES.RPC_ERROR,
          message: result.error.message ?? `RPC error (${method})`,
          context: { operation: `indexerClient.rpc.${method}` },
        })
      }

      return result.result as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SdkError({
          code: SDK_ERROR_CODES.NETWORK_ERROR,
          message: `Request timeout (${method})`,
          context: { operation: `indexerClient.rpc.${method}` },
        })
      }
      throw error
    }
  }

  // ============================================
  // Gas Fee APIs
  // ============================================

  /**
   * Get gas statistics for a block range
   */
  async getGasStats(fromBlock: number, toBlock: number): Promise<GasStats> {
    const query = `
      query GetGasStats($fromBlock: String!, $toBlock: String!) {
        gasStats(fromBlock: $fromBlock, toBlock: $toBlock) {
          totalGasUsed
          totalGasLimit
          averageGasUsed
          averageGasPrice
          blockCount
          transactionCount
        }
      }
    `

    const result = await this.graphql<{ gasStats: GasStats }>(query, {
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
    })

    return result.gasStats
  }

  /**
   * Get latest block height
   */
  async getLatestHeight(): Promise<number> {
    const result = await this.rpc<{ height: number }>('getLatestHeight')
    return result.height
  }

  /**
   * Get average gas price from recent blocks
   */
  async getAverageGasPrice(blockCount = 50): Promise<string> {
    const latestHeight = await this.getLatestHeight()
    const fromBlock = Math.max(0, latestHeight - blockCount)
    const stats = await this.getGasStats(fromBlock, latestHeight)
    return stats.averageGasPrice
  }

  // ============================================
  // Token APIs
  // ============================================

  /**
   * Get all token balances for an address
   *
   * @param address - Wallet address
   * @param tokenType - Optional filter by token type
   * @returns Array of token balances
   */
  async getTokenBalances(
    address: string,
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'
  ): Promise<TokenBalance[]> {
    const query = `
      query GetTokenBalances($address: String!, $tokenType: String) {
        tokenBalances(address: $address, tokenType: $tokenType) {
          address
          balance
          tokenType
          symbol
          decimals
          name
        }
      }
    `

    const result = await this.graphql<{ tokenBalances: TokenBalance[] }>(query, {
      address,
      tokenType,
    })

    return result.tokenBalances ?? []
  }

  /**
   * Get ERC-20 transfers for an address
   *
   * @param address - Wallet address
   * @param isFrom - If true, get transfers FROM this address; if false, get transfers TO this address
   * @param limit - Maximum number of results
   * @param offset - Result offset for pagination
   */
  async getERC20Transfers(
    address: string,
    isFrom = true,
    limit = 100,
    offset = 0
  ): Promise<TokenTransfer[]> {
    const result = await this.rpc<TokenTransfer[]>('getERC20TransfersByAddress', [
      address,
      isFrom,
      limit,
      offset,
    ])

    return result ?? []
  }

  /**
   * Get all ERC-20 transfers (sent and received) for an address
   *
   * @param address - Wallet address
   * @param limit - Maximum number of results (applied to merged list)
   */
  async getAllERC20Transfers(address: string, limit = 50): Promise<TokenTransfer[]> {
    const [sent, received] = await Promise.all([
      this.getERC20Transfers(address, true, limit),
      this.getERC20Transfers(address, false, limit),
    ])

    // Merge and sort by timestamp (newest first)
    const all = [...sent, ...received]
    all.sort((a, b) => b.timestamp - a.timestamp)

    return all.slice(0, limit)
  }

  /**
   * Get transfers for a specific token contract
   */
  async getTokenTransfers(tokenAddress: string, limit = 100, offset = 0): Promise<TokenTransfer[]> {
    const result = await this.rpc<TokenTransfer[]>('getERC20TransfersByToken', [
      tokenAddress,
      limit,
      offset,
    ])

    return result ?? []
  }

  // ============================================
  // Transaction APIs
  // ============================================

  /**
   * Get transactions for an address
   *
   * @param address - Wallet address
   * @param limit - Maximum number of results
   * @param offset - Result offset for pagination
   */
  async getTransactionsByAddress(
    address: string,
    limit = 50,
    offset = 0
  ): Promise<PaginatedResult<IndexedTransaction>> {
    const query = `
      query GetTransactions($address: String!, $limit: Int, $offset: Int) {
        transactionsByAddress(
          address: $address
          pagination: { limit: $limit, offset: $offset }
        ) {
          nodes {
            hash
            from
            to
            value
            gasPrice
            gasUsed
            blockNumber
            timestamp
            status
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `

    const result = await this.graphql<{
      transactionsByAddress: PaginatedResult<IndexedTransaction>
    }>(query, { address, limit, offset })

    return result.transactionsByAddress
  }

  /**
   * Get native balance at a specific block
   *
   * @param address - Wallet address
   * @param blockNumber - Optional block number (defaults to latest)
   */
  async getBalanceAtBlock(address: string, blockNumber?: number): Promise<string> {
    const query = `
      query GetBalance($address: String!, $blockNumber: String) {
        addressBalance(address: $address, blockNumber: $blockNumber)
      }
    `

    const result = await this.graphql<{ addressBalance: string }>(query, {
      address,
      blockNumber: blockNumber?.toString(),
    })

    return result.addressBalance
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check if indexer is available and responding
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getLatestHeight()
      return true
    } catch {
      return false
    }
  }
}

/**
 * Create an IndexerClient instance
 *
 * @param config - Client configuration or base URL string
 * @returns IndexerClient instance
 *
 * @example
 * ```typescript
 * // With config object
 * const client = createIndexerClient({
 *   baseUrl: 'https://indexer.example.com',
 *   timeout: 10000
 * })
 *
 * // With just URL
 * const client = createIndexerClient('https://indexer.example.com')
 * ```
 */
export function createIndexerClient(config: IndexerClientConfig | string): IndexerClient {
  if (typeof config === 'string') {
    return new IndexerClient({ baseUrl: config })
  }
  return new IndexerClient(config)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format token balance with decimals
 *
 * @param balance - Raw balance string
 * @param decimals - Token decimals
 * @returns Formatted balance string
 */
export function formatTokenBalance(balance: string, decimals: number): string {
  if (balance === '0') return '0'

  const bn = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = bn / divisor
  const remainder = bn % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '')

  return `${whole}.${trimmed}`
}

/**
 * Parse formatted token amount to raw balance
 *
 * @param amount - Formatted amount string (e.g., "1.5")
 * @param decimals - Token decimals
 * @returns Raw balance string
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const combined = whole + paddedFraction

  return BigInt(combined).toString()
}
