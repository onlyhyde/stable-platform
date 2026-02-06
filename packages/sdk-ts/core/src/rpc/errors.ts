/**
 * JSON-RPC Error Classes
 *
 * Unified error handling for RPC operations
 */

import type { JsonRpcError } from './types'
import { BUNDLER_ERROR_CODES, JSON_RPC_ERROR_CODES, PAYMASTER_ERROR_CODES } from './types'

// ============================================================================
// Error Types
// ============================================================================

export type RpcErrorType =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'RPC_ERROR'
  | 'BUNDLER_ERROR'
  | 'PAYMASTER_ERROR'
  | 'UNKNOWN'

// ============================================================================
// Base RPC Error
// ============================================================================

/**
 * Base RPC Error class
 */
export class RpcError extends Error {
  readonly type: RpcErrorType
  readonly code?: number
  readonly data?: unknown
  readonly url?: string
  readonly method?: string

  constructor(
    type: RpcErrorType,
    message: string,
    options?: {
      code?: number
      data?: unknown
      url?: string
      method?: string
      cause?: Error
    }
  ) {
    super(message, { cause: options?.cause })
    this.name = 'RpcError'
    this.type = type
    this.code = options?.code
    this.data = options?.data
    this.url = options?.url
    this.method = options?.method
  }

  /**
   * Create error from JSON-RPC error response
   */
  static fromRpcError(error: JsonRpcError, options?: { url?: string; method?: string }): RpcError {
    const type = determineErrorType(error.code)
    return new RpcError(type, error.message, {
      code: error.code,
      data: error.data,
      url: options?.url,
      method: options?.method,
    })
  }

  /**
   * Create timeout error
   */
  static timeout(url: string, timeoutMs: number): RpcError {
    return new RpcError('TIMEOUT', `Request timeout after ${timeoutMs}ms`, { url })
  }

  /**
   * Create network error
   */
  static network(url: string, cause?: Error): RpcError {
    return new RpcError('NETWORK', `Network error: ${cause?.message ?? 'Unknown'}`, { url, cause })
  }

  /**
   * Create HTTP error
   */
  static http(url: string, status: number, statusText: string): RpcError {
    return new RpcError('HTTP_ERROR', `HTTP ${status}: ${statusText}`, {
      url,
      code: status,
    })
  }

  /**
   * Create parse error
   */
  static parseError(url: string, cause?: Error): RpcError {
    return new RpcError(
      'PARSE_ERROR',
      `Failed to parse response: ${cause?.message ?? 'Invalid JSON'}`,
      { url, code: JSON_RPC_ERROR_CODES.PARSE_ERROR, cause }
    )
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    switch (this.type) {
      case 'TIMEOUT':
      case 'NETWORK':
        return true
      case 'HTTP_ERROR':
        // Retry on 429 (rate limit), 502, 503, 504 (server errors)
        return this.code === 429 || this.code === 502 || this.code === 503 || this.code === 504
      case 'RPC_ERROR':
        // Retry on internal server errors
        return (
          this.code !== undefined &&
          this.code >= JSON_RPC_ERROR_CODES.SERVER_ERROR_END &&
          this.code <= JSON_RPC_ERROR_CODES.SERVER_ERROR_START
        )
      default:
        return false
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      code: this.code,
      data: this.data,
      url: this.url,
      method: this.method,
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine error type from RPC error code
 */
function determineErrorType(code?: number): RpcErrorType {
  if (code === undefined) return 'RPC_ERROR'

  // Check bundler errors
  if (
    code >= BUNDLER_ERROR_CODES.PAYMASTER_DEPOSIT_TOO_LOW &&
    code <= BUNDLER_ERROR_CODES.EXECUTION_REVERTED
  ) {
    return 'BUNDLER_ERROR'
  }

  // Check paymaster errors
  if (
    code >= PAYMASTER_ERROR_CODES.POLICY_VIOLATION &&
    code <= PAYMASTER_ERROR_CODES.SPONSOR_NOT_AVAILABLE
  ) {
    return 'PAYMASTER_ERROR'
  }

  // Standard JSON-RPC error
  return 'RPC_ERROR'
}

/**
 * Check if error is an RpcError
 */
export function isRpcError(error: unknown): error is RpcError {
  return error instanceof RpcError
}

/**
 * Get human-readable error description
 */
export function getErrorDescription(code: number): string {
  // Standard JSON-RPC errors
  switch (code) {
    case JSON_RPC_ERROR_CODES.PARSE_ERROR:
      return 'Invalid JSON was received by the server'
    case JSON_RPC_ERROR_CODES.INVALID_REQUEST:
      return 'The JSON sent is not a valid Request object'
    case JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND:
      return 'The method does not exist or is not available'
    case JSON_RPC_ERROR_CODES.INVALID_PARAMS:
      return 'Invalid method parameters'
    case JSON_RPC_ERROR_CODES.INTERNAL_ERROR:
      return 'Internal JSON-RPC error'
  }

  // Bundler errors
  switch (code) {
    case BUNDLER_ERROR_CODES.EXECUTION_REVERTED:
      return 'UserOperation execution reverted'
    case BUNDLER_ERROR_CODES.OPERATION_REJECTED:
      return 'UserOperation rejected by bundler'
    case BUNDLER_ERROR_CODES.OUT_OF_TIME_RANGE:
      return 'UserOperation outside valid time range'
    case BUNDLER_ERROR_CODES.PAYMASTER_REJECTED:
      return 'Paymaster rejected the operation'
    case BUNDLER_ERROR_CODES.OPCODE_VALIDATION:
      return 'Opcode validation failed'
    case BUNDLER_ERROR_CODES.EXPIRY_OR_NONCE:
      return 'Invalid expiry or nonce'
    case BUNDLER_ERROR_CODES.INSUFFICIENT_STAKE:
      return 'Insufficient stake'
    case BUNDLER_ERROR_CODES.UNSUPPORTED_SIGNATURE:
      return 'Unsupported signature type'
    case BUNDLER_ERROR_CODES.PAYMASTER_DEPOSIT_TOO_LOW:
      return 'Paymaster deposit too low'
  }

  // Paymaster errors
  switch (code) {
    case PAYMASTER_ERROR_CODES.SPONSOR_NOT_AVAILABLE:
      return 'Gas sponsorship not available'
    case PAYMASTER_ERROR_CODES.TOKEN_NOT_SUPPORTED:
      return 'ERC20 token not supported for gas payment'
    case PAYMASTER_ERROR_CODES.INSUFFICIENT_BALANCE:
      return 'Insufficient token balance for gas payment'
    case PAYMASTER_ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return 'Rate limit exceeded'
    case PAYMASTER_ERROR_CODES.POLICY_VIOLATION:
      return 'Policy violation'
  }

  return 'Unknown error'
}
