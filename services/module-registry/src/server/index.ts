import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { ModuleStore } from '../store/memory-store'
import { registerHealthRoutes } from './routes/health'
import { registerModuleRoutes } from './routes/modules'
import type { Logger } from '../utils/logger'

export interface RegistryServerConfig {
  port: number
  host: string
  seedData: boolean
}

export class ModuleRegistryServer {
  private readonly app = Fastify({ logger: false, bodyLimit: 1_048_576 })
  private readonly store = new ModuleStore()
  private readonly config: RegistryServerConfig
  private readonly logger: Logger

  constructor(config: RegistryServerConfig, logger: Logger) {
    this.config = config
    this.logger = logger
  }

  private async initialize(): Promise<void> {
    // CORS
    await this.app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })

    // Rate limiting
    await this.app.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute',
    })

    // Register routes
    registerHealthRoutes(this.app, this.store)
    registerModuleRoutes(this.app, this.store)

    // Seed default data
    if (this.config.seedData) {
      this.store.seedDefaults()
      this.logger.info(`Seeded ${this.store.getModuleCount()} default modules`)
    }
  }

  async start(): Promise<void> {
    await this.initialize()

    await this.app.listen({ port: this.config.port, host: this.config.host })
    this.logger.info(`Module Registry listening on ${this.config.host}:${this.config.port}`)
    this.logger.info(`Modules: ${this.store.getModuleCount()}, Installations: ${this.store.getInstallationCount()}`)
  }

  async stop(): Promise<void> {
    await this.app.close()
    this.logger.info('Module Registry stopped')
  }
}
