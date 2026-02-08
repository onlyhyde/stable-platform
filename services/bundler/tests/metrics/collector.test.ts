import { beforeEach, describe, expect, it } from 'vitest'
import { MetricsCollector } from '../../src/metrics/collector'
import { METRIC_NAMES } from '../../src/metrics/types'

describe('MetricsCollector', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    collector = new MetricsCollector()
  })

  describe('UserOperation metrics', () => {
    it('should increment received counter', () => {
      collector.incUserOpReceived()
      collector.incUserOpReceived()
      const metrics = collector.getMetrics()
      expect(metrics.userOperations.received).toBe(2)
    })

    it('should increment validated counter', () => {
      collector.incUserOpValidated()
      const metrics = collector.getMetrics()
      expect(metrics.userOperations.validated).toBe(1)
    })

    it('should increment included counter', () => {
      collector.incUserOpIncluded()
      collector.incUserOpIncluded()
      collector.incUserOpIncluded()
      const metrics = collector.getMetrics()
      expect(metrics.userOperations.included).toBe(3)
    })

    it('should increment validation failed counter', () => {
      collector.incUserOpValidationFailed()
      const metrics = collector.getMetrics()
      expect(metrics.userOperations.validationFailed).toBe(1)
    })

    it('should increment dropped counter', () => {
      collector.incUserOpDropped()
      collector.incUserOpDropped()
      const metrics = collector.getMetrics()
      expect(metrics.userOperations.dropped).toBe(2)
    })
  })

  describe('Bundle metrics', () => {
    it('should increment attempted counter', () => {
      collector.incBundleAttempted()
      const metrics = collector.getMetrics()
      expect(metrics.bundles.attempted).toBe(1)
    })

    it('should increment submitted counter with gas and ops count', () => {
      collector.incBundleSubmitted(100000n, 5)
      collector.incBundleSubmitted(200000n, 3)
      const metrics = collector.getMetrics()
      expect(metrics.bundles.submitted).toBe(2)
      expect(metrics.bundles.totalGasUsed).toBe(300000n)
      expect(metrics.bundles.totalOpsBundled).toBe(8)
    })

    it('should increment failed counter', () => {
      collector.incBundleFailed()
      const metrics = collector.getMetrics()
      expect(metrics.bundles.failed).toBe(1)
    })
  })

  describe('Mempool metrics', () => {
    it('should set mempool size', () => {
      collector.setMempoolSize(100)
      const metrics = collector.getMetrics()
      expect(metrics.mempool.size).toBe(100)
    })

    it('should set mempool max size', () => {
      collector.setMempoolMaxSize(10000)
      const metrics = collector.getMetrics()
      expect(metrics.mempool.maxSize).toBe(10000)
    })

    it('should calculate utilization percentage', () => {
      collector.setMempoolSize(500)
      collector.setMempoolMaxSize(1000)
      const metrics = collector.getMetrics()
      expect(metrics.mempool.utilization).toBe(50)
    })

    it('should handle zero max size without division error', () => {
      collector.setMempoolSize(100)
      collector.setMempoolMaxSize(0)
      const metrics = collector.getMetrics()
      expect(metrics.mempool.utilization).toBe(0)
    })

    it('should set status counts', () => {
      collector.setMempoolByStatus(10, 5, 100, 2, 3)
      const metrics = collector.getMetrics()
      expect(metrics.mempool.byStatus.pending).toBe(10)
      expect(metrics.mempool.byStatus.submitted).toBe(5)
      expect(metrics.mempool.byStatus.included).toBe(100)
      expect(metrics.mempool.byStatus.failed).toBe(2)
      expect(metrics.mempool.byStatus.dropped).toBe(3)
    })
  })

  describe('Reputation metrics', () => {
    it('should set reputation metrics', () => {
      collector.setReputationMetrics(100, 90, 8, 2)
      const metrics = collector.getMetrics()
      expect(metrics.reputation.totalEntities).toBe(100)
      expect(metrics.reputation.byStatus.ok).toBe(90)
      expect(metrics.reputation.byStatus.throttled).toBe(8)
      expect(metrics.reputation.byStatus.banned).toBe(2)
    })
  })

  describe('RPC metrics', () => {
    it('should increment request counter by method', () => {
      collector.incRpcRequest('eth_sendUserOperation')
      collector.incRpcRequest('eth_sendUserOperation')
      collector.incRpcRequest('eth_estimateUserOperationGas')
      const metrics = collector.getMetrics()
      expect(metrics.rpc.totalRequests).toBe(3)
      expect(metrics.rpc.byMethod.get('eth_sendUserOperation')).toBe(2)
      expect(metrics.rpc.byMethod.get('eth_estimateUserOperationGas')).toBe(1)
    })

    it('should increment failed request counter', () => {
      collector.incRpcFailed()
      collector.incRpcFailed()
      const metrics = collector.getMetrics()
      expect(metrics.rpc.failedRequests).toBe(2)
    })

    it('should observe response time and update histogram', () => {
      collector.observeRpcResponseTime('eth_sendUserOperation', 50)
      collector.observeRpcResponseTime('eth_sendUserOperation', 150)
      collector.observeRpcResponseTime('eth_sendUserOperation', 500)
      const metrics = collector.getMetrics()
      expect(metrics.rpc.responseTimeMs.count).toBe(3)
      expect(metrics.rpc.responseTimeMs.sum).toBe(700)
    })

    it('should correctly bucket response times', () => {
      // Add times in different buckets
      collector.observeRpcResponseTime('test', 5) // <= 5ms bucket
      collector.observeRpcResponseTime('test', 20) // <= 25ms bucket
      collector.observeRpcResponseTime('test', 75) // <= 100ms bucket
      collector.observeRpcResponseTime('test', 3000) // <= 5000ms bucket

      const metrics = collector.getMetrics()
      const buckets = metrics.rpc.responseTimeMs.buckets

      // Find specific buckets
      const bucket5 = buckets.find((b) => b.le === 5)
      const bucket25 = buckets.find((b) => b.le === 25)
      const bucket100 = buckets.find((b) => b.le === 100)
      const bucket5000 = buckets.find((b) => b.le === 5000)

      expect(bucket5?.count).toBe(1)
      expect(bucket25?.count).toBe(2) // cumulative
      expect(bucket100?.count).toBe(3) // cumulative
      expect(bucket5000?.count).toBe(4) // cumulative
    })
  })

  describe('Gas estimation metrics', () => {
    it('should track successful estimations', () => {
      collector.incGasEstimation(true, 100)
      collector.incGasEstimation(true, 200)
      const metrics = collector.getMetrics()
      expect(metrics.gasEstimation.total).toBe(2)
      expect(metrics.gasEstimation.successful).toBe(2)
      expect(metrics.gasEstimation.failed).toBe(0)
      expect(metrics.gasEstimation.avgTimeMs).toBe(150)
    })

    it('should track failed estimations', () => {
      collector.incGasEstimation(false, 50)
      const metrics = collector.getMetrics()
      expect(metrics.gasEstimation.total).toBe(1)
      expect(metrics.gasEstimation.successful).toBe(0)
      expect(metrics.gasEstimation.failed).toBe(1)
    })

    it('should calculate average time correctly', () => {
      collector.incGasEstimation(true, 100)
      collector.incGasEstimation(true, 200)
      collector.incGasEstimation(false, 300)
      const metrics = collector.getMetrics()
      expect(metrics.gasEstimation.avgTimeMs).toBe(200) // (100+200+300)/3
    })
  })

  describe('System metrics', () => {
    it('should track uptime', async () => {
      // Wait a bit to accumulate uptime
      await new Promise((resolve) => setTimeout(resolve, 100))
      const metrics = collector.getMetrics()
      expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0)
      expect(metrics.startTime).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('reset', () => {
    it('should reset all counters', () => {
      // Populate some metrics
      collector.incUserOpReceived()
      collector.incUserOpValidated()
      collector.incBundleSubmitted(100000n, 5)
      collector.incRpcRequest('test')

      // Reset
      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.userOperations.received).toBe(0)
      expect(metrics.userOperations.validated).toBe(0)
      expect(metrics.bundles.submitted).toBe(0)
      expect(metrics.bundles.totalGasUsed).toBe(0n)
      expect(metrics.rpc.totalRequests).toBe(0)
    })
  })

  describe('toPrometheus', () => {
    it('should export metrics in Prometheus format', () => {
      collector.incUserOpReceived()
      collector.incUserOpReceived()
      collector.incBundleSubmitted(100000n, 3)
      collector.setMempoolSize(50)
      collector.setMempoolMaxSize(10000)

      const prometheus = collector.toPrometheus()

      // Check that it contains expected metric names
      expect(prometheus).toContain(METRIC_NAMES.USER_OP_RECEIVED)
      expect(prometheus).toContain(METRIC_NAMES.BUNDLE_SUBMITTED)
      expect(prometheus).toContain(METRIC_NAMES.MEMPOOL_SIZE)
      expect(prometheus).toContain(METRIC_NAMES.UPTIME_SECONDS)
    })

    it('should include HELP and TYPE comments', () => {
      const prometheus = collector.toPrometheus()

      expect(prometheus).toContain('# HELP')
      expect(prometheus).toContain('# TYPE')
    })

    it('should format counter metrics correctly', () => {
      collector.incUserOpReceived()
      collector.incUserOpReceived()
      const prometheus = collector.toPrometheus()

      // Should have counter type
      expect(prometheus).toContain(`# TYPE ${METRIC_NAMES.USER_OP_RECEIVED} counter`)
      // Should have the value
      expect(prometheus).toContain(`${METRIC_NAMES.USER_OP_RECEIVED} 2`)
    })

    it('should format gauge metrics correctly', () => {
      collector.setMempoolSize(100)
      const prometheus = collector.toPrometheus()

      expect(prometheus).toContain(`# TYPE ${METRIC_NAMES.MEMPOOL_SIZE} gauge`)
      expect(prometheus).toContain(`${METRIC_NAMES.MEMPOOL_SIZE} 100`)
    })

    it('should format histogram metrics with buckets', () => {
      collector.observeRpcResponseTime('test', 50)
      collector.observeRpcResponseTime('test', 150)
      const prometheus = collector.toPrometheus()

      expect(prometheus).toContain(`# TYPE ${METRIC_NAMES.RPC_RESPONSE_TIME} histogram`)
      expect(prometheus).toContain(`${METRIC_NAMES.RPC_RESPONSE_TIME}_bucket`)
      expect(prometheus).toContain(`${METRIC_NAMES.RPC_RESPONSE_TIME}_sum`)
      expect(prometheus).toContain(`${METRIC_NAMES.RPC_RESPONSE_TIME}_count`)
    })

    it('should handle bigint values correctly', () => {
      collector.incBundleSubmitted(1000000000000n, 5)
      const prometheus = collector.toPrometheus()

      expect(prometheus).toContain(`${METRIC_NAMES.BUNDLE_GAS_USED} 1000000000000`)
    })
  })
})
