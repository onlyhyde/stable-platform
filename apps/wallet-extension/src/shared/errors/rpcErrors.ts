/**
 * RPC Errors Implementation
 * JSON-RPC 2.0 and EIP-1193 compliant error classes and factory functions
 */

import {
  JSON_RPC_ERROR_CODES,
  PROVIDER_ERROR_CODES,
  ETH_RPC_ERROR_CODES,
  ERROR_MESSAGES,
  type SerializedRpcError,
} from './rpcErrors.types'

/**
 * Base RPC Error class
 * Implements JSON-RPC 2.0 error object specification
 */
export class RpcError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RpcError)
    }
  }

  /**
   * Serialize error to JSON-RPC format
   */
  serialize(): SerializedRpcError {
    const serialized: SerializedRpcError = {
      code: this.code,
      message: this.message,
    }

    if (this.data !== undefined) {
      serialized.data = this.data
    }

    return serialized
  }

  /**
   * Custom JSON serialization
   */
  toJSON(): SerializedRpcError {
    return this.serialize()
  }
}

/**
 * EIP-1193 Provider Error class
 * Used for provider-specific errors (4xxx codes)
 */
export class ProviderRpcError extends RpcError {
  constructor(code: number, message: string, data?: unknown) {
    super(code, message, data)
    this.name = 'ProviderRpcError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderRpcError)
    }
  }
}

// =============================================================================
// JSON-RPC 2.0 Error Factory Functions
// =============================================================================

/**
 * Parse Error (-32700)
 * Invalid JSON was received by the server
 */
export function parseError(data?: unknown): RpcError {
  return new RpcError(
    JSON_RPC_ERROR_CODES.PARSE_ERROR,
    ERROR_MESSAGES[JSON_RPC_ERROR_CODES.PARSE_ERROR],
    data
  )
}

/**
 * Invalid Request (-32600)
 * The JSON sent is not a valid Request object
 */
export function invalidRequest(data?: unknown): RpcError {
  return new RpcError(
    JSON_RPC_ERROR_CODES.INVALID_REQUEST,
    ERROR_MESSAGES[JSON_RPC_ERROR_CODES.INVALID_REQUEST],
    data
  )
}

/**
 * Method Not Found (-32601)
 * The method does not exist / is not available
 */
export function methodNotFound(method: string, data?: unknown): RpcError {
  return new RpcError(
    JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
    `Method not found: ${method}`,
    data
  )
}

/**
 * Invalid Params (-32602)
 * Invalid method parameter(s)
 */
export function invalidParams(message?: string, data?: unknown): RpcError {
  return new RpcError(
    JSON_RPC_ERROR_CODES.INVALID_PARAMS,
    message || ERROR_MESSAGES[JSON_RPC_ERROR_CODES.INVALID_PARAMS],
    data
  )
}

/**
 * Internal Error (-32603)
 * Internal JSON-RPC error
 */
export function internalError(message?: string, data?: unknown): RpcError {
  return new RpcError(
    JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
    message || ERROR_MESSAGES[JSON_RPC_ERROR_CODES.INTERNAL_ERROR],
    data
  )
}

// =============================================================================
// EIP-1193 Provider Error Factory Functions
// =============================================================================

/**
 * User Rejected Request (4001)
 * The user rejected the request
 */
export function userRejectedRequest(data?: unknown): ProviderRpcError {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.USER_REJECTED_REQUEST,
    ERROR_MESSAGES[PROVIDER_ERROR_CODES.USER_REJECTED_REQUEST],
    data
  )
}

/**
 * Unauthorized (4100)
 * The requested method and/or account has not been authorized by the user
 */
export function unauthorized(data?: unknown): ProviderRpcError {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.UNAUTHORIZED,
    ERROR_MESSAGES[PROVIDER_ERROR_CODES.UNAUTHORIZED],
    data
  )
}

/**
 * Unsupported Method (4200)
 * The Provider does not support the requested method
 */
export function unsupportedMethod(method: string, data?: unknown): ProviderRpcError {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.UNSUPPORTED_METHOD,
    `Unsupported method: ${method}`,
    data
  )
}

/**
 * Disconnected (4900)
 * The Provider is disconnected from all chains
 */
export function disconnected(data?: unknown): ProviderRpcError {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.DISCONNECTED,
    ERROR_MESSAGES[PROVIDER_ERROR_CODES.DISCONNECTED],
    data
  )
}

/**
 * Chain Disconnected (4901)
 * The Provider is not connected to the requested chain
 */
export function chainDisconnected(data?: unknown): ProviderRpcError {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.CHAIN_DISCONNECTED,
    ERROR_MESSAGES[PROVIDER_ERROR_CODES.CHAIN_DISCONNECTED],
    data
  )
}

// =============================================================================
// EIP-1474 Ethereum RPC Error Factory Functions
// =============================================================================

/**
 * Transaction Rejected (-32003)
 * The transaction was rejected
 */
export function transactionRejected(message?: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.TRANSACTION_REJECTED,
    message || ERROR_MESSAGES[ETH_RPC_ERROR_CODES.TRANSACTION_REJECTED],
    data
  )
}

/**
 * Resource Not Found (-32001)
 * The requested resource was not found
 */
export function resourceNotFound(message: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.RESOURCE_NOT_FOUND,
    message,
    data
  )
}

/**
 * Resource Unavailable (-32002)
 * The requested resource is not available
 */
export function resourceUnavailable(message?: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.RESOURCE_UNAVAILABLE,
    message || ERROR_MESSAGES[ETH_RPC_ERROR_CODES.RESOURCE_UNAVAILABLE],
    data
  )
}

/**
 * Invalid Input (-32000)
 * Invalid input to method
 */
export function invalidInput(message?: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.INVALID_INPUT,
    message || ERROR_MESSAGES[ETH_RPC_ERROR_CODES.INVALID_INPUT],
    data
  )
}

/**
 * Method Not Supported (-32004)
 * Method is not implemented
 */
export function methodNotSupported(method: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.METHOD_NOT_SUPPORTED,
    `Method not supported: ${method}`,
    data
  )
}

/**
 * Limit Exceeded (-32005)
 * Request exceeds defined limit
 */
export function limitExceeded(message?: string, data?: unknown): RpcError {
  return new RpcError(
    ETH_RPC_ERROR_CODES.LIMIT_EXCEEDED,
    message || ERROR_MESSAGES[ETH_RPC_ERROR_CODES.LIMIT_EXCEEDED],
    data
  )
}

// Re-export types for convenience
export {
  JSON_RPC_ERROR_CODES,
  PROVIDER_ERROR_CODES,
  ETH_RPC_ERROR_CODES,
  ERROR_MESSAGES,
} from './rpcErrors.types'

export type {
  RpcErrorCode,
  RpcErrorData,
  SerializedRpcError,
} from './rpcErrors.types'
