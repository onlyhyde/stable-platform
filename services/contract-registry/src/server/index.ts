import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import type { RegistryConfig } from '../cli/config'
import { FilePersistence } from '../store/file-persistence'
import { InMemoryStore } from '../store/memory-store'
import type { AddressSet, ContractEntry } from '../store/types'
import type { Logger } from '../utils/logger'
import { registerBulkRoutes } from './routes/bulk'
import { registerChainRoutes } from './routes/chains'
import { registerContractRoutes } from './routes/contracts'
import { registerHealthRoutes } from './routes/health'
import { registerSetRoutes } from './routes/sets'
import { ChannelManager } from './websocket/channels'
import { setupWebSocket } from './websocket/handler'

export class RegistryServer {
  private app: FastifyInstance
  private readonly store: InMemoryStore
  private readonly persistence: FilePersistence
  private readonly channelManager: ChannelManager
  private readonly config: RegistryConfig
  private readonly logger: Logger

  constructor(config: RegistryConfig, logger: Logger) {
    this.config = config
    this.logger = logger.child({ module: 'server' })
    this.store = new InMemoryStore()
    this.persistence = new FilePersistence(config.dataDir, logger)
    this.channelManager = new ChannelManager()

    this.app = Fastify({
      logger: false,
      bodyLimit: 2 * 1024 * 1024,
    })
  }

  getStore(): InMemoryStore {
    return this.store
  }

  getApp(): FastifyInstance {
    return this.app
  }

  private async initialize(): Promise<void> {
    await this.persistence.load(this.store)

    this.store.on('contract:updated', (...args: unknown[]) => {
      const entry = args[0] as ContractEntry
      this.channelManager.broadcastContractUpdate(entry)
    })

    this.store.on('contract:deleted', (...args: unknown[]) => {
      const data = args[0] as { chainId: number; name: string }
      this.channelManager.broadcastContractDelete(data.chainId, data.name)
    })

    this.store.on('set:updated', (...args: unknown[]) => {
      const set = args[0] as AddressSet
      const resolved = this.store.getSet(set.name, set.chainId)
      if (resolved) {
        this.channelManager.broadcastSetUpdate(resolved)
      }
    })

    this.store.on('set:deleted', (...args: unknown[]) => {
      const data = args[0] as { chainId: number; name: string }
      this.channelManager.broadcastSetDelete(data.chainId, data.name)
    })

    await this.app.register(rateLimit, {
      max: 200,
      timeWindow: 60_000,
    })

    await this.app.register(cors, { origin: true })

    await this.app.register(websocket)

    const onMutation = () => this.persistence.scheduleSave(this.store)

    registerHealthRoutes(this.app, this.store)
    registerContractRoutes(this.app, this.store, this.config.apiKey, onMutation)
    registerSetRoutes(this.app, this.store, this.config.apiKey, onMutation)
    registerChainRoutes(this.app, this.store)
    registerBulkRoutes(this.app, this.store, this.config.apiKey, onMutation)

    setupWebSocket(this.app, this.channelManager, this.logger)
  }

  async start(): Promise<void> {
    await this.initialize()

    await this.app.listen({ port: this.config.port, host: '0.0.0.0' })
    this.logger.info({ port: this.config.port }, 'Contract registry server started')
  }

  async stop(): Promise<void> {
    await this.persistence.flush(this.store)
    await this.app.close()
    this.logger.info('Contract registry server stopped')
  }
}
