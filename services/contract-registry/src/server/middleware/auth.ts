import type { FastifyReply, FastifyRequest } from 'fastify'

export function createAuthHook(apiKey: string | undefined) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    if (!apiKey) return

    const provided = request.headers['x-api-key']
    if (provided !== apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      })
    }
  }
}
