import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodError, ZodSchema } from 'zod'

function formatZodError(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: formatZodError(result.error),
      })
    }
    ;(request as FastifyRequest & { validatedBody: T }).validatedBody = result.data
  }
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.params)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: formatZodError(result.error),
      })
    }
    ;(request as FastifyRequest & { validatedParams: T }).validatedParams = result.data
  }
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: formatZodError(result.error),
      })
    }
    ;(request as FastifyRequest & { validatedQuery: T }).validatedQuery = result.data
  }
}
