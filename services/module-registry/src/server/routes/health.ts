import type { FastifyInstance } from 'fastify'
import type { ModuleStore } from '../../store/memory-store'

const startTime = new Date()

export function registerHealthRoutes(app: FastifyInstance, store: ModuleStore) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'module-registry',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
  }))

  app.get('/ready', async () => ({
    ready: true,
    service: 'module-registry',
    modules: store.getModuleCount(),
  }))

  app.get('/live', async () => ({
    alive: true,
    service: 'module-registry',
  }))

  let requestCount = 0
  let errorCount = 0

  app.addHook('onResponse', (_req, reply, done) => {
    requestCount++
    if (reply.statusCode >= 400) errorCount++
    done()
  })

  app.get('/metrics', async () => {
    const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
    const moduleCount = store.getModuleCount()
    const installCount = store.getInstallationCount()

    return [
      '# HELP module_registry_up Service up status',
      '# TYPE module_registry_up gauge',
      `module_registry_up{service="module-registry"} 1`,
      '',
      '# HELP module_registry_uptime_seconds Service uptime in seconds',
      '# TYPE module_registry_uptime_seconds gauge',
      `module_registry_uptime_seconds{service="module-registry"} ${uptime}`,
      '',
      '# HELP module_registry_modules_total Total registered modules',
      '# TYPE module_registry_modules_total gauge',
      `module_registry_modules_total{service="module-registry"} ${moduleCount}`,
      '',
      '# HELP module_registry_installations_total Total active installations',
      '# TYPE module_registry_installations_total gauge',
      `module_registry_installations_total{service="module-registry"} ${installCount}`,
      '',
      '# HELP module_registry_requests_total Total requests handled',
      '# TYPE module_registry_requests_total counter',
      `module_registry_requests_total{service="module-registry"} ${requestCount}`,
      '',
      '# HELP module_registry_errors_total Total error responses',
      '# TYPE module_registry_errors_total counter',
      `module_registry_errors_total{service="module-registry"} ${errorCount}`,
      '',
    ].join('\n')
  })
}
