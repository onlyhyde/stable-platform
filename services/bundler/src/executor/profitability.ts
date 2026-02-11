import type { MempoolEntry } from '../types'
import type { Logger } from '../utils/logger'

/**
 * Profitability estimation for a single UserOperation
 */
export interface OpProfitEstimate {
  /** UserOp hash */
  userOpHash: string
  /** Estimated gas the op will consume */
  estimatedGas: bigint
  /** Effective priority fee (capped by maxFeePerGas - baseFee) */
  effectivePriorityFee: bigint
  /** Revenue from this op (gas * effectivePriorityFee) */
  revenue: bigint
  /** Whether this op is profitable on its own */
  isProfitable: boolean
}

/**
 * Profitability estimation for an entire bundle
 */
export interface BundleProfitEstimate {
  /** Total revenue from all ops */
  totalRevenue: bigint
  /** Bundler's cost for the bundle transaction */
  bundlerCost: bigint
  /** Net profit (revenue - cost) */
  netProfit: bigint
  /** Whether the bundle is profitable */
  isProfitable: boolean
  /** Per-operation breakdown */
  opEstimates: OpProfitEstimate[]
}

/**
 * Configuration for profitability calculations
 */
export interface ProfitabilityConfig {
  /** Minimum net profit in wei to consider a bundle worth submitting (default: 0) */
  minNetProfit?: bigint
  /** Overhead gas per UserOp in the bundle (default: 18300) */
  perOpOverheadGas?: bigint
  /** Fixed overhead gas for EntryPoint handling (default: 21000) */
  fixedOverheadGas?: bigint
}

const DEFAULT_PROFITABILITY_CONFIG: Required<ProfitabilityConfig> = {
  minNetProfit: 0n,
  perOpOverheadGas: 18300n,
  fixedOverheadGas: 21000n,
}

/**
 * Calculates bundler profitability for UserOperation bundles.
 *
 * Revenue = sum of (opGas * effectivePriorityFee) for each op
 * Cost = estimatedBundleGas * baseFeePerGas
 * Net = Revenue - Cost
 */
export class ProfitabilityCalculator {
  private readonly config: Required<ProfitabilityConfig>
  private readonly logger: Logger

  constructor(logger: Logger, config: ProfitabilityConfig = {}) {
    this.config = { ...DEFAULT_PROFITABILITY_CONFIG, ...config }
    this.logger = logger.child({ module: 'profitability' })
  }

  /**
   * Estimate profitability for a set of entries
   */
  estimate(
    entries: MempoolEntry[],
    estimatedBundleGas: bigint,
    baseFeePerGas: bigint
  ): BundleProfitEstimate {
    const opEstimates: OpProfitEstimate[] = entries.map((entry) => {
      const op = entry.userOp
      const estimatedGas = op.callGasLimit + op.verificationGasLimit + op.preVerificationGas

      // effectivePriorityFee = min(maxPriorityFeePerGas, maxFeePerGas - baseFeePerGas)
      const maxPossiblePriorityFee =
        op.maxFeePerGas > baseFeePerGas ? op.maxFeePerGas - baseFeePerGas : 0n
      const effectivePriorityFee =
        op.maxPriorityFeePerGas < maxPossiblePriorityFee
          ? op.maxPriorityFeePerGas
          : maxPossiblePriorityFee

      const revenue = estimatedGas * effectivePriorityFee

      return {
        userOpHash: entry.userOpHash,
        estimatedGas,
        effectivePriorityFee,
        revenue,
        isProfitable: revenue > 0n,
      }
    })

    const totalRevenue = opEstimates.reduce((sum, op) => sum + op.revenue, 0n)
    const bundlerCost = estimatedBundleGas * baseFeePerGas
    const netProfit = totalRevenue - bundlerCost

    return {
      totalRevenue,
      bundlerCost,
      netProfit,
      isProfitable: netProfit >= this.config.minNetProfit,
      opEstimates,
    }
  }

  /**
   * Filter entries to only include profitable operations.
   * Uses greedy selection: sorts by net contribution (descending),
   * then includes ops while the bundle remains profitable.
   */
  filterProfitable(
    entries: MempoolEntry[],
    _estimatedBundleGas: bigint,
    baseFeePerGas: bigint
  ): MempoolEntry[] {
    if (entries.length === 0) return []

    // Calculate per-op contribution
    const contributions = entries.map((entry) => {
      const op = entry.userOp
      const estimatedGas = op.callGasLimit + op.verificationGasLimit + op.preVerificationGas

      const maxPossiblePriorityFee =
        op.maxFeePerGas > baseFeePerGas ? op.maxFeePerGas - baseFeePerGas : 0n
      const effectivePriorityFee =
        op.maxPriorityFeePerGas < maxPossiblePriorityFee
          ? op.maxPriorityFeePerGas
          : maxPossiblePriorityFee

      const revenue = estimatedGas * effectivePriorityFee
      const cost = (estimatedGas + this.config.perOpOverheadGas) * baseFeePerGas
      const netContribution = revenue - cost

      return { entry, netContribution, revenue }
    })

    // Sort by net contribution descending (most profitable first)
    contributions.sort((a, b) => {
      if (b.netContribution > a.netContribution) return 1
      if (b.netContribution < a.netContribution) return -1
      return 0
    })

    // Greedily include profitable ops
    const result: MempoolEntry[] = []
    let runningRevenue = 0n
    const fixedCost = this.config.fixedOverheadGas * baseFeePerGas

    for (const { entry, netContribution, revenue } of contributions) {
      if (netContribution <= 0n) {
        this.logger.debug({ userOpHash: entry.userOpHash }, 'Excluding unprofitable op from bundle')
        continue
      }

      result.push(entry)
      runningRevenue += revenue
    }

    // Final check: is the overall bundle still profitable after fixed overhead?
    if (result.length > 0 && runningRevenue < fixedCost + this.config.minNetProfit) {
      this.logger.debug(
        {
          revenue: runningRevenue.toString(),
          fixedCost: fixedCost.toString(),
        },
        'Bundle not profitable after fixed overhead, returning empty'
      )
      return []
    }

    return result
  }
}
