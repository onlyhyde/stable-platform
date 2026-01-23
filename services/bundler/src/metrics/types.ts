/**
 * Metrics types for ERC-4337 Bundler monitoring
 */

/**
 * Counter metric - monotonically increasing value
 */
export interface CounterMetric {
  name: string
  help: string
  labels?: string[]
  value: number
}

/**
 * Gauge metric - value that can go up and down
 */
export interface GaugeMetric {
  name: string
  help: string
  labels?: string[]
  value: number
}

/**
 * Histogram bucket definition
 */
export interface HistogramBucket {
  le: number // less than or equal
  count: number
}

/**
 * Histogram metric - distribution of values
 */
export interface HistogramMetric {
  name: string
  help: string
  labels?: string[]
  buckets: HistogramBucket[]
  sum: number
  count: number
}

/**
 * Label values for metrics
 */
export interface MetricLabels {
  [key: string]: string
}

/**
 * UserOperation metrics
 */
export interface UserOperationMetrics {
  /** Total UserOperations received */
  received: number
  /** UserOperations that passed validation */
  validated: number
  /** UserOperations included in bundles */
  included: number
  /** UserOperations that failed validation */
  validationFailed: number
  /** UserOperations dropped from mempool */
  dropped: number
}

/**
 * Bundle metrics
 */
export interface BundleMetrics {
  /** Total bundles attempted */
  attempted: number
  /** Bundles successfully submitted */
  submitted: number
  /** Bundles that failed submission */
  failed: number
  /** Total gas used by bundles */
  totalGasUsed: bigint
  /** Total operations bundled */
  totalOpsBundled: number
}

/**
 * Mempool metrics
 */
export interface MempoolMetrics {
  /** Current mempool size */
  size: number
  /** Maximum mempool size */
  maxSize: number
  /** Utilization percentage (0-100) */
  utilization: number
  /** Operations by status */
  byStatus: {
    pending: number
    submitted: number
    included: number
    failed: number
    dropped: number
  }
}

/**
 * Reputation metrics
 */
export interface ReputationMetrics {
  /** Total tracked entities */
  totalEntities: number
  /** Entities by status */
  byStatus: {
    ok: number
    throttled: number
    banned: number
  }
}

/**
 * RPC metrics
 */
export interface RpcMetrics {
  /** Total RPC requests */
  totalRequests: number
  /** Requests by method */
  byMethod: Map<string, number>
  /** Failed requests */
  failedRequests: number
  /** Response time histogram (ms) */
  responseTimeMs: HistogramMetric
}

/**
 * Gas estimation metrics
 */
export interface GasEstimationMetrics {
  /** Total estimations performed */
  total: number
  /** Successful estimations */
  successful: number
  /** Failed estimations */
  failed: number
  /** Average estimation time (ms) */
  avgTimeMs: number
}

/**
 * Aggregated bundler metrics
 */
export interface BundlerMetrics {
  userOperations: UserOperationMetrics
  bundles: BundleMetrics
  mempool: MempoolMetrics
  reputation: ReputationMetrics
  rpc: RpcMetrics
  gasEstimation: GasEstimationMetrics
  /** Uptime in seconds */
  uptimeSeconds: number
  /** Start timestamp */
  startTime: number
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  // UserOperation metrics
  incUserOpReceived(): void
  incUserOpValidated(): void
  incUserOpIncluded(): void
  incUserOpValidationFailed(): void
  incUserOpDropped(): void

  // Bundle metrics
  incBundleAttempted(): void
  incBundleSubmitted(gasUsed: bigint, opsCount: number): void
  incBundleFailed(): void

  // Mempool metrics
  setMempoolSize(size: number): void
  setMempoolMaxSize(maxSize: number): void
  setMempoolByStatus(
    pending: number,
    submitted: number,
    included: number,
    failed: number,
    dropped: number
  ): void

  // Reputation metrics
  setReputationMetrics(total: number, ok: number, throttled: number, banned: number): void

  // RPC metrics
  incRpcRequest(method: string): void
  incRpcFailed(): void
  observeRpcResponseTime(method: string, timeMs: number): void

  // Gas estimation metrics
  incGasEstimation(success: boolean, timeMs: number): void

  // Get metrics
  getMetrics(): BundlerMetrics

  // Export to Prometheus format
  toPrometheus(): string

  // Reset all metrics
  reset(): void
}

/**
 * Default histogram buckets for response times (ms)
 */
export const DEFAULT_RESPONSE_TIME_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

/**
 * Metric names for Prometheus export
 */
export const METRIC_NAMES = {
  // UserOperation counters
  USER_OP_RECEIVED: 'bundler_user_operations_received_total',
  USER_OP_VALIDATED: 'bundler_user_operations_validated_total',
  USER_OP_INCLUDED: 'bundler_user_operations_included_total',
  USER_OP_VALIDATION_FAILED: 'bundler_user_operations_validation_failed_total',
  USER_OP_DROPPED: 'bundler_user_operations_dropped_total',

  // Bundle counters
  BUNDLE_ATTEMPTED: 'bundler_bundles_attempted_total',
  BUNDLE_SUBMITTED: 'bundler_bundles_submitted_total',
  BUNDLE_FAILED: 'bundler_bundles_failed_total',
  BUNDLE_GAS_USED: 'bundler_bundles_gas_used_total',
  BUNDLE_OPS_COUNT: 'bundler_bundles_ops_total',

  // Mempool gauges
  MEMPOOL_SIZE: 'bundler_mempool_size',
  MEMPOOL_MAX_SIZE: 'bundler_mempool_max_size',
  MEMPOOL_UTILIZATION: 'bundler_mempool_utilization_percent',
  MEMPOOL_PENDING: 'bundler_mempool_pending',
  MEMPOOL_SUBMITTED: 'bundler_mempool_submitted',
  MEMPOOL_INCLUDED: 'bundler_mempool_included',
  MEMPOOL_FAILED: 'bundler_mempool_failed',
  MEMPOOL_DROPPED: 'bundler_mempool_dropped',

  // Reputation gauges
  REPUTATION_TOTAL: 'bundler_reputation_entities_total',
  REPUTATION_OK: 'bundler_reputation_ok',
  REPUTATION_THROTTLED: 'bundler_reputation_throttled',
  REPUTATION_BANNED: 'bundler_reputation_banned',

  // RPC metrics
  RPC_REQUESTS_TOTAL: 'bundler_rpc_requests_total',
  RPC_REQUESTS_FAILED: 'bundler_rpc_requests_failed_total',
  RPC_RESPONSE_TIME: 'bundler_rpc_response_time_ms',

  // Gas estimation
  GAS_ESTIMATION_TOTAL: 'bundler_gas_estimation_total',
  GAS_ESTIMATION_SUCCESS: 'bundler_gas_estimation_success_total',
  GAS_ESTIMATION_FAILED: 'bundler_gas_estimation_failed_total',
  GAS_ESTIMATION_AVG_TIME: 'bundler_gas_estimation_avg_time_ms',

  // System
  UPTIME_SECONDS: 'bundler_uptime_seconds',
} as const
