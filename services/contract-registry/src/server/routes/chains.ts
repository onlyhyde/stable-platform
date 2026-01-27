import type { FastifyInstance } from 'fastify'
import type { InMemoryStore } from '../../store/memory-store'

export function registerChainRoutes(app: FastifyInstance, store: InMemoryStore) {
  app.get('/api/v1/chains', async () => {
    const chainIds = store.getChainIds()
    return {
      chains: chainIds.map((chainId) => ({
        chainId,
        contractCount: store.listContracts({ chainId }).length,
      })),
    }
  })
}
