import { RPC_ERRORS } from '../../shared/constants'
import { RpcError } from '../../shared/errors/rpcErrors'
import { sanitizeErrorMessage } from '../../shared/security/errorSanitizer'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { accountsHandlers } from './handlers/accounts'
import { blockchainHandlers } from './handlers/blockchain'
import { customHandlers } from './handlers/custom'
import { gasHandlers } from './handlers/gas'
import { modulesHandlers } from './handlers/modules'
import { networkHandlers } from './handlers/network'
import { operationsHandlers } from './handlers/operations'
import { paymasterHandlers } from './handlers/paymaster'
import { permissionsHandlers } from './handlers/permissions'
import {
  createRpcError,
  inputValidator,
  type RpcHandler,
  rateLimiter,
  validateRpcParams,
} from './handlers/shared'
import { signingHandlers } from './handlers/signing'
import { transactionsHandlers } from './handlers/transactions'
import { userOpsHandlers } from './handlers/userOps'

/**
 * RPC method handlers — merged from domain-specific modules
 */
const handlers: Record<string, RpcHandler> = {
  ...accountsHandlers,
  ...networkHandlers,
  ...blockchainHandlers,
  ...signingHandlers,
  ...userOpsHandlers,
  ...transactionsHandlers,
  ...modulesHandlers,
  ...operationsHandlers,
  ...gasHandlers,
  ...permissionsHandlers,
  ...paymasterHandlers,
  ...customHandlers,
}

/**
 * Handle an RPC request
 */
export async function handleRpcRequest(
  request: JsonRpcRequest,
  origin: string,
  isExtension = false
): Promise<JsonRpcResponse> {
  const { id, method, params } = request

  try {
    // Check rate limit (SEC-4) — only for external dApp requests
    // Internal extension UI is trusted and should not be rate-limited
    if (!isExtension) {
      const rateLimitResult = rateLimiter.checkLimit(origin, method)
      if (!rateLimitResult.allowed) {
        throw createRpcError({
          code: RPC_ERRORS.LIMIT_EXCEEDED.code,
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds`,
          data: {
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
            retryAfter: rateLimitResult.retryAfter,
          },
        })
      }
    }

    // Validate RPC request structure
    const rpcValidation = inputValidator.validateRpcRequest({
      method,
      params,
      id,
    })
    if (!rpcValidation.isValid) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_REQUEST.code,
        message: rpcValidation.errors.join(', '),
      })
    }

    // Validate method-specific params
    validateRpcParams(method, params)

    const handler = handlers[method]

    if (!handler) {
      throw createRpcError(RPC_ERRORS.METHOD_NOT_FOUND)
    }

    const result = await handler(params, origin, isExtension)

    return {
      jsonrpc: '2.0',
      id,
      result,
    }
  } catch (error) {
    // Use RpcError's serialize() if available, otherwise extract code/message
    if (error instanceof RpcError) {
      return { jsonrpc: '2.0', id, error: error.serialize() }
    }

    const err = error as Error & { code?: number; data?: unknown }
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: isExtension
          ? (err.message ?? RPC_ERRORS.INTERNAL_ERROR.message)
          : sanitizeErrorMessage(err, { allowSafeMessages: true, logOriginal: true }),
        ...(isExtension ? { data: err.data } : {}),
      },
    }
  }
}

/**
 * Check if a method is supported
 */
export function isMethodSupported(method: string): method is SupportedMethod {
  return method in handlers
}
