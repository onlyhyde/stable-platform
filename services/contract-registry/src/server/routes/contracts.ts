import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { InMemoryStore } from '../../store/memory-store'
import { createAuthHook } from '../middleware/auth'
import { validateBody, validateParams, validateQuery } from '../middleware/validation'
import {
  type ContractParams,
  type ContractQuery,
  type CreateContractBody,
  contractParamsSchema,
  contractQuerySchema,
  createContractSchema,
} from '../schemas/contract.schema'

export function registerContractRoutes(
  app: FastifyInstance,
  store: InMemoryStore,
  apiKey: string | undefined,
  onMutation: () => void
) {
  const authHook = createAuthHook(apiKey)

  app.get(
    '/api/v1/contracts',
    { preHandler: [validateQuery(contractQuerySchema)] },
    async (request: FastifyRequest) => {
      const query = (request as FastifyRequest & { validatedQuery: ContractQuery }).validatedQuery
      return store.listContracts({
        chainId: query.chainId,
        tag: query.tag,
        name: query.name,
      })
    }
  )

  app.get(
    '/api/v1/contracts/:chainId/:name',
    { preHandler: [validateParams(contractParamsSchema)] },
    async (request: FastifyRequest, reply) => {
      const params = (request as FastifyRequest & { validatedParams: ContractParams })
        .validatedParams
      const entry = store.getContract(params.chainId, params.name)
      if (!entry) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Contract ${params.name} not found on chain ${params.chainId}`,
        })
      }
      return entry
    }
  )

  app.post(
    '/api/v1/contracts',
    { preHandler: [authHook, validateBody(createContractSchema)] },
    async (request: FastifyRequest, reply) => {
      const body = (request as FastifyRequest & { validatedBody: CreateContractBody }).validatedBody
      const entry = store.setContract({
        chainId: body.chainId,
        name: body.name,
        address: body.address as `0x${string}`,
        version: body.version,
        tags: body.tags,
        abi: body.abi,
        deployedAt: body.deployedAt,
        txHash: body.txHash as `0x${string}` | undefined,
        metadata: body.metadata,
      })
      onMutation()
      return reply.status(201).send(entry)
    }
  )

  app.delete(
    '/api/v1/contracts/:chainId/:name',
    { preHandler: [authHook, validateParams(contractParamsSchema)] },
    async (request: FastifyRequest, reply) => {
      const params = (request as FastifyRequest & { validatedParams: ContractParams })
        .validatedParams
      const deleted = store.deleteContract(params.chainId, params.name)
      if (!deleted) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Contract ${params.name} not found on chain ${params.chainId}`,
        })
      }
      onMutation()
      return { success: true }
    }
  )
}
