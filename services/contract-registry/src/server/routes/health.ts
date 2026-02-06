import type { FastifyInstance } from 'fastify'
import type { InMemoryStore } from '../../store/memory-store'

const startTime = new Date()

export function registerHealthRoutes(app: FastifyInstance, store: InMemoryStore) {
  // Health check endpoints (Kubernetes probes compatible)
  app.get('/health', async () => ({
    status: 'ok',
    service: 'contract-registry',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - startTime.getTime()) / 1000)}s`,
    contracts: store.getAllContracts().length,
    sets: store.getAllSets().length,
    chains: store.getChainIds(),
  }))

  app.get('/ready', async () => ({
    ready: true,
    service: 'contract-registry',
  }))

  app.get('/live', async () => ({
    alive: true,
    service: 'contract-registry',
  }))

  // Prometheus metrics endpoint
  let requestCount = 0
  let errorCount = 0
  app.get('/metrics', async () => {
    const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
    const contractCount = store.getAllContracts().length
    const setCount = store.getAllSets().length
    return `# HELP contract_registry_up Service up status
# TYPE contract_registry_up gauge
contract_registry_up{service="contract-registry"} 1
# HELP contract_registry_uptime_seconds Service uptime in seconds
# TYPE contract_registry_uptime_seconds gauge
contract_registry_uptime_seconds{service="contract-registry"} ${uptime}
# HELP contract_registry_requests_total Total HTTP requests
# TYPE contract_registry_requests_total counter
contract_registry_requests_total{service="contract-registry"} ${requestCount}
# HELP contract_registry_errors_total Total HTTP errors
# TYPE contract_registry_errors_total counter
contract_registry_errors_total{service="contract-registry"} ${errorCount}
# HELP contract_registry_contracts_total Total registered contracts
# TYPE contract_registry_contracts_total gauge
contract_registry_contracts_total{service="contract-registry"} ${contractCount}
# HELP contract_registry_sets_total Total registered address sets
# TYPE contract_registry_sets_total gauge
contract_registry_sets_total{service="contract-registry"} ${setCount}
`
  })

  // Metrics tracking hook
  app.addHook('onResponse', (_request, reply, done) => {
    requestCount++
    if (reply.statusCode >= 400) {
      errorCount++
    }
    done()
  })
}
