import { z } from 'zod'

const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address')

const hexHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid transaction hash')

export const createContractSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  address: hexAddress,
  version: z.string().min(1).max(32).default('0.1.0'),
  tags: z.array(z.string().max(64)).max(20).default([]),
  abi: z.string().optional(),
  deployedAt: z.number().int().nonnegative().optional(),
  txHash: hexHash.optional(),
  metadata: z.record(z.unknown()).default({}),
})

export const contractParamsSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  name: z.string().min(1),
})

export const contractQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
  tag: z.string().optional(),
  name: z.string().optional(),
})

export type CreateContractBody = z.infer<typeof createContractSchema>
export type ContractParams = z.infer<typeof contractParamsSchema>
export type ContractQuery = z.infer<typeof contractQuerySchema>
