import { z } from 'zod'

export const createSetSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  contracts: z.array(z.string().min(1).max(128)).min(1),
  description: z.string().max(512).optional(),
})

export const setParamsSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  name: z.string().min(1),
})

export const setQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
})

export type CreateSetBody = z.infer<typeof createSetSchema>
export type SetParams = z.infer<typeof setParamsSchema>
export type SetQuery = z.infer<typeof setQuerySchema>
