/**
 * SDK Error Types
 * Comprehensive error type definitions for the StableNet SDK
 */

import type { Address, Hex } from 'viem'

/**
 * Base error codes for the SDK
 */
export const SDK_ERROR_CODES = {
  // Configuration errors
  INVALID_CONFIG: 'SDK_INVALID_CONFIG',
  MISSING_PARAMETER: 'SDK_MISSING_PARAMETER',

  // Account errors
  ACCOUNT_NOT_DEPLOYED: 'SDK_ACCOUNT_NOT_DEPLOYED',
  ACCOUNT_ALREADY_DEPLOYED: 'SDK_ACCOUNT_ALREADY_DEPLOYED',
  INVALID_ACCOUNT: 'SDK_INVALID_ACCOUNT',

  // Transaction errors
  TRANSACTION_FAILED: 'SDK_TRANSACTION_FAILED',
  TRANSACTION_REJECTED: 'SDK_TRANSACTION_REJECTED',
  TRANSACTION_REVERTED: 'SDK_TRANSACTION_REVERTED',
  TRANSACTION_TIMEOUT: 'SDK_TRANSACTION_TIMEOUT',

  // User Operation errors
  USER_OP_FAILED: 'SDK_USER_OP_FAILED',
  USER_OP_REJECTED: 'SDK_USER_OP_REJECTED',
  USER_OP_REVERTED: 'SDK_USER_OP_REVERTED',
  USER_OP_TIMEOUT: 'SDK_USER_OP_TIMEOUT',
  USER_OP_SIMULATION_FAILED: 'SDK_USER_OP_SIMULATION_FAILED',

  // Signature errors
  SIGNATURE_INVALID: 'SDK_SIGNATURE_INVALID',
  SIGNATURE_REJECTED: 'SDK_SIGNATURE_REJECTED',

  // Network errors
  NETWORK_ERROR: 'SDK_NETWORK_ERROR',
  RPC_ERROR: 'SDK_RPC_ERROR',
  BUNDLER_ERROR: 'SDK_BUNDLER_ERROR',
  PAYMASTER_ERROR: 'SDK_PAYMASTER_ERROR',

  // Gas errors
  INSUFFICIENT_GAS: 'SDK_INSUFFICIENT_GAS',
  GAS_ESTIMATION_FAILED: 'SDK_GAS_ESTIMATION_FAILED',

  // Validation errors
  VALIDATION_ERROR: 'SDK_VALIDATION_ERROR',
  INVALID_ADDRESS: 'SDK_INVALID_ADDRESS',
  INVALID_AMOUNT: 'SDK_INVALID_AMOUNT',

  // Authorization errors
  UNAUTHORIZED: 'SDK_UNAUTHORIZED',
  FORBIDDEN: 'SDK_FORBIDDEN',

  // Module operation errors
  DELEGATECALL_TARGET_NOT_WHITELISTED: 'SDK_DELEGATECALL_TARGET_NOT_WHITELISTED',
  REENTRANCY_VIOLATION: 'SDK_REENTRANCY_VIOLATION',

  // Unknown
  UNKNOWN_ERROR: 'SDK_UNKNOWN_ERROR',
} as const

export type SdkErrorCode = (typeof SDK_ERROR_CODES)[keyof typeof SDK_ERROR_CODES]

/**
 * Bundler-specific error codes (ERC-4337)
 */
export const BUNDLER_ERROR_CODES = {
  // JSON-RPC standard errors
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // ERC-4337 specific errors
  REJECTED_BY_EP_OR_ACCOUNT: -32500,
  REJECTED_BY_PAYMASTER: -32501,
  BANNED_OPCODE: -32502,
  SHORT_DEADLINE: -32503,
  BANNED_OR_THROTTLED: -32504,
  STAKE_OR_DELAY_TOO_LOW: -32505,
  UNSUPPORTED_AGGREGATOR: -32506,
  INVALID_SIGNATURE: -32507,
} as const

export type BundlerErrorCode = (typeof BUNDLER_ERROR_CODES)[keyof typeof BUNDLER_ERROR_CODES]

/**
 * Error context for additional debugging information
 */
export interface ErrorContext {
  /** The operation that caused the error */
  operation?: string
  /** The sender address */
  sender?: Address
  /** The transaction/user operation hash */
  hash?: Hex
  /** The target address */
  target?: Address
  /** The chain ID */
  chainId?: bigint | number
  /** Additional data */
  data?: unknown
  /** Timestamp of the error */
  timestamp?: number
}

/**
 * SDK Error details structure
 */
export interface SdkErrorDetails {
  code: SdkErrorCode
  message: string
  cause?: unknown
  context?: ErrorContext
}

/**
 * Bundler error details structure
 */
export interface BundlerErrorDetails {
  code: BundlerErrorCode
  message: string
  data?: unknown
  context?: ErrorContext
}

/**
 * User operation error details
 */
export interface UserOperationErrorDetails {
  userOpHash?: Hex
  sender?: Address
  reason?: string
  revertData?: Hex
  gasUsed?: bigint
}

/**
 * Transaction error details
 */
export interface TransactionErrorDetails {
  txHash?: Hex
  from?: Address
  to?: Address
  reason?: string
  revertData?: Hex
  gasUsed?: bigint
}

/**
 * Gas estimation error details
 */
export interface GasEstimationErrorDetails {
  operation: string
  estimatedGas?: bigint
  availableGas?: bigint
  reason?: string
}

/**
 * Paymaster error details
 */
export interface PaymasterErrorDetails {
  paymasterCode: string
  rpcCode?: number
  reason?: string
}
