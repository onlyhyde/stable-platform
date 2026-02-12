/**
 * RPC Error Codes and Types
 * Includes JSON-RPC standard codes, EIP-1193 provider codes, and ERC-4337 bundler codes
 */

/**
 * Standard JSON-RPC error codes
 */
export const JSON_RPC_ERROR_CODES = {
  /** Invalid JSON */
  PARSE_ERROR: -32700,
  /** Invalid request object */
  INVALID_REQUEST: -32600,
  /** Method not found */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameters */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
} as const

/**
 * EIP-1193 Provider error codes
 * https://eips.ethereum.org/EIPS/eip-1193
 */
export const PROVIDER_ERROR_CODES = {
  /** User rejected the request */
  USER_REJECTED: 4001,
  /** Account not authorized */
  UNAUTHORIZED: 4100,
  /** Method not supported by provider */
  UNSUPPORTED_METHOD: 4200,
  /** Provider disconnected from all chains */
  DISCONNECTED: 4900,
  /** Provider disconnected from specified chain */
  CHAIN_DISCONNECTED: 4901,
} as const

// BUNDLER_ERROR_CODES is defined in './bundler' (complete version with JSON-RPC + ERC-4337 codes)
import { BUNDLER_ERROR_CODES } from './bundler'

/**
 * Extended RPC error codes used by StableNet
 */
export const STABLENET_ERROR_CODES = {
  /** Invalid input data */
  INVALID_INPUT: -32000,
  /** Resource not found */
  RESOURCE_NOT_FOUND: -32001,
  /** Resource unavailable */
  RESOURCE_UNAVAILABLE: -32002,
  /** Transaction rejected */
  TRANSACTION_REJECTED: -32003,
  /** Method not supported */
  METHOD_NOT_SUPPORTED: -32004,
  /** Rate limit exceeded */
  LIMIT_EXCEEDED: -32005,
} as const

/**
 * Combined RPC error codes
 */
export const RPC_ERROR_CODES = {
  ...JSON_RPC_ERROR_CODES,
  ...PROVIDER_ERROR_CODES,
  ...BUNDLER_ERROR_CODES,
  ...STABLENET_ERROR_CODES,
} as const

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES]

/**
 * RPC error with code and optional data
 */
export interface RpcErrorData {
  /** Error code */
  code: RpcErrorCode | number
  /** Error message */
  message: string
  /** Additional error data */
  data?: unknown
}

/**
 * RPC Error class
 */
export class RpcError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(message: string, code: number, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }

  toJSON(): RpcErrorData {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    }
  }
}

/**
 * Pre-defined RPC errors with default messages
 */
export const RPC_ERRORS = {
  INVALID_INPUT: { code: -32000, message: 'Invalid input' },
  RESOURCE_NOT_FOUND: { code: -32001, message: 'Resource not found' },
  RESOURCE_UNAVAILABLE: { code: -32002, message: 'Resource unavailable' },
  TRANSACTION_REJECTED: { code: -32003, message: 'Transaction rejected' },
  METHOD_NOT_SUPPORTED: { code: -32004, message: 'Method not supported' },
  LIMIT_EXCEEDED: { code: -32005, message: 'Limit exceeded' },
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'The requested account has not been authorized' },
  UNSUPPORTED_METHOD: { code: 4200, message: 'The requested method is not supported' },
  DISCONNECTED: { code: 4900, message: 'The provider is disconnected from all chains' },
  CHAIN_DISCONNECTED: {
    code: 4901,
    message: 'The provider is disconnected from the specified chain',
  },
} as const

/**
 * EIP-1193 Provider events
 */
export const PROVIDER_EVENTS = {
  /** Accounts changed */
  ACCOUNTS_CHANGED: 'accountsChanged',
  /** Chain changed */
  CHAIN_CHANGED: 'chainChanged',
  /** Connected to chain */
  CONNECT: 'connect',
  /** Disconnected from chain */
  DISCONNECT: 'disconnect',
  /** Provider message */
  MESSAGE: 'message',
} as const

export type ProviderEvent = (typeof PROVIDER_EVENTS)[keyof typeof PROVIDER_EVENTS]
