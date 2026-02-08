/**
 * WalletError - Base error class for wallet operations
 *
 * Provides unified error handling with:
 * - RPC error code preservation
 * - Cause chain tracking
 * - Context metadata for debugging
 * - Conversion to JSON-RPC error format
 */

import { RPC_ERRORS } from '../constants'

export interface WalletErrorContext {
  /** RPC method that triggered the error */
  method?: string
  /** Origin (dApp URL) that initiated the request */
  origin?: string
  /** Additional context for debugging */
  [key: string]: unknown
}

/**
 * Base error class for all wallet operations.
 * Preserves error cause chain and context for debugging.
 */
export class WalletError extends Error {
  readonly code: number
  readonly context: WalletErrorContext
  override readonly cause?: Error

  constructor(
    code: number,
    message: string,
    options?: { cause?: unknown; context?: WalletErrorContext }
  ) {
    super(message)
    this.name = 'WalletError'
    this.code = code
    this.context = options?.context ?? {}
    this.cause = options?.cause instanceof Error ? options.cause : undefined

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletError)
    }
  }

  /**
   * Convert to JSON-RPC error format for sending to dApps
   */
  toRpcError(): { code: number; message: string; data?: unknown } {
    return {
      code: this.code,
      message: this.message,
      ...(this.context.method && { data: { method: this.context.method } }),
    }
  }
}

/**
 * Check if an error already carries an RPC error code.
 * Used to avoid wrapping RPC errors in generic errors.
 */
export function isRpcLikeError(error: unknown): error is { code: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  )
}

/**
 * Wrap an approval controller error with proper context.
 * Re-throws RPC-coded errors as-is; wraps others as USER_REJECTED with cause.
 */
export function handleApprovalError(error: unknown, context?: WalletErrorContext): never {
  // If the error already has an RPC code (e.g., user rejection from approval popup), re-throw
  if (isRpcLikeError(error)) {
    throw error
  }

  // Wrap unknown errors with context - likely timeout or unexpected failure
  throw new WalletError(RPC_ERRORS.USER_REJECTED.code, RPC_ERRORS.USER_REJECTED.message, {
    cause: error,
    context,
  })
}
