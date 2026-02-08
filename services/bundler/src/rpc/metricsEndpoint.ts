import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { BundlerMetrics, IMetricsCollector } from '../metrics/types'

/**
 * JSON serializer for BigInt values
 */
function serializeMetrics(metrics: BundlerMetrics): object {
  return JSON.parse(
    JSON.stringify(metrics, (_, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      if (value instanceof Map) {
        return Object.fromEntries(value)
      }
      return value
    })
  )
}

/**
 * Register metrics endpoints on Fastify instance
 */
export function registerMetricsEndpoint(
  app: FastifyInstance,
  metricsCollector: IMetricsCollector
): void {
  // GET /metrics - Prometheus format
  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const prometheus = metricsCollector.toPrometheus()
    return reply.header('Content-Type', 'text/plain; charset=utf-8').send(prometheus)
  })

  // GET /metrics/json - JSON format
  app.get('/metrics/json', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = metricsCollector.getMetrics()
    const serialized = serializeMetrics(metrics)
    return reply.header('Content-Type', 'application/json').send(serialized)
  })

  // POST /metrics/reset - Reset all metrics
  app.post('/metrics/reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    metricsCollector.reset()
    return reply.send({
      status: 'ok',
      message: 'All metrics have been reset',
    })
  })
}
