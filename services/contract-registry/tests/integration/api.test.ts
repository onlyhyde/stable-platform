import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { registerBulkRoutes } from '../../src/server/routes/bulk'
import { registerChainRoutes } from '../../src/server/routes/chains'
import { registerContractRoutes } from '../../src/server/routes/contracts'
import { registerHealthRoutes } from '../../src/server/routes/health'
import { registerSetRoutes } from '../../src/server/routes/sets'
import { InMemoryStore } from '../../src/store/memory-store'

describe('Contract Registry API', () => {
  let app: FastifyInstance
  let store: InMemoryStore
  const API_KEY = 'test-api-key'

  beforeAll(async () => {
    app = Fastify()
    store = new InMemoryStore()

    const onMutation = () => {}

    registerHealthRoutes(app, store)
    registerContractRoutes(app, store, API_KEY, onMutation)
    registerSetRoutes(app, store, API_KEY, onMutation)
    registerChainRoutes(app, store)
    registerBulkRoutes(app, store, API_KEY, onMutation)

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.loadFromData([], [])
  })

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('ok')
      expect(body.contracts).toBe(0)
      expect(body.sets).toBe(0)
    })
  })

  describe('Contracts API', () => {
    describe('POST /api/v1/contracts', () => {
      it('should create a contract with valid API key', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 31337,
            name: 'entryPoint',
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            version: '0.7.0',
            tags: ['core'],
          },
        })

        expect(response.statusCode).toBe(201)
        const body = JSON.parse(response.body)
        expect(body.name).toBe('entryPoint')
        expect(body.id).toBeDefined()
      })

      it('should reject without API key', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          payload: {
            chainId: 31337,
            name: 'entryPoint',
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          },
        })

        expect(response.statusCode).toBe(401)
      })

      it('should reject invalid address', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 31337,
            name: 'test',
            address: 'not-an-address',
          },
        })

        expect(response.statusCode).toBe(400)
      })
    })

    describe('GET /api/v1/contracts', () => {
      beforeEach(async () => {
        await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 31337,
            name: 'entryPoint',
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            tags: ['core'],
          },
        })
        await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 1,
            name: 'mainnetContract',
            address: '0x1234567890123456789012345678901234567890',
            tags: ['mainnet'],
          },
        })
      })

      it('should list all contracts', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveLength(2)
      })

      it('should filter by chainId', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts?chainId=31337',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveLength(1)
        expect(body[0].chainId).toBe(31337)
      })

      it('should filter by tag', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts?tag=core',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveLength(1)
        expect(body[0].name).toBe('entryPoint')
      })
    })

    describe('GET /api/v1/contracts/:chainId/:name', () => {
      beforeEach(async () => {
        await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 31337,
            name: 'entryPoint',
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          },
        })
      })

      it('should get contract by chainId and name', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts/31337/entryPoint',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.name).toBe('entryPoint')
      })

      it('should return 404 for non-existent contract', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts/31337/nonExistent',
        })

        expect(response.statusCode).toBe(404)
      })
    })

    describe('DELETE /api/v1/contracts/:chainId/:name', () => {
      beforeEach(async () => {
        await app.inject({
          method: 'POST',
          url: '/api/v1/contracts',
          headers: { 'x-api-key': API_KEY },
          payload: {
            chainId: 31337,
            name: 'toDelete',
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          },
        })
      })

      it('should delete contract with valid API key', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/v1/contracts/31337/toDelete',
          headers: { 'x-api-key': API_KEY },
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.body).success).toBe(true)

        const getResponse = await app.inject({
          method: 'GET',
          url: '/api/v1/contracts/31337/toDelete',
        })
        expect(getResponse.statusCode).toBe(404)
      })

      it('should reject delete without API key', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/v1/contracts/31337/toDelete',
        })

        expect(response.statusCode).toBe(401)
      })
    })
  })

  describe('Address Sets API', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/contracts',
        headers: { 'x-api-key': API_KEY },
        payload: {
          chainId: 31337,
          name: 'entryPoint',
          address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        },
      })
      await app.inject({
        method: 'POST',
        url: '/api/v1/contracts',
        headers: { 'x-api-key': API_KEY },
        payload: {
          chainId: 31337,
          name: 'paymaster',
          address: '0x1234567890123456789012345678901234567890',
        },
      })
    })

    it('should create and resolve an address set', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/sets',
        headers: { 'x-api-key': API_KEY },
        payload: {
          chainId: 31337,
          name: 'bundler-config',
          contracts: ['entryPoint', 'paymaster'],
        },
      })

      expect(createResponse.statusCode).toBe(201)

      const getResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/sets/31337/bundler-config',
      })

      expect(getResponse.statusCode).toBe(200)
      const body = JSON.parse(getResponse.body)
      expect(body.contracts).toHaveLength(2)
      expect(body.contracts[0].address).toBeDefined()
    })
  })

  describe('Chains API', () => {
    it('should list chain IDs', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/contracts',
        headers: { 'x-api-key': API_KEY },
        payload: {
          chainId: 1,
          name: 'mainnet',
          address: '0x1111111111111111111111111111111111111111',
        },
      })
      await app.inject({
        method: 'POST',
        url: '/api/v1/contracts',
        headers: { 'x-api-key': API_KEY },
        payload: {
          chainId: 31337,
          name: 'devnet',
          address: '0x2222222222222222222222222222222222222222',
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/chains',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.chains).toHaveLength(2)
      expect(body.chains.map((c: { chainId: number }) => c.chainId)).toEqual([1, 31337])
    })
  })

  describe('Bulk Import API', () => {
    it('should bulk import contracts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bulk/import',
        headers: { 'x-api-key': API_KEY },
        payload: {
          contracts: [
            {
              chainId: 31337,
              name: 'contract1',
              address: '0x1111111111111111111111111111111111111111',
            },
            {
              chainId: 31337,
              name: 'contract2',
              address: '0x2222222222222222222222222222222222222222',
            },
          ],
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.created).toBe(2)
      expect(body.updated).toBe(0)
    })
  })
})
