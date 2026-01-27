import type { FastifyInstance } from 'fastify'
import type { InMemoryStore } from '../../store/memory-store'

export function registerHealthRoutes(app: FastifyInstance, store: InMemoryStore) {
  app.get('/health', async () => ({
    status: 'ok',
    contracts: store.getAllContracts().length,
    sets: store.getAllSets().length,
    chains: store.getChainIds(),
  }))
}
