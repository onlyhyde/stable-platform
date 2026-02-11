/**
 * GasFeeController
 * Manages gas fee estimation and EIP-1559 support
 * Integrates with SDK GasEstimator for multi-mode transaction support
 */

import {
  createGasEstimator,
  type GasEstimate,
  type GasEstimator,
  type GasPriceInfo,
  type MultiModeTransactionRequest,
  type TransactionMode,
} from '@stablenet/core'
import { GWEI, getGasFeeConfig } from '../../config'
import { createLogger } from '../../shared/utils/logger'
import type { IndexerClient } from '../services/IndexerClient'

const logger = createLogger('GasFeeController')

/**
 * Gas price history entry
 */
export interface GasPriceHistoryEntry {
  timestamp: number
  gasPrice: string
}

/**
 * Gas fee state
 */
export interface GasFeeState {
  chainId: number
  gasPrice: string | null
  baseFeePerGas: string | null
  maxPriorityFeePerGas: string | null
  maxFeePerGas: string | null
  gasPriceHistory: GasPriceHistoryEntry[]
  isPolling: boolean
  pollingInterval: number
  lastUpdated: number | null
}

/**
 * EIP-1559 fee suggestion
 */
export interface EIP1559FeeSuggestion {
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  estimatedTime: number // seconds
}

/**
 * EIP-1559 gas fees result
 */
export interface EIP1559GasFees {
  baseFeePerGas: string
  maxPriorityFeePerGas: string
  maxFeePerGas: string
  slow: EIP1559FeeSuggestion
  average: EIP1559FeeSuggestion
  fast: EIP1559FeeSuggestion
  isLegacy?: boolean
  gasPrice?: string
}

/**
 * Gas fee suggestion
 */
export interface GasFeeSuggestion {
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  gasPrice?: string
  totalCost?: string
  estimatedTime?: number
}

/**
 * Suggested gas fees result
 */
export interface SuggestedGasFees {
  low: GasFeeSuggestion
  medium: GasFeeSuggestion
  high: GasFeeSuggestion
}

/**
 * Transaction parameters for gas estimation
 */
export interface TransactionParams {
  from: string
  to?: string
  value?: string
  data?: string
  gas?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

/**
 * Gas estimation options
 */
export interface GasEstimationOptions {
  addBuffer?: boolean
  bufferPercentage?: number
}

/**
 * Total fee calculation params
 */
export interface TotalFeeParams {
  gasLimit: string
  gasPrice?: string
  maxFeePerGas?: string
}

/**
 * Provider interface
 */
export interface Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Controller configuration
 */
export interface GasFeeControllerConfig {
  provider: Provider
  chainId: number
  rpcUrl: string
  pollingInterval?: number
  indexerClient?: IndexerClient
  bundlerUrl?: string
  paymasterUrl?: string
}

/**
 * Historical gas statistics from indexer
 */
export interface HistoricalGasStats {
  averageGasPrice: string
  averageGasUsed: string
  blockCount: number
  transactionCount: number
  fromBlock: number
  toBlock: number
}

/**
 * Multi-mode gas estimate result
 */
export interface MultiModeGasEstimateResult {
  mode: TransactionMode
  estimate: GasEstimate | null
  available: boolean
}

/**
 * Fee history response from eth_feeHistory
 */
interface FeeHistoryResponse {
  baseFeePerGas: string[]
  gasUsedRatio: number[]
  reward: string[][]
}

/**
 * Get default polling interval and history length from config
 */
function getDefaultPollingInterval(): number {
  return getGasFeeConfig().pollingIntervalMs
}

function getMaxHistoryLength(): number {
  return getGasFeeConfig().historyMaxLength
}

/**
 * GasFeeController
 * Manages gas price fetching, EIP-1559 fee estimation, and gas estimation
 * Now integrates with SDK GasEstimator for multi-mode support
 */
export class GasFeeController {
  private provider: Provider
  private indexerClient: IndexerClient | null = null
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private gasEstimator: GasEstimator | null = null
  private config: GasFeeControllerConfig

  state: GasFeeState

  constructor(config: GasFeeControllerConfig) {
    this.provider = config.provider
    this.config = config
    this.indexerClient = config.indexerClient ?? null
    this.state = {
      chainId: config.chainId,
      gasPrice: null,
      baseFeePerGas: null,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
      gasPriceHistory: [],
      isPolling: false,
      pollingInterval: config.pollingInterval || getDefaultPollingInterval(),
      lastUpdated: null,
    }

    // Initialize SDK GasEstimator for multi-mode support
    this.initializeGasEstimator()
  }

  /**
   * Initialize SDK GasEstimator
   */
  private initializeGasEstimator(): void {
    try {
      this.gasEstimator = createGasEstimator({
        rpcUrl: this.config.rpcUrl,
        chainId: this.config.chainId,
        bundlerUrl: this.config.bundlerUrl,
        paymasterUrl: this.config.paymasterUrl,
      })
      logger.debug('SDK GasEstimator initialized', { chainId: this.config.chainId })
    } catch (error) {
      logger.warn('Failed to initialize SDK GasEstimator', { error })
      this.gasEstimator = null
    }
  }

  /**
   * Set indexer client (for deferred initialization)
   */
  setIndexerClient(client: IndexerClient): void {
    this.indexerClient = client
  }

  /**
   * Update configuration (e.g., when network changes)
   */
  updateConfig(config: Partial<GasFeeControllerConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.chainId !== undefined) {
      this.state.chainId = config.chainId
    }
    // Re-initialize gas estimator with new config
    this.initializeGasEstimator()
  }

  // ============================================
  // SDK GasEstimator Integration (Multi-Mode)
  // ============================================

  /**
   * Estimate gas for multi-mode transaction using SDK
   */
  async estimateMultiModeGas(request: MultiModeTransactionRequest): Promise<GasEstimate> {
    if (!this.gasEstimator) {
      throw new Error('Gas estimator not initialized')
    }

    return this.gasEstimator.estimate(request)
  }

  /**
   * Get gas estimates for all available modes
   */
  async estimateAllModes(
    request: Omit<MultiModeTransactionRequest, 'mode'>
  ): Promise<Record<TransactionMode, GasEstimate | null>> {
    if (!this.gasEstimator) {
      throw new Error('Gas estimator not initialized')
    }

    return this.gasEstimator.estimateAllModes(request)
  }

  /**
   * Get gas prices using SDK (consistent with multi-mode estimation)
   */
  async getGasPricesFromSDK(): Promise<GasPriceInfo> {
    if (!this.gasEstimator) {
      throw new Error('Gas estimator not initialized')
    }

    return this.gasEstimator.getGasPrices()
  }

  /**
   * Format gas estimate for display
   */
  formatGasEstimate(estimate: GasEstimate): {
    gasLimit: string
    maxFeePerGas: string
    estimatedCost: string
    estimatedCostEth: string
  } {
    if (!this.gasEstimator) {
      return {
        gasLimit: estimate.gasLimit.toString(),
        maxFeePerGas: `${estimate.maxFeePerGas.toString()} wei`,
        estimatedCost: `${estimate.estimatedCost.toString()} wei`,
        estimatedCostEth: `${(Number(estimate.estimatedCost) / 1e18).toFixed(6)} ETH`,
      }
    }

    return this.gasEstimator.formatEstimate(estimate)
  }

  // ============================================
  // Legacy Gas Price APIs (backwards compatibility)
  // ============================================

  /**
   * Get current gas price (legacy)
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = (await this.provider.request({
        method: 'eth_gasPrice',
      })) as string

      this.state.gasPrice = gasPrice
      this.state.lastUpdated = Date.now()

      // Add to history
      this.addToHistory(gasPrice)

      return gasPrice
    } catch (_error) {
      throw new Error('Failed to fetch gas price')
    }
  }

  /**
   * Get EIP-1559 gas fees
   */
  async getEIP1559GasFees(): Promise<EIP1559GasFees> {
    try {
      // Fetch fee history
      const feeHistory = (await this.provider.request({
        method: 'eth_feeHistory',
        params: ['0x5', 'latest', [25, 50, 75]],
      })) as FeeHistoryResponse

      const baseFeePerGas = feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1] ?? '0x0'
      const rewards = feeHistory.reward[0] ?? ['0x0', '0x0', '0x0']

      // Calculate priority fees (25th, 50th, 75th percentile)
      const slowPriorityFee = rewards[0] ?? '0x0'
      const avgPriorityFee = rewards[1] ?? '0x0'
      const fastPriorityFee = rewards[2] ?? '0x0'

      // Calculate max fees (baseFee * 2 + priorityFee for buffer)
      const baseFee = BigInt(baseFeePerGas)
      const slowMaxFee = this.toHex(baseFee * 2n + BigInt(slowPriorityFee))
      const avgMaxFee = this.toHex(baseFee * 2n + BigInt(avgPriorityFee))
      const fastMaxFee = this.toHex(baseFee * 2n + BigInt(fastPriorityFee))

      // Update state
      this.state.baseFeePerGas = baseFeePerGas ?? null
      this.state.maxPriorityFeePerGas = avgPriorityFee ?? null
      this.state.maxFeePerGas = avgMaxFee ?? null
      this.state.lastUpdated = Date.now()

      return {
        baseFeePerGas: baseFeePerGas,
        maxPriorityFeePerGas: avgPriorityFee,
        maxFeePerGas: avgMaxFee,
        slow: {
          maxFeePerGas: slowMaxFee,
          maxPriorityFeePerGas: slowPriorityFee,
          estimatedTime: 120, // ~2 minutes
        },
        average: {
          maxFeePerGas: avgMaxFee,
          maxPriorityFeePerGas: avgPriorityFee,
          estimatedTime: 30, // ~30 seconds
        },
        fast: {
          maxFeePerGas: fastMaxFee,
          maxPriorityFeePerGas: fastPriorityFee,
          estimatedTime: 15, // ~15 seconds
        },
      }
    } catch {
      // Fall back to legacy gas price
      const gasPrice = await this.getGasPrice()
      return {
        baseFeePerGas: '0x0',
        maxPriorityFeePerGas: '0x0',
        maxFeePerGas: '0x0',
        slow: { maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0', estimatedTime: 120 },
        average: { maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0', estimatedTime: 30 },
        fast: { maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0', estimatedTime: 15 },
        isLegacy: true,
        gasPrice,
      }
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(tx: TransactionParams, options: GasEstimationOptions = {}): Promise<string> {
    const { addBuffer = false, bufferPercentage = 20 } = options

    try {
      const estimatedGas = (await this.provider.request({
        method: 'eth_estimateGas',
        params: [tx],
      })) as string

      if (addBuffer) {
        const gas = BigInt(estimatedGas)
        const buffer = (gas * BigInt(bufferPercentage)) / 100n
        return this.toHex(gas + buffer)
      }

      return estimatedGas
    } catch {
      throw new Error('Gas estimation failed')
    }
  }

  /**
   * Get suggested gas fees for different speeds
   */
  async getSuggestedGasFees(gasLimit?: string): Promise<SuggestedGasFees> {
    const eip1559Fees = await this.getEIP1559GasFees()
    const limit = gasLimit ? BigInt(gasLimit) : 21000n

    const calculateTotalCost = (maxFeePerGas: string): string => {
      return this.toHex(BigInt(maxFeePerGas) * limit)
    }

    if (eip1559Fees.isLegacy) {
      const totalCost = calculateTotalCost(eip1559Fees.gasPrice!)
      return {
        low: { gasPrice: eip1559Fees.gasPrice, totalCost, estimatedTime: 120 },
        medium: { gasPrice: eip1559Fees.gasPrice, totalCost, estimatedTime: 30 },
        high: { gasPrice: eip1559Fees.gasPrice, totalCost, estimatedTime: 15 },
      }
    }

    return {
      low: {
        maxFeePerGas: eip1559Fees.slow.maxFeePerGas,
        maxPriorityFeePerGas: eip1559Fees.slow.maxPriorityFeePerGas,
        totalCost: calculateTotalCost(eip1559Fees.slow.maxFeePerGas),
        estimatedTime: eip1559Fees.slow.estimatedTime,
      },
      medium: {
        maxFeePerGas: eip1559Fees.average.maxFeePerGas,
        maxPriorityFeePerGas: eip1559Fees.average.maxPriorityFeePerGas,
        totalCost: calculateTotalCost(eip1559Fees.average.maxFeePerGas),
        estimatedTime: eip1559Fees.average.estimatedTime,
      },
      high: {
        maxFeePerGas: eip1559Fees.fast.maxFeePerGas,
        maxPriorityFeePerGas: eip1559Fees.fast.maxPriorityFeePerGas,
        totalCost: calculateTotalCost(eip1559Fees.fast.maxFeePerGas),
        estimatedTime: eip1559Fees.fast.estimatedTime,
      },
    }
  }

  /**
   * Set chain ID and clear history
   */
  setChainId(chainId: number): void {
    this.state.chainId = chainId
    this.state.gasPriceHistory = []
    this.state.gasPrice = null
    this.state.baseFeePerGas = null
    this.state.maxPriorityFeePerGas = null
    this.state.maxFeePerGas = null
    this.state.lastUpdated = null
  }

  /**
   * Start polling for gas prices
   */
  startPolling(): void {
    if (this.state.isPolling) {
      return
    }

    this.state.isPolling = true

    // Initial fetch - errors are handled internally, polling continues on failure
    this.getGasPrice().catch((error) => {
      // Silently ignore polling errors - will retry on next interval
      logger.debug('Gas price fetch failed', { error })
    })

    // Set up polling
    this.pollingTimer = setInterval(() => {
      this.getGasPrice().catch((error) => {
        // Silently ignore polling errors - will retry on next interval
        logger.debug('Gas price fetch failed', { error })
      })
    }, this.state.pollingInterval)
  }

  /**
   * Stop polling for gas prices
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    this.state.isPolling = false
  }

  /**
   * Get gas price history
   */
  getGasPriceHistory(limit?: number): GasPriceHistoryEntry[] {
    const history = [...this.state.gasPriceHistory]
    if (limit && history.length > limit) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * Calculate total fee for a transaction
   */
  calculateTotalFee(params: TotalFeeParams): string {
    const gasLimit = BigInt(params.gasLimit)
    const feePerGas = BigInt(params.maxFeePerGas || params.gasPrice || '0x0')
    return this.toHex(gasLimit * feePerGas)
  }

  /**
   * Format gas price to Gwei
   */
  formatGasPrice(gasPrice: string, decimals?: number): string {
    const wei = BigInt(gasPrice)
    const gwei = wei / GWEI
    const remainder = wei % GWEI

    if (decimals !== undefined && remainder > 0n) {
      const decimalPart = (remainder * 10n ** BigInt(decimals)) / GWEI
      return `${gwei}.${decimalPart.toString().padStart(decimals, '0')}`
    }

    return gwei.toString()
  }

  // ============================================
  // Indexer Integration Methods
  // ============================================

  /**
   * Get historical gas statistics from indexer
   * Useful for displaying gas price trends
   */
  async getHistoricalGasStats(blockCount = 100): Promise<HistoricalGasStats | null> {
    if (!this.indexerClient) {
      logger.debug('Indexer client not configured, skipping historical stats')
      return null
    }

    try {
      const latestHeight = await this.indexerClient.getLatestHeight()
      const fromBlock = Math.max(0, latestHeight - blockCount)

      const stats = await this.indexerClient.getGasStats(fromBlock, latestHeight)

      return {
        averageGasPrice: stats.averageGasPrice,
        averageGasUsed: stats.averageGasUsed,
        blockCount: stats.blockCount,
        transactionCount: stats.transactionCount,
        fromBlock,
        toBlock: latestHeight,
      }
    } catch (error) {
      logger.warn('Failed to fetch historical gas stats from indexer', { error })
      return null
    }
  }

  /**
   * Get gas price with indexer fallback
   * First tries RPC, then falls back to indexer average if RPC fails
   */
  async getGasPriceWithFallback(): Promise<string> {
    try {
      return await this.getGasPrice()
    } catch (rpcError) {
      logger.warn('RPC gas price failed, trying indexer fallback', { rpcError })

      if (this.indexerClient) {
        try {
          const avgPrice = await this.indexerClient.getAverageGasPrice(50)
          this.state.gasPrice = avgPrice
          this.state.lastUpdated = Date.now()
          return avgPrice
        } catch (indexerError) {
          logger.error('Indexer fallback also failed', { indexerError })
        }
      }

      throw rpcError
    }
  }

  /**
   * Get suggested gas fees with historical context
   * Enhances suggestions with indexer data when available
   */
  async getSuggestedGasFeesWithHistory(
    gasLimit?: string
  ): Promise<SuggestedGasFees & { historicalAverage?: string }> {
    const fees = await this.getSuggestedGasFees(gasLimit)

    // Try to add historical context from indexer
    if (this.indexerClient) {
      try {
        const historicalStats = await this.getHistoricalGasStats(100)
        if (historicalStats) {
          return {
            ...fees,
            historicalAverage: historicalStats.averageGasPrice,
          }
        }
      } catch {
        // Ignore indexer errors, return base fees
      }
    }

    return fees
  }

  // ============================================
  // Accessors
  // ============================================

  /**
   * Get the SDK GasEstimator instance
   */
  getGasEstimator(): GasEstimator | null {
    return this.gasEstimator
  }

  // Private helpers

  private addToHistory(gasPrice: string): void {
    this.state.gasPriceHistory.push({
      timestamp: Date.now(),
      gasPrice,
    })

    // Limit history length
    const maxLength = getMaxHistoryLength()
    if (this.state.gasPriceHistory.length > maxLength) {
      this.state.gasPriceHistory = this.state.gasPriceHistory.slice(-maxLength)
    }
  }

  private toHex(value: bigint): string {
    return `0x${value.toString(16)}`
  }
}
