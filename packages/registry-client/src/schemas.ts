import { z } from 'zod'

const hexAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address')
  .transform((val) => val as `0x${string}`)

const hexHash = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid transaction hash')
  .transform((val) => val as `0x${string}`)

export const ContractEntrySchema = z.object({
  id: z.string(),
  chainId: z.number().int().positive(),
  name: z.string(),
  address: hexAddress,
  version: z.string(),
  tags: z.array(z.string()),
  abi: z.string().optional(),
  deployedAt: z.number().optional(),
  txHash: hexHash.optional(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ContractEntryListSchema = z.array(ContractEntrySchema)

export const ResolvedAddressSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  chainId: z.number().int().positive(),
  contracts: z.array(ContractEntrySchema),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const ImportErrorSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  message: z.string(),
})

export const ImportResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  errors: z.array(ImportErrorSchema).optional(),
})

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribed'), channels: z.array(z.string()) }),
  z.object({ type: z.literal('unsubscribed'), channels: z.array(z.string()) }),
  z.object({ type: z.literal('contract:updated'), data: ContractEntrySchema }),
  z.object({
    type: z.literal('contract:deleted'),
    chainId: z.number(),
    name: z.string(),
  }),
  z.object({ type: z.literal('set:updated'), data: ResolvedAddressSetSchema }),
  z.object({
    type: z.literal('set:deleted'),
    chainId: z.number(),
    name: z.string(),
  }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('error'), message: z.string() }),
])

export function validateChainId(chainId: number): void {
  if (!Number.isFinite(chainId) || !Number.isInteger(chainId) || chainId < 1) {
    throw new Error(`Invalid chainId: ${chainId}. Must be a positive integer.`)
  }
}

export function validateName(name: string): void {
  if (!name || name.includes('/') || name.includes('\\')) {
    throw new Error(
      `Invalid name: "${name}". Must be non-empty and cannot contain path separators.`
    )
  }
}
