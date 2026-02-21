import { z } from 'zod'

/**
 * Hex string schema
 */
export const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, 'Invalid hex string')

/**
 * Address schema (20 bytes)
 */
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid address')

/**
 * UserOperation schema (ERC-4337 v0.7)
 */
export const userOperationSchema = z.object({
  sender: addressSchema,
  nonce: hexSchema,
  factory: addressSchema.optional(),
  factoryData: hexSchema.optional(),
  callData: hexSchema,
  callGasLimit: hexSchema,
  verificationGasLimit: hexSchema,
  preVerificationGas: hexSchema,
  maxFeePerGas: hexSchema,
  maxPriorityFeePerGas: hexSchema,
  paymaster: addressSchema.optional(),
  paymasterVerificationGasLimit: hexSchema.optional(),
  paymasterPostOpGasLimit: hexSchema.optional(),
  paymasterData: hexSchema.optional(),
  signature: hexSchema,
})

/**
 * Packed UserOperation schema
 */
export const packedUserOperationSchema = z.object({
  sender: addressSchema,
  nonce: hexSchema,
  initCode: hexSchema,
  callData: hexSchema,
  accountGasLimits: hexSchema,
  preVerificationGas: hexSchema,
  gasFees: hexSchema,
  paymasterAndData: hexSchema,
  signature: hexSchema,
})

/**
 * Either unpacked or packed UserOperation
 */
export const anyUserOperationSchema = z.union([userOperationSchema, packedUserOperationSchema])

/**
 * Context schema with paymaster type routing
 */
export const contextSchema = z
  .object({
    paymasterType: z.enum(['verifying', 'erc20', 'permit2', 'sponsor']).optional(),
    tokenAddress: addressSchema.optional(),
    policyId: z.string().optional(),
  })
  .passthrough()
  .optional()

/**
 * JSON-RPC request schema
 */
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.number(), z.string()]),
  method: z.string(),
  params: z.array(z.unknown()).optional().default([]),
})

/**
 * pm_getPaymasterStubData params schema
 */
export const getPaymasterStubDataParamsSchema = z
  .tuple([
    anyUserOperationSchema, // UserOperation
    addressSchema, // EntryPoint
    hexSchema, // Chain ID
    contextSchema, // Context (optional)
  ])
  .or(z.tuple([anyUserOperationSchema, addressSchema, hexSchema]))

/**
 * pm_getPaymasterData params schema
 */
export const getPaymasterDataParamsSchema = z
  .tuple([
    anyUserOperationSchema, // UserOperation
    addressSchema, // EntryPoint
    hexSchema, // Chain ID
    contextSchema, // Context (optional)
  ])
  .or(z.tuple([anyUserOperationSchema, addressSchema, hexSchema]))

/**
 * pm_supportedTokens params schema
 * Params: [chainId (hex)]
 */
export const supportedTokensParamsSchema = z.tuple([hexSchema])

/**
 * pm_estimateTokenPayment params schema
 * Params: [userOp, entryPoint, chainId, tokenAddress]
 */
export const estimateTokenPaymentParamsSchema = z.tuple([
  anyUserOperationSchema,
  addressSchema,
  hexSchema,
  addressSchema,
])

/**
 * pm_getSponsorPolicy params schema
 * Params: [senderAddress, operation (optional), chainId (hex)]
 */
export const getSponsorPolicyParamsSchema = z
  .tuple([addressSchema, z.string(), hexSchema])
  .or(z.tuple([addressSchema, hexSchema]))

export type UserOperationInput = z.infer<typeof userOperationSchema>
export type PackedUserOperationInput = z.infer<typeof packedUserOperationSchema>
export type AnyUserOperationInput = z.infer<typeof anyUserOperationSchema>
export type JsonRpcRequestInput = z.infer<typeof jsonRpcRequestSchema>
