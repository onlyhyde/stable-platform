import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MetricsCollector } from '../../src/metrics/collector'
import { METRIC_NAMES } from '../../src/metrics/types'
import { registerMetricsEndpoint } from '../../src/rpc/metricsEndpoint'

describe('Metrics Endpoint', () => {
  let app: FastifyInstance
  let metrics: MetricsCollector

  beforeEach(async () => {
    app = Fastify()
    metrics = new MetricsCollector()
    registerMetricsEndpoint(app, metrics)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /metrics', () => {
    it('should return 200 status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return Prometheus text format content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.headers['content-type']).toContain('text/plain')
    })

    it('should return metrics in Prometheus format', async () => {
      // Add some metrics
      metrics.incUserOpReceived()
      metrics.incBundleSubmitted(100000n, 3)

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      const body = response.body
      expect(body).toContain(METRIC_NAMES.USER_OP_RECEIVED)
      expect(body).toContain(METRIC_NAMES.BUNDLE_SUBMITTED)
      expect(body).toContain('# HELP')
      expect(body).toContain('# TYPE')
    })

    it('should include uptime metric', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.body).toContain(METRIC_NAMES.UPTIME_SECONDS)
    })
  })

  describe('GET /metrics/json', () => {
    it('should return 200 status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      })

      expect(response.headers['content-type']).toContain('application/json')
    })

    it('should return metrics as JSON object', async () => {
      metrics.incUserOpReceived()
      metrics.incUserOpValidated()
      metrics.setMempoolSize(50)

      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      })

      const json = JSON.parse(response.body)
      expect(json.userOperations.received).toBe(1)
      expect(json.userOperations.validated).toBe(1)
      expect(json.mempool.size).toBe(50)
    })

    it('should include all metric categories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      })

      const json = JSON.parse(response.body)
      expect(json).toHaveProperty('userOperations')
      expect(json).toHaveProperty('bundles')
      expect(json).toHaveProperty('mempool')
      expect(json).toHaveProperty('reputation')
      expect(json).toHaveProperty('rpc')
      expect(json).toHaveProperty('gasEstimation')
      expect(json).toHaveProperty('uptimeSeconds')
    })

    it('should serialize bigint values as strings', async () => {
      metrics.incBundleSubmitted(1000000000000n, 5)

      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      })

      const json = JSON.parse(response.body)
      // BigInt should be serialized as string
      expect(typeof json.bundles.totalGasUsed).toBe('string')
      expect(json.bundles.totalGasUsed).toBe('1000000000000')
    })
  })

  describe('POST /metrics/reset', () => {
    it('should reset all metrics', async () => {
      // Add some metrics first
      metrics.incUserOpReceived()
      metrics.incUserOpReceived()
      metrics.incBundleSubmitted(100000n, 5)

      // Verify they exist
      let metricsData = metrics.getMetrics()
      expect(metricsData.userOperations.received).toBe(2)
      expect(metricsData.bundles.submitted).toBe(1)

      // Reset via endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/metrics/reset',
      })

      expect(response.statusCode).toBe(200)

      // Verify reset
      metricsData = metrics.getMetrics()
      expect(metricsData.userOperations.received).toBe(0)
      expect(metricsData.bundles.submitted).toBe(0)
    })

    it('should return confirmation message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/metrics/reset',
      })

      const json = JSON.parse(response.body)
      expect(json.status).toBe('ok')
      expect(json.message).toContain('reset')
    })
  })

  describe('Content negotiation', () => {
    it('should respect Accept header for text/plain', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          Accept: 'text/plain',
        },
      })

      expect(response.headers['content-type']).toContain('text/plain')
    })
  })
})
