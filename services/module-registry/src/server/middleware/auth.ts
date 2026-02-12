import type { FastifyReply, FastifyRequest } from 'fastify'

export function createAuthHook(apiKey: string | undefined) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'API key not configured',
        })
      }
      return
    }

    const provided = request.headers['x-api-key']
    if (provided !== apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      })
    }
  }
}
