/**
 * RPC Error Types
 * JSON-RPC 2.0 and EIP-1193 compliant error definitions
 */

/**
 * Standard JSON-RPC 2.0 error codes
 */
export const JSON_RPC_ERROR_CODES = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Server errors (reserved for implementation-defined errors)
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const

/**
 * EIP-1193 Provider error codes
 */
export const PROVIDER_ERROR_CODES = {
  USER_REJECTED_REQUEST: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
} as const

/**
 * EIP-1474 Ethereum RPC error codes
 */
export const ETH_RPC_ERROR_CODES = {
  INVALID_INPUT: -32000,
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_UNAVAILABLE: -32002,
  TRANSACTION_REJECTED: -32003,
  METHOD_NOT_SUPPORTED: -32004,
  LIMIT_EXCEEDED: -32005,
  JSON_RPC_VERSION_NOT_SUPPORTED: -32006,
} as const

/**
 * All error codes combined
 */
export type RpcErrorCode =
  | (typeof JSON_RPC_ERROR_CODES)[keyof typeof JSON_RPC_ERROR_CODES]
  | (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES]
  | (typeof ETH_RPC_ERROR_CODES)[keyof typeof ETH_RPC_ERROR_CODES]

/**
 * RPC Error data structure
 */
export interface RpcErrorData {
  code: RpcErrorCode
  message: string
  data?: unknown
}

/**
 * Serialized RPC Error for JSON-RPC response
 */
export interface SerializedRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Error message map for standard errors
 */
export const ERROR_MESSAGES: Record<number, string> = {
  // JSON-RPC 2.0
  [-32700]: 'Parse error',
  [-32600]: 'Invalid request',
  [-32601]: 'Method not found',
  [-32602]: 'Invalid params',
  [-32603]: 'Internal error',

  // EIP-1193
  [4001]: 'User rejected the request',
  [4100]: 'Unauthorized',
  [4200]: 'Unsupported method',
  [4900]: 'Disconnected',
  [4901]: 'Chain disconnected',

  // EIP-1474
  [-32000]: 'Invalid input',
  [-32001]: 'Resource not found',
  [-32002]: 'Resource unavailable',
  [-32003]: 'Transaction rejected',
  [-32004]: 'Method not supported',
  [-32005]: 'Limit exceeded',
}
