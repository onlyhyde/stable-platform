import { z } from 'zod'

const moduleTypes = ['validator', 'executor', 'hook', 'fallback'] as const
const categories = [
  'security',
  'defi',
  'governance',
  'social-recovery',
  'automation',
  'privacy',
  'identity',
  'utility',
] as const
const auditStatuses = ['unaudited', 'community-reviewed', 'audited', 'verified'] as const

export const CreateModuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  moduleType: z.enum(moduleTypes),
  category: z.enum(categories),
  addresses: z.record(z.coerce.number(), z.string().regex(/^0x[0-9a-fA-F]{40}$/)),
  author: z.string().min(1).max(100),
  authorAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  repositoryUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  auditStatus: z.enum(auditStatuses).default('unaudited'),
  auditReportUrl: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  abi: z.string().optional(),
  iconUrl: z.string().url().optional(),
  minKernelVersion: z.string().optional(),
})

export const UpdateModuleSchema = CreateModuleSchema.partial()

export const ModuleQuerySchema = z.object({
  moduleType: z.enum(moduleTypes).optional(),
  category: z.enum(categories).optional(),
  featured: z.coerce.boolean().optional(),
  deprecated: z.coerce.boolean().optional(),
  chainId: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const CreateInstallationSchema = z.object({
  moduleId: z.string().min(1),
  accountAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.coerce.number(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})

export const CreateReviewSchema = z.object({
  moduleId: z.string().min(1),
  reviewerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
})

// Param schemas for type-safe route parameters
export const IdParamSchema = z.object({
  id: z.string().min(1),
})

export const ModuleIdParamSchema = z.object({
  moduleId: z.string().min(1),
})

export const PopularQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
})

export const InstallationQuerySchema = z.object({
  accountAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
})
