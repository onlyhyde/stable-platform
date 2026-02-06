/**
 * JSON-RPC Types
 *
 * Common types for JSON-RPC 2.0 communication
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest<TParams = unknown[]> {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params: TParams
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse<TResult = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: TResult
  error?: JsonRpcError
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * JSON-RPC Client Configuration
 */
export interface JsonRpcClientConfig {
  /** RPC endpoint URL */
  url: string

  /** Request timeout in milliseconds */
  timeout?: number

  /** Maximum retry attempts */
  maxRetries?: number

  /** Retry delay in milliseconds */
  retryDelay?: number

  /** Custom headers */
  headers?: Record<string, string>

  /** API key for authentication */
  apiKey?: string
}

/**
 * Request options for individual calls
 */
export interface JsonRpcRequestOptions {
  /** Override default timeout */
  timeout?: number

  /** Override retry behavior */
  retries?: number

  /** Custom headers for this request */
  headers?: Record<string, string>
}

// ============================================================================
// Standard JSON-RPC Error Codes
// ============================================================================

/**
 * Standard JSON-RPC error codes
 */
export const JSON_RPC_ERROR_CODES = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Server errors (reserved for implementation-defined server-errors)
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const

/**
 * ERC-4337 Bundler specific error codes
 */
export const BUNDLER_ERROR_CODES = {
  // Entry Point related
  EXECUTION_REVERTED: -32500,
  OPERATION_REJECTED: -32501,
  OUT_OF_TIME_RANGE: -32502,
  PAYMASTER_REJECTED: -32503,
  OPCODE_VALIDATION: -32504,
  EXPIRY_OR_NONCE: -32505,
  INSUFFICIENT_STAKE: -32506,
  UNSUPPORTED_SIGNATURE: -32507,
  PAYMASTER_DEPOSIT_TOO_LOW: -32508,
} as const

/**
 * Paymaster specific error codes
 */
export const PAYMASTER_ERROR_CODES = {
  SPONSOR_NOT_AVAILABLE: -33001,
  TOKEN_NOT_SUPPORTED: -33002,
  INSUFFICIENT_BALANCE: -33003,
  RATE_LIMIT_EXCEEDED: -33004,
  POLICY_VIOLATION: -33005,
} as const

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is an error
 */
export function isJsonRpcError(
  response: JsonRpcResponse
): response is JsonRpcResponse & { error: JsonRpcError } {
  return response.error !== undefined
}

/**
 * Check if error code is a standard JSON-RPC error
 */
export function isStandardRpcError(code: number): boolean {
  return (
    code === JSON_RPC_ERROR_CODES.PARSE_ERROR ||
    code === JSON_RPC_ERROR_CODES.INVALID_REQUEST ||
    code === JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND ||
    code === JSON_RPC_ERROR_CODES.INVALID_PARAMS ||
    code === JSON_RPC_ERROR_CODES.INTERNAL_ERROR ||
    (code >= JSON_RPC_ERROR_CODES.SERVER_ERROR_END &&
      code <= JSON_RPC_ERROR_CODES.SERVER_ERROR_START)
  )
}

/**
 * Check if error code is a bundler-specific error
 */
export function isBundlerError(code: number): boolean {
  return code >= -32508 && code <= -32500
}

/**
 * Check if error code is a paymaster-specific error
 */
export function isPaymasterError(code: number): boolean {
  return code >= -33005 && code <= -33001
}
