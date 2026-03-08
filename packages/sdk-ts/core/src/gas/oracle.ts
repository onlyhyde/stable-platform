/**
 * Gas Price Oracle
 *
 * Dynamic gas price estimation using eth_feeHistory RPC call.
 * Replaces static gas pricing with oracle-based estimation that
 * samples recent blocks to calculate tiered gas price recommendations.
 */

import { parseGwei } from 'viem'
import type { RpcProvider } from '../providers'
import { createJsonRpcClient, type JsonRpcClient } from '../rpc'
import type { GasPrices } from './strategies/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas price tiers for different transaction urgency levels
 */
export interface GasPriceTiers {
  /** Low urgency — 25th percentile priority fee */
  slow: GasPrices
  /** Medium urgency — 50th percentile priority fee */
  standard: GasPrices
  /** High urgency — 75th percentile priority fee */
  fast: GasPrices
}

/**
 * Gas price oracle interface
 */
export interface GasPriceOracle {
  /** Get current gas prices from the oracle (standard tier) */
  getGasPrices(): Promise<GasPrices>
  /** Get recommended gas prices for different speed tiers */
  getGasPriceTiers(): Promise<GasPriceTiers>
}

/**
 * Gas price oracle configuration
 */
export interface GasPriceOracleConfig {
  /** RPC provider for gas price and block data */
  provider: RpcProvider
  /** Chain ID */
  chainId: number
  /** Number of blocks to sample for fee history (default: 10) */
  blockSampleSize?: number
  /** Percentiles for fee history (default: [25, 50, 75]) */
  percentiles?: number[]
  /** Min priority fee floor (default: 1 gwei) */
  minPriorityFee?: bigint
  /** Max priority fee ceiling (default: 50 gwei) */
  maxPriorityFee?: bigint
  /** Optional pre-configured JSON-RPC client (uses provider.rpcUrl if not given) */
  rpcClient?: JsonRpcClient
}

// ============================================================================
// eth_feeHistory response shape
// ============================================================================

interface FeeHistoryResponse {
  /** Oldest block number (hex) */
  oldestBlock: string
  /** Base fee per gas for each block (hex[]) */
  baseFeePerGas: string[]
  /** Gas used ratio for each block */
  gasUsedRatio: number[]
  /** Reward (priority fee) percentiles per block (hex[][]) */
  reward?: string[][]
}

// ============================================================================
// Helpers
// ============================================================================

function hexToBigInt(hex: string): bigint {
  return BigInt(hex)
}

/**
 * Clamp a value between min and max bounds
 */
function clamp(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Calculate the median of a sorted bigint array
 */
function median(values: bigint[]): bigint {
  if (values.length === 0) return 0n
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2n
  }
  return sorted[mid]!
}

// ============================================================================
// Default Constants
// ============================================================================

const DEFAULT_BLOCK_SAMPLE_SIZE = 10
const DEFAULT_PERCENTILES = [25, 50, 75]
const DEFAULT_MIN_PRIORITY_FEE = parseGwei('1')
const DEFAULT_MAX_PRIORITY_FEE = parseGwei('50')

// Percentile indices for tier mapping
const SLOW_INDEX = 0
const STANDARD_INDEX = 1
const FAST_INDEX = 2

// ============================================================================
// Oracle Implementation
// ============================================================================

/**
 * Create a gas price oracle that uses eth_feeHistory for dynamic estimation
 *
 * @example
 * ```typescript
 * const oracle = createGasPriceOracle({
 *   provider,
 *   chainId: 1,
 * })
 *
 * // Get standard gas prices
 * const prices = await oracle.getGasPrices()
 *
 * // Get all tiers for UI speed selector
 * const tiers = await oracle.getGasPriceTiers()
 * console.log(tiers.slow, tiers.standard, tiers.fast)
 * ```
 */
export function createGasPriceOracle(config: GasPriceOracleConfig): GasPriceOracle {
  const {
    provider,
    blockSampleSize = DEFAULT_BLOCK_SAMPLE_SIZE,
    percentiles = DEFAULT_PERCENTILES,
    minPriorityFee = DEFAULT_MIN_PRIORITY_FEE,
    maxPriorityFee = DEFAULT_MAX_PRIORITY_FEE,
    rpcClient: injectedRpcClient,
  } = config

  // Create JSON-RPC client for eth_feeHistory (not on RpcProvider interface)
  const rpcClient: JsonRpcClient =
    injectedRpcClient ?? createJsonRpcClient({ url: provider.rpcUrl })

  /**
   * Fetch fee history from the node via eth_feeHistory
   */
  async function fetchFeeHistory(): Promise<FeeHistoryResponse | null> {
    try {
      const result = await rpcClient.request<FeeHistoryResponse>('eth_feeHistory', [
        `0x${blockSampleSize.toString(16)}`,
        'latest',
        percentiles,
      ])
      return result
    } catch {
      // eth_feeHistory not supported on this chain/node
      return null
    }
  }

  /**
   * Build gas prices for a single tier from fee history data
   */
  function buildTierFromHistory(baseFees: bigint[], rewards: bigint[]): GasPrices {
    // Use latest base fee (last element includes the next block's base fee)
    const latestBaseFee = baseFees[baseFees.length - 1] ?? 0n
    const medianReward = median(rewards)
    const priorityFee = clamp(medianReward, minPriorityFee, maxPriorityFee)

    // EIP-1559: maxFeePerGas = baseFee * 2 + priorityFee
    const maxFeePerGas = latestBaseFee * 2n + priorityFee

    return {
      baseFee: latestBaseFee,
      maxPriorityFeePerGas: priorityFee,
      maxFeePerGas,
      gasPrice: maxFeePerGas,
    }
  }

  /**
   * Build tiers from eth_feeHistory response
   */
  function buildTiersFromFeeHistory(feeHistory: FeeHistoryResponse): GasPriceTiers {
    const baseFees = feeHistory.baseFeePerGas.map(hexToBigInt)
    const rewards = feeHistory.reward ?? []

    // Extract per-percentile reward arrays
    const slowRewards: bigint[] = []
    const standardRewards: bigint[] = []
    const fastRewards: bigint[] = []

    for (const blockRewards of rewards) {
      if (blockRewards[SLOW_INDEX] !== undefined) {
        slowRewards.push(hexToBigInt(blockRewards[SLOW_INDEX]))
      }
      if (blockRewards[STANDARD_INDEX] !== undefined) {
        standardRewards.push(hexToBigInt(blockRewards[STANDARD_INDEX]))
      }
      if (blockRewards[FAST_INDEX] !== undefined) {
        fastRewards.push(hexToBigInt(blockRewards[FAST_INDEX]))
      }
    }

    return {
      slow: buildTierFromHistory(baseFees, slowRewards),
      standard: buildTierFromHistory(baseFees, standardRewards),
      fast: buildTierFromHistory(baseFees, fastRewards),
    }
  }

  /**
   * Fallback: build tiers from eth_gasPrice when eth_feeHistory is unavailable
   */
  async function buildTiersFromGasPrice(): Promise<GasPriceTiers> {
    const [block, gasPrice] = await Promise.all([
      provider.getBlock('latest'),
      provider.getGasPrice(),
    ])

    const baseFee = block.baseFeePerGas ?? 0n

    // Derive priority fees from gas price when no fee history is available
    const estimatedPriorityFee = gasPrice > baseFee ? gasPrice - baseFee : minPriorityFee

    const slowPriority = clamp((estimatedPriorityFee * 80n) / 100n, minPriorityFee, maxPriorityFee)
    const standardPriority = clamp(estimatedPriorityFee, minPriorityFee, maxPriorityFee)
    const fastPriority = clamp((estimatedPriorityFee * 130n) / 100n, minPriorityFee, maxPriorityFee)

    function buildFromPriority(priorityFee: bigint): GasPrices {
      const maxFee = baseFee * 2n + priorityFee
      return {
        baseFee,
        maxPriorityFeePerGas: priorityFee,
        maxFeePerGas: maxFee,
        gasPrice: maxFee,
      }
    }

    return {
      slow: buildFromPriority(slowPriority),
      standard: buildFromPriority(standardPriority),
      fast: buildFromPriority(fastPriority),
    }
  }

  // ----------------------------------------
  // Public API
  // ----------------------------------------

  async function getGasPriceTiers(): Promise<GasPriceTiers> {
    const feeHistory = await fetchFeeHistory()

    if (feeHistory?.reward && feeHistory.reward.length > 0) {
      return buildTiersFromFeeHistory(feeHistory)
    }

    // Fallback to eth_gasPrice-based estimation
    return buildTiersFromGasPrice()
  }

  async function getGasPrices(): Promise<GasPrices> {
    const tiers = await getGasPriceTiers()
    return tiers.standard
  }

  return {
    getGasPrices,
    getGasPriceTiers,
  }
}
