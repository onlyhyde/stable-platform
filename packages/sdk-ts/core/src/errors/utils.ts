/**
 * Error Handling Utilities
 * Helper functions for normalizing, checking, and creating errors
 */

import {
  BundlerError,
  ConfigurationError,
  PaymasterError,
  SdkError,
  TransactionError,
  UserOperationError,
  ValidationError,
} from './SdkError'
import type { BundlerErrorCode, ErrorContext, SdkErrorCode } from './types'
import { BUNDLER_ERROR_CODES, SDK_ERROR_CODES } from './types'

/**
 * Check if an error is an SdkError
 */
export function isSdkError(error: unknown): error is SdkError {
  return error instanceof SdkError
}

/**
 * Check if an error is a BundlerError
 */
export function isBundlerError(error: unknown): error is BundlerError {
  return error instanceof BundlerError
}

/**
 * Check if an error is a UserOperationError
 */
export function isUserOperationError(error: unknown): error is UserOperationError {
  return error instanceof UserOperationError
}

/**
 * Check if an error is a TransactionError
 */
export function isTransactionError(error: unknown): error is TransactionError {
  return error instanceof TransactionError
}

/**
 * Check if an error is a PaymasterError
 */
export function isPaymasterError(error: unknown): error is PaymasterError {
  return error instanceof PaymasterError
}

/**
 * Normalize any error to SdkError
 */
export function normalizeError(error: unknown, context?: ErrorContext): SdkError {
  // Already an SdkError
  if (error instanceof SdkError) {
    return error
  }

  // Bundler RPC error (from JSON-RPC response)
  if (isJsonRpcError(error)) {
    const bundlerCode = getBundlerErrorCode(error.code)
    if (bundlerCode !== undefined) {
      return new BundlerError({
        code: bundlerCode,
        message: error.message,
        data: error.data,
        context,
      })
    }
  }

  // Network error (TypeError from fetch)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new SdkError({
      code: SDK_ERROR_CODES.NETWORK_ERROR,
      message: 'Network request failed',
      cause: error,
      context,
    })
  }

  // Standard Error
  if (error instanceof Error) {
    // Try to infer error type from message
    const code = inferErrorCodeFromMessage(error.message)
    return new SdkError({
      code,
      message: error.message,
      cause: error,
      context,
    })
  }

  // Unknown error type
  return new SdkError({
    code: SDK_ERROR_CODES.UNKNOWN_ERROR,
    message: String(error),
    cause: error,
    context,
  })
}

/**
 * Check if error looks like a JSON-RPC error
 */
interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

function isJsonRpcError(error: unknown): error is JsonRpcError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as JsonRpcError).code === 'number' &&
    'message' in error &&
    typeof (error as JsonRpcError).message === 'string'
  )
}

/**
 * Get bundler error code from numeric code
 */
function getBundlerErrorCode(code: number): BundlerErrorCode | undefined {
  const codes = Object.values(BUNDLER_ERROR_CODES)
  if (codes.includes(code as BundlerErrorCode)) {
    return code as BundlerErrorCode
  }
  return undefined
}

/**
 * Infer error code from error message
 */
function inferErrorCodeFromMessage(message: string): SdkErrorCode {
  const lowercaseMessage = message.toLowerCase()

  if (lowercaseMessage.includes('network') || lowercaseMessage.includes('fetch')) {
    return SDK_ERROR_CODES.NETWORK_ERROR
  }

  if (lowercaseMessage.includes('timeout')) {
    return SDK_ERROR_CODES.TRANSACTION_TIMEOUT
  }

  if (lowercaseMessage.includes('rejected') || lowercaseMessage.includes('denied')) {
    return SDK_ERROR_CODES.TRANSACTION_REJECTED
  }

  if (lowercaseMessage.includes('revert')) {
    return SDK_ERROR_CODES.TRANSACTION_REVERTED
  }

  if (lowercaseMessage.includes('signature')) {
    return SDK_ERROR_CODES.SIGNATURE_INVALID
  }

  if (lowercaseMessage.includes('gas')) {
    return SDK_ERROR_CODES.INSUFFICIENT_GAS
  }

  if (lowercaseMessage.includes('unauthorized') || lowercaseMessage.includes('401')) {
    return SDK_ERROR_CODES.UNAUTHORIZED
  }

  if (lowercaseMessage.includes('forbidden') || lowercaseMessage.includes('403')) {
    return SDK_ERROR_CODES.FORBIDDEN
  }

  if (lowercaseMessage.includes('invalid')) {
    return SDK_ERROR_CODES.VALIDATION_ERROR
  }

  return SDK_ERROR_CODES.UNKNOWN_ERROR
}

/**
 * Create a bundler error from RPC response
 */
export function createBundlerError(
  code: number,
  message: string,
  data?: unknown,
  context?: ErrorContext
): BundlerError {
  const bundlerCode = getBundlerErrorCode(code) ?? BUNDLER_ERROR_CODES.INTERNAL_ERROR
  return new BundlerError({
    code: bundlerCode,
    message,
    data,
    context,
  })
}

/**
 * Create a user operation error
 */
export function createUserOperationError(
  message: string,
  options?: {
    code?: SdkErrorCode
    userOpHash?: string
    sender?: string
    reason?: string
    revertData?: string
    gasUsed?: bigint
    context?: ErrorContext
  }
): UserOperationError {
  return new UserOperationError(options?.code ?? SDK_ERROR_CODES.USER_OP_FAILED, message, {
    userOpHash: options?.userOpHash as `0x${string}` | undefined,
    sender: options?.sender as `0x${string}` | undefined,
    reason: options?.reason,
    revertData: options?.revertData as `0x${string}` | undefined,
    gasUsed: options?.gasUsed,
    context: options?.context,
  })
}

/**
 * Create a transaction error
 */
export function createTransactionError(
  message: string,
  options?: {
    code?: SdkErrorCode
    txHash?: string
    from?: string
    to?: string
    reason?: string
    revertData?: string
    gasUsed?: bigint
    context?: ErrorContext
  }
): TransactionError {
  return new TransactionError(options?.code ?? SDK_ERROR_CODES.TRANSACTION_FAILED, message, {
    txHash: options?.txHash as `0x${string}` | undefined,
    from: options?.from as `0x${string}` | undefined,
    to: options?.to as `0x${string}` | undefined,
    reason: options?.reason,
    revertData: options?.revertData as `0x${string}` | undefined,
    gasUsed: options?.gasUsed,
    context: options?.context,
  })
}

/**
 * Create a configuration error
 */
export function createConfigurationError(
  message: string,
  parameterName?: string,
  context?: ErrorContext
): ConfigurationError {
  return new ConfigurationError(message, parameterName, context)
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: unknown,
  context?: ErrorContext
): ValidationError {
  return new ValidationError(message, field, value, context)
}

/**
 * Create a paymaster error
 */
export function createPaymasterError(
  code: string,
  message: string,
  options?: {
    rpcCode?: number
    reason?: string
    context?: ErrorContext
  }
): PaymasterError {
  return new PaymasterError(code, message, {
    rpcCode: options?.rpcCode,
    reason: options?.reason,
    context: options?.context,
  })
}

/**
 * Wrap an async function with error normalization
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      throw normalizeError(error, context)
    }
  }) as T
}

/**
 * Assert a condition, throwing a validation error if false
 */
export function assertCondition(
  condition: boolean,
  message: string,
  field?: string,
  value?: unknown
): asserts condition {
  if (!condition) {
    throw createValidationError(message, field, value)
  }
}

/**
 * Assert a value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  parameterName: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw createConfigurationError(
      `Required parameter "${parameterName}" is not defined`,
      parameterName
    )
  }
}
