import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import type { ModuleStore } from '../../store/memory-store'
import { createAuthHook } from '../middleware/auth'
import {
  CreateInstallationSchema,
  CreateModuleSchema,
  CreateReviewSchema,
  IdParamSchema,
  InstallationQuerySchema,
  ModuleIdParamSchema,
  ModuleQuerySchema,
  PopularQuerySchema,
  SearchQuerySchema,
  UpdateModuleSchema,
} from '../schemas/module'

export function registerModuleRoutes(app: FastifyInstance, store: ModuleStore, apiKey?: string) {
  const authHook = createAuthHook(apiKey)
  // ─── List Modules ───
  app.get('/api/v1/modules', async (request, reply) => {
    const query = ModuleQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid query parameters', details: query.error.issues })
    }

    const { limit, offset, ...filters } = query.data
    const modules = store.listModules(filters)
    const paginated = modules.slice(offset, offset + limit)

    return {
      data: paginated,
      meta: { total: modules.length, limit, offset },
    }
  })

  // ─── Get Featured Modules ───
  app.get('/api/v1/modules/featured', async () => {
    return { data: store.getFeaturedModules() }
  })

  // ─── Get Popular Modules ───
  app.get('/api/v1/modules/popular', async (request) => {
    const query = PopularQuerySchema.safeParse(request.query)
    return { data: store.getPopularModules(query.success ? query.data.limit : 10) }
  })

  // ─── Search Modules ───
  app.get('/api/v1/modules/search', async (request, reply) => {
    const query = SearchQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: 'Invalid query', details: query.error.issues })
    }

    const results = store.searchModules(query.data.q)
    return { data: results.slice(0, query.data.limit), meta: { total: results.length } }
  })

  // ─── Get Module by ID ───
  app.get('/api/v1/modules/:id', async (request, reply) => {
    const params = IdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: params.error.issues })
    }
    const module = store.getModule(params.data.id)

    if (!module) {
      return reply.status(404).send({ error: 'Module not found' })
    }

    return { data: module }
  })

  // ─── Create Module ───
  app.post('/api/v1/modules', { preHandler: authHook }, async (request, reply) => {
    const body = CreateModuleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid module data', details: body.error.issues })
    }

    const now = new Date().toISOString()
    const module = {
      id: nanoid(12),
      ...body.data,
      installCount: 0,
      rating: 0,
      ratingCount: 0,
      featured: false,
      deprecated: false,
      createdAt: now,
      updatedAt: now,
    }

    store.addModule(module)
    return reply.status(201).send({ data: module })
  })

  // ─── Update Module ───
  app.put('/api/v1/modules/:id', { preHandler: authHook }, async (request, reply) => {
    const params = IdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: params.error.issues })
    }
    const body = UpdateModuleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid update data', details: body.error.issues })
    }

    const updated = store.updateModule(params.data.id, body.data)
    if (!updated) {
      return reply.status(404).send({ error: 'Module not found' })
    }

    return { data: updated }
  })

  // ─── Delete Module ───
  app.delete('/api/v1/modules/:id', { preHandler: authHook }, async (request, reply) => {
    const params = IdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: params.error.issues })
    }
    const deleted = store.deleteModule(params.data.id)
    if (!deleted) {
      return reply.status(404).send({ error: 'Module not found' })
    }
    return reply.status(204).send()
  })

  // ─── Installations ───

  app.post('/api/v1/installations', { preHandler: authHook }, async (request, reply) => {
    const body = CreateInstallationSchema.safeParse(request.body)
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid installation data', details: body.error.issues })
    }

    const module = store.getModule(body.data.moduleId)
    if (!module) {
      return reply.status(404).send({ error: 'Module not found' })
    }

    const installation = {
      id: nanoid(12),
      ...body.data,
      installedAt: new Date().toISOString(),
      active: true,
    }

    store.addInstallation(installation)
    return reply.status(201).send({ data: installation })
  })

  app.get('/api/v1/installations', async (request) => {
    const query = InstallationQuerySchema.safeParse(request.query)
    const accountAddress = query.success ? query.data.accountAddress : undefined
    if (!accountAddress) {
      return { data: [], meta: { total: 0 } }
    }
    const installations = store.listInstallationsForAccount(accountAddress)
    return { data: installations, meta: { total: installations.length } }
  })

  app.delete('/api/v1/installations/:id', { preHandler: authHook }, async (request, reply) => {
    const params = IdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: params.error.issues })
    }
    const deactivated = store.deactivateInstallation(params.data.id)
    if (!deactivated) {
      return reply.status(404).send({ error: 'Installation not found' })
    }
    return reply.status(204).send()
  })

  // ─── Reviews ───

  app.post('/api/v1/reviews', { preHandler: authHook }, async (request, reply) => {
    const body = CreateReviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid review data', details: body.error.issues })
    }

    const module = store.getModule(body.data.moduleId)
    if (!module) {
      return reply.status(404).send({ error: 'Module not found' })
    }

    const review = {
      id: nanoid(12),
      ...body.data,
      createdAt: new Date().toISOString(),
    }

    store.addReview(review)
    return reply.status(201).send({ data: review })
  })

  app.get('/api/v1/reviews/:moduleId', async (request, reply) => {
    const params = ModuleIdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: params.error.issues })
    }
    const reviews = store.getReviewsForModule(params.data.moduleId)
    return { data: reviews, meta: { total: reviews.length } }
  })

  // ─── Stats ───

  app.get('/api/v1/stats', async () => ({
    modules: store.getModuleCount(),
    installations: store.getInstallationCount(),
    categories: {
      security: store.listModules({ category: 'security' }).length,
      defi: store.listModules({ category: 'defi' }).length,
      governance: store.listModules({ category: 'governance' }).length,
      automation: store.listModules({ category: 'automation' }).length,
      privacy: store.listModules({ category: 'privacy' }).length,
      'social-recovery': store.listModules({ category: 'social-recovery' }).length,
      identity: store.listModules({ category: 'identity' }).length,
      utility: store.listModules({ category: 'utility' }).length,
    },
  }))
}
