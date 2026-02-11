import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { InMemoryStore } from '../../store/memory-store'
import { createAuthHook } from '../middleware/auth'
import { validateBody, validateParams, validateQuery } from '../middleware/validation'
import {
  type CreateSetBody,
  createSetSchema,
  type SetParams,
  type SetQuery,
  setParamsSchema,
  setQuerySchema,
} from '../schemas/set.schema'

export function registerSetRoutes(
  app: FastifyInstance,
  store: InMemoryStore,
  apiKey: string | undefined,
  onMutation: () => void
) {
  const authHook = createAuthHook(apiKey)

  app.get(
    '/api/v1/sets',
    { preHandler: [validateQuery(setQuerySchema)] },
    async (request: FastifyRequest) => {
      const query = (request as FastifyRequest & { validatedQuery: SetQuery }).validatedQuery
      return store.listSets(query.chainId)
    }
  )

  app.get(
    '/api/v1/sets/:chainId/:name',
    { preHandler: [validateParams(setParamsSchema)] },
    async (request: FastifyRequest, reply) => {
      const params = (request as FastifyRequest & { validatedParams: SetParams }).validatedParams
      const resolved = store.getSet(params.name, params.chainId)
      if (!resolved) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Address set ${params.name} not found on chain ${params.chainId}`,
        })
      }
      return resolved
    }
  )

  app.post(
    '/api/v1/sets',
    { preHandler: [authHook, validateBody(createSetSchema)] },
    async (request: FastifyRequest, reply) => {
      const body = (request as FastifyRequest & { validatedBody: CreateSetBody }).validatedBody
      const addressSet = store.createSet({
        chainId: body.chainId,
        name: body.name,
        contracts: body.contracts,
        description: body.description,
      })
      onMutation()
      return reply.status(201).send(addressSet)
    }
  )

  app.delete(
    '/api/v1/sets/:chainId/:name',
    { preHandler: [authHook, validateParams(setParamsSchema)] },
    async (request: FastifyRequest, reply) => {
      const params = (request as FastifyRequest & { validatedParams: SetParams }).validatedParams
      const deleted = store.deleteSet(params.name, params.chainId)
      if (!deleted) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Address set ${params.name} not found on chain ${params.chainId}`,
        })
      }
      onMutation()
      return { success: true }
    }
  )
}
