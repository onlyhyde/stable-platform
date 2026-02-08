import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { InMemoryStore } from '../../store/memory-store'
import { createAuthHook } from '../middleware/auth'
import { validateBody } from '../middleware/validation'
import { createContractSchema } from '../schemas/contract.schema'

const bulkImportSchema = z.object({
  contracts: z.array(createContractSchema).min(1).max(1000),
})

type BulkImportBody = z.infer<typeof bulkImportSchema>

export function registerBulkRoutes(
  app: FastifyInstance,
  store: InMemoryStore,
  apiKey: string | undefined,
  onMutation: () => void
) {
  const authHook = createAuthHook(apiKey)

  app.post(
    '/api/v1/bulk/import',
    { preHandler: [authHook, validateBody(bulkImportSchema)] },
    async (request: FastifyRequest, reply) => {
      const body = (request as FastifyRequest & { validatedBody: BulkImportBody }).validatedBody
      const result = store.importContracts(
        body.contracts.map((c) => ({
          chainId: c.chainId,
          name: c.name,
          address: c.address as `0x${string}`,
          version: c.version,
          tags: c.tags,
          abi: c.abi,
          deployedAt: c.deployedAt,
          txHash: c.txHash as `0x${string}` | undefined,
          metadata: c.metadata,
        }))
      )
      onMutation()
      return reply.status(200).send(result)
    }
  )
}
