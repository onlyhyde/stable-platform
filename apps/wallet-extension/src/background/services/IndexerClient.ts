/**
 * IndexerClient
 * Client for interacting with indexer-go API (GraphQL/JSON-RPC)
 */

import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('IndexerClient')

/**
 * Indexer configuration
 */
export interface IndexerConfig {
  baseUrl: string
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
export interface IndexerTokenBalance {
  address: string
  balance: string
  tokenType: 'ERC20' | 'ERC721' | 'ERC1155'
  symbol?: string
  decimals?: number
  name?: string
}

/**
 * ERC-20 transfer event
 */
export interface ERC20Transfer {
  contractAddress: string
  from: string
  to: string
  value: string
  transactionHash: string
  blockNumber: number
  logIndex: number
  timestamp: number
}

/**
 * Transaction from indexer
 */
export interface IndexerTransaction {
  hash: string
  from: string
  to: string
  value: string
  gasPrice: string
  gasUsed: string
  blockNumber: number
  timestamp: number
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
 * Provides access to indexer-go GraphQL and JSON-RPC APIs
 */
export class IndexerClient {
  private baseUrl: string
  private timeout: number

  constructor(config: IndexerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout ?? 30000
  }

  /**
   * Update base URL (e.g., when network changes)
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '')
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
        throw new Error(`GraphQL request failed: ${response.status}`)
      }

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message ?? 'GraphQL error')
      }

      return result.data as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
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
        throw new Error(`RPC request failed: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message ?? 'RPC error')
      }

      return result.result as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
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
  async getAverageGasPrice(blockCount: number = 50): Promise<string> {
    try {
      const latestHeight = await this.getLatestHeight()
      const fromBlock = Math.max(0, latestHeight - blockCount)

      const stats = await this.getGasStats(fromBlock, latestHeight)
      return stats.averageGasPrice
    } catch (error) {
      logger.warn('Failed to get average gas price from indexer', { error })
      throw error
    }
  }

  // ============================================
  // Token APIs
  // ============================================

  /**
   * Get all token balances for an address
   */
  async getTokenBalances(
    address: string,
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'
  ): Promise<IndexerTokenBalance[]> {
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

    const result = await this.graphql<{ tokenBalances: IndexerTokenBalance[] }>(query, {
      address,
      tokenType,
    })

    return result.tokenBalances ?? []
  }

  /**
   * Get ERC-20 transfers for an address
   */
  async getERC20Transfers(
    address: string,
    isFrom: boolean = true,
    limit: number = 100,
    offset: number = 0
  ): Promise<ERC20Transfer[]> {
    const result = await this.rpc<ERC20Transfer[]>('getERC20TransfersByAddress', [
      address,
      isFrom,
      limit,
      offset,
    ])

    return result ?? []
  }

  /**
   * Get all ERC-20 transfers (sent and received)
   */
  async getAllERC20Transfers(
    address: string,
    limit: number = 50
  ): Promise<ERC20Transfer[]> {
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
   * Get transfers for a specific token
   */
  async getTokenTransfers(
    tokenAddress: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ERC20Transfer[]> {
    const result = await this.rpc<ERC20Transfer[]>('getERC20TransfersByToken', [
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
   */
  async getTransactionsByAddress(
    address: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResult<IndexerTransaction>> {
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
            blockNumber
            status
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `

    const result = await this.graphql<{
      transactionsByAddress: PaginatedResult<IndexerTransaction>
    }>(query, { address, limit, offset })

    return result.transactionsByAddress
  }

  /**
   * Get balance at a specific block
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
   * Check if indexer is available
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
 * Create indexer client with default configuration
 */
export function createIndexerClient(baseUrl: string): IndexerClient {
  return new IndexerClient({ baseUrl })
}
