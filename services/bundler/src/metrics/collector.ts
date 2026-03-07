import type { BundlerMetrics, HistogramBucket, HistogramMetric, IMetricsCollector } from './types'
import { DEFAULT_RESPONSE_TIME_BUCKETS, METRIC_NAMES } from './types'

/**
 * Metrics collector for ERC-4337 Bundler
 * Collects and exports metrics in Prometheus format
 */
export class MetricsCollector implements IMetricsCollector {
  // UserOperation counters
  private userOpReceived = 0
  private userOpValidated = 0
  private userOpIncluded = 0
  private userOpValidationFailed = 0
  private userOpDropped = 0

  // Bundle counters
  private bundleAttempted = 0
  private bundleSubmitted = 0
  private bundleFailed = 0
  private bundleTotalGasUsed = 0n
  private bundleTotalOpsBundled = 0

  // Mempool gauges
  private mempoolSize = 0
  private mempoolMaxSize = 0
  private mempoolPending = 0
  private mempoolSubmitted = 0
  private mempoolIncluded = 0
  private mempoolFailed = 0
  private mempoolDropped = 0

  // Reputation gauges
  private reputationTotal = 0
  private reputationOk = 0
  private reputationThrottled = 0
  private reputationBanned = 0

  // RPC metrics
  private rpcTotalRequests = 0
  private rpcByMethod: Map<string, number> = new Map()
  private rpcFailedRequests = 0
  private rpcResponseTimeBuckets: number[] = []
  private rpcResponseTimeSum = 0
  private rpcResponseTimeCount = 0

  // Profitability metrics
  private bundleProfitTotal = 0n
  private bundleProfitableCount = 0
  private bundleUnprofitableCount = 0

  // Gas estimation metrics
  private gasEstimationTotal = 0
  private gasEstimationSuccessful = 0
  private gasEstimationFailed = 0
  private gasEstimationTotalTimeMs = 0

  // System metrics
  private readonly startTime: number

  constructor() {
    this.startTime = Date.now()
    this.initializeHistogramBuckets()
  }

  private initializeHistogramBuckets(): void {
    this.rpcResponseTimeBuckets = DEFAULT_RESPONSE_TIME_BUCKETS.map(() => 0)
  }

  // UserOperation metrics
  incUserOpReceived(): void {
    this.userOpReceived++
  }

  incUserOpValidated(): void {
    this.userOpValidated++
  }

  incUserOpIncluded(): void {
    this.userOpIncluded++
  }

  incUserOpValidationFailed(): void {
    this.userOpValidationFailed++
  }

  incUserOpDropped(): void {
    this.userOpDropped++
  }

  // Bundle metrics
  incBundleAttempted(): void {
    this.bundleAttempted++
  }

  incBundleSubmitted(gasUsed: bigint, opsCount: number): void {
    this.bundleSubmitted++
    this.bundleTotalGasUsed += gasUsed
    this.bundleTotalOpsBundled += opsCount
  }

  incBundleFailed(): void {
    this.bundleFailed++
  }

  // Mempool metrics
  setMempoolSize(size: number): void {
    this.mempoolSize = size
  }

  setMempoolMaxSize(maxSize: number): void {
    this.mempoolMaxSize = maxSize
  }

  setMempoolByStatus(
    pending: number,
    submitted: number,
    included: number,
    failed: number,
    dropped: number
  ): void {
    this.mempoolPending = pending
    this.mempoolSubmitted = submitted
    this.mempoolIncluded = included
    this.mempoolFailed = failed
    this.mempoolDropped = dropped
  }

  // Reputation metrics
  setReputationMetrics(total: number, ok: number, throttled: number, banned: number): void {
    this.reputationTotal = total
    this.reputationOk = ok
    this.reputationThrottled = throttled
    this.reputationBanned = banned
  }

  // RPC metrics
  incRpcRequest(method: string): void {
    this.rpcTotalRequests++
    const current = this.rpcByMethod.get(method) ?? 0
    this.rpcByMethod.set(method, current + 1)
  }

  incRpcFailed(): void {
    this.rpcFailedRequests++
  }

  observeRpcResponseTime(_method: string, timeMs: number): void {
    this.rpcResponseTimeSum += timeMs
    this.rpcResponseTimeCount++

    // Update histogram buckets (cumulative)
    for (let i = 0; i < DEFAULT_RESPONSE_TIME_BUCKETS.length; i++) {
      const bucketLimit = DEFAULT_RESPONSE_TIME_BUCKETS[i]
      if (bucketLimit !== undefined && timeMs <= bucketLimit) {
        // Increment this bucket and all larger buckets (cumulative)
        for (let j = i; j < DEFAULT_RESPONSE_TIME_BUCKETS.length; j++) {
          const currentCount = this.rpcResponseTimeBuckets[j] ?? 0
          this.rpcResponseTimeBuckets[j] = currentCount + 1
        }
        break
      }
    }

    // If larger than all buckets, nothing to do
    // The count is tracked via rpcResponseTimeCount
  }

  // Profitability metrics
  recordBundleProfitability(netProfit: bigint, isProfitable: boolean): void {
    this.bundleProfitTotal += netProfit
    if (isProfitable) {
      this.bundleProfitableCount++
    } else {
      this.bundleUnprofitableCount++
    }
  }

  // Gas estimation metrics
  incGasEstimation(success: boolean, timeMs: number): void {
    this.gasEstimationTotal++
    this.gasEstimationTotalTimeMs += timeMs
    if (success) {
      this.gasEstimationSuccessful++
    } else {
      this.gasEstimationFailed++
    }
  }

  getMetrics(): BundlerMetrics {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000)
    const utilization =
      this.mempoolMaxSize > 0 ? Math.round((this.mempoolSize / this.mempoolMaxSize) * 100) : 0

    const avgTimeMs =
      this.gasEstimationTotal > 0
        ? Math.round(this.gasEstimationTotalTimeMs / this.gasEstimationTotal)
        : 0

    const histogramBuckets: HistogramBucket[] = DEFAULT_RESPONSE_TIME_BUCKETS.map((le, i) => ({
      le,
      count: this.rpcResponseTimeBuckets[i] ?? 0,
    }))

    return {
      userOperations: {
        received: this.userOpReceived,
        validated: this.userOpValidated,
        included: this.userOpIncluded,
        validationFailed: this.userOpValidationFailed,
        dropped: this.userOpDropped,
      },
      bundles: {
        attempted: this.bundleAttempted,
        submitted: this.bundleSubmitted,
        failed: this.bundleFailed,
        totalGasUsed: this.bundleTotalGasUsed,
        totalOpsBundled: this.bundleTotalOpsBundled,
      },
      mempool: {
        size: this.mempoolSize,
        maxSize: this.mempoolMaxSize,
        utilization,
        byStatus: {
          pending: this.mempoolPending,
          submitted: this.mempoolSubmitted,
          included: this.mempoolIncluded,
          failed: this.mempoolFailed,
          dropped: this.mempoolDropped,
        },
      },
      reputation: {
        totalEntities: this.reputationTotal,
        byStatus: {
          ok: this.reputationOk,
          throttled: this.reputationThrottled,
          banned: this.reputationBanned,
        },
      },
      rpc: {
        totalRequests: this.rpcTotalRequests,
        byMethod: new Map(this.rpcByMethod),
        failedRequests: this.rpcFailedRequests,
        responseTimeMs: {
          name: METRIC_NAMES.RPC_RESPONSE_TIME,
          help: 'RPC response time in milliseconds',
          buckets: histogramBuckets,
          sum: this.rpcResponseTimeSum,
          count: this.rpcResponseTimeCount,
        } as HistogramMetric,
      },
      gasEstimation: {
        total: this.gasEstimationTotal,
        successful: this.gasEstimationSuccessful,
        failed: this.gasEstimationFailed,
        avgTimeMs,
      },
      uptimeSeconds,
      startTime: this.startTime,
    }
  }

  toPrometheus(): string {
    const metrics = this.getMetrics()
    const lines: string[] = []

    // Helper to add a counter metric
    const addCounter = (name: string, help: string, value: number | bigint) => {
      lines.push(`# HELP ${name} ${help}`)
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name} ${value.toString()}`)
    }

    // Helper to add a gauge metric
    const addGauge = (name: string, help: string, value: number | bigint) => {
      lines.push(`# HELP ${name} ${help}`)
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name} ${value.toString()}`)
    }

    // UserOperation counters
    addCounter(
      METRIC_NAMES.USER_OP_RECEIVED,
      'Total UserOperations received',
      metrics.userOperations.received
    )
    addCounter(
      METRIC_NAMES.USER_OP_VALIDATED,
      'Total UserOperations validated',
      metrics.userOperations.validated
    )
    addCounter(
      METRIC_NAMES.USER_OP_INCLUDED,
      'Total UserOperations included in bundles',
      metrics.userOperations.included
    )
    addCounter(
      METRIC_NAMES.USER_OP_VALIDATION_FAILED,
      'Total UserOperations that failed validation',
      metrics.userOperations.validationFailed
    )
    addCounter(
      METRIC_NAMES.USER_OP_DROPPED,
      'Total UserOperations dropped from mempool',
      metrics.userOperations.dropped
    )

    // Bundle counters
    addCounter(METRIC_NAMES.BUNDLE_ATTEMPTED, 'Total bundle attempts', metrics.bundles.attempted)
    addCounter(METRIC_NAMES.BUNDLE_SUBMITTED, 'Total bundles submitted', metrics.bundles.submitted)
    addCounter(METRIC_NAMES.BUNDLE_FAILED, 'Total bundle failures', metrics.bundles.failed)
    addCounter(
      METRIC_NAMES.BUNDLE_GAS_USED,
      'Total gas used by bundles',
      metrics.bundles.totalGasUsed
    )
    addCounter(
      METRIC_NAMES.BUNDLE_OPS_COUNT,
      'Total operations bundled',
      metrics.bundles.totalOpsBundled
    )

    // Mempool gauges
    addGauge(METRIC_NAMES.MEMPOOL_SIZE, 'Current mempool size', metrics.mempool.size)
    addGauge(METRIC_NAMES.MEMPOOL_MAX_SIZE, 'Maximum mempool size', metrics.mempool.maxSize)
    addGauge(
      METRIC_NAMES.MEMPOOL_UTILIZATION,
      'Mempool utilization percentage',
      metrics.mempool.utilization
    )
    addGauge(
      METRIC_NAMES.MEMPOOL_PENDING,
      'Pending operations in mempool',
      metrics.mempool.byStatus.pending
    )
    addGauge(
      METRIC_NAMES.MEMPOOL_SUBMITTED,
      'Submitted operations in mempool',
      metrics.mempool.byStatus.submitted
    )
    addGauge(
      METRIC_NAMES.MEMPOOL_INCLUDED,
      'Included operations in mempool',
      metrics.mempool.byStatus.included
    )
    addGauge(
      METRIC_NAMES.MEMPOOL_FAILED,
      'Failed operations in mempool',
      metrics.mempool.byStatus.failed
    )
    addGauge(
      METRIC_NAMES.MEMPOOL_DROPPED,
      'Dropped operations in mempool',
      metrics.mempool.byStatus.dropped
    )

    // Reputation gauges
    addGauge(
      METRIC_NAMES.REPUTATION_TOTAL,
      'Total tracked entities',
      metrics.reputation.totalEntities
    )
    addGauge(METRIC_NAMES.REPUTATION_OK, 'Entities with ok status', metrics.reputation.byStatus.ok)
    addGauge(
      METRIC_NAMES.REPUTATION_THROTTLED,
      'Entities with throttled status',
      metrics.reputation.byStatus.throttled
    )
    addGauge(
      METRIC_NAMES.REPUTATION_BANNED,
      'Entities with banned status',
      metrics.reputation.byStatus.banned
    )

    // RPC counters
    addCounter(METRIC_NAMES.RPC_REQUESTS_TOTAL, 'Total RPC requests', metrics.rpc.totalRequests)
    addCounter(
      METRIC_NAMES.RPC_REQUESTS_FAILED,
      'Total failed RPC requests',
      metrics.rpc.failedRequests
    )

    // RPC response time histogram
    lines.push(`# HELP ${METRIC_NAMES.RPC_RESPONSE_TIME} RPC response time in milliseconds`)
    lines.push(`# TYPE ${METRIC_NAMES.RPC_RESPONSE_TIME} histogram`)
    for (const bucket of metrics.rpc.responseTimeMs.buckets) {
      lines.push(`${METRIC_NAMES.RPC_RESPONSE_TIME}_bucket{le="${bucket.le}"} ${bucket.count}`)
    }
    lines.push(
      `${METRIC_NAMES.RPC_RESPONSE_TIME}_bucket{le="+Inf"} ${metrics.rpc.responseTimeMs.count}`
    )
    lines.push(`${METRIC_NAMES.RPC_RESPONSE_TIME}_sum ${metrics.rpc.responseTimeMs.sum}`)
    lines.push(`${METRIC_NAMES.RPC_RESPONSE_TIME}_count ${metrics.rpc.responseTimeMs.count}`)

    // Gas estimation counters
    addCounter(
      METRIC_NAMES.GAS_ESTIMATION_TOTAL,
      'Total gas estimations',
      metrics.gasEstimation.total
    )
    addCounter(
      METRIC_NAMES.GAS_ESTIMATION_SUCCESS,
      'Successful gas estimations',
      metrics.gasEstimation.successful
    )
    addCounter(
      METRIC_NAMES.GAS_ESTIMATION_FAILED,
      'Failed gas estimations',
      metrics.gasEstimation.failed
    )
    addGauge(
      METRIC_NAMES.GAS_ESTIMATION_AVG_TIME,
      'Average gas estimation time in milliseconds',
      metrics.gasEstimation.avgTimeMs
    )

    // System metrics
    addGauge(METRIC_NAMES.UPTIME_SECONDS, 'Bundler uptime in seconds', metrics.uptimeSeconds)

    return lines.join('\n')
  }

  reset(): void {
    // Reset UserOperation counters
    this.userOpReceived = 0
    this.userOpValidated = 0
    this.userOpIncluded = 0
    this.userOpValidationFailed = 0
    this.userOpDropped = 0

    // Reset Bundle counters
    this.bundleAttempted = 0
    this.bundleSubmitted = 0
    this.bundleFailed = 0
    this.bundleTotalGasUsed = 0n
    this.bundleTotalOpsBundled = 0

    // Reset Mempool gauges
    this.mempoolSize = 0
    this.mempoolMaxSize = 0
    this.mempoolPending = 0
    this.mempoolSubmitted = 0
    this.mempoolIncluded = 0
    this.mempoolFailed = 0
    this.mempoolDropped = 0

    // Reset Reputation gauges
    this.reputationTotal = 0
    this.reputationOk = 0
    this.reputationThrottled = 0
    this.reputationBanned = 0

    // Reset RPC metrics
    this.rpcTotalRequests = 0
    this.rpcByMethod.clear()
    this.rpcFailedRequests = 0
    this.initializeHistogramBuckets()
    this.rpcResponseTimeSum = 0
    this.rpcResponseTimeCount = 0

    // Reset Profitability metrics
    this.bundleProfitTotal = 0n
    this.bundleProfitableCount = 0
    this.bundleUnprofitableCount = 0

    // Reset Gas estimation metrics
    this.gasEstimationTotal = 0
    this.gasEstimationSuccessful = 0
    this.gasEstimationFailed = 0
    this.gasEstimationTotalTimeMs = 0

    // Note: startTime is not reset - uptime continues from original start
  }
}
