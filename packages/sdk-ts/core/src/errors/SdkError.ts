/**
 * SDK Error Classes
 * Base and specialized error classes for the StableNet SDK
 */

import type {
  BundlerErrorCode,
  BundlerErrorDetails,
  ErrorContext,
  GasEstimationErrorDetails,
  PaymasterErrorDetails,
  SdkErrorCode,
  SdkErrorDetails,
  TransactionErrorDetails,
  UserOperationErrorDetails,
} from './types'
import { BUNDLER_ERROR_CODES, SDK_ERROR_CODES } from './types'

/**
 * Base SDK Error class
 * All SDK errors extend from this class
 */
export class SdkError extends Error {
  readonly code: SdkErrorCode
  readonly cause?: unknown
  readonly context?: ErrorContext
  readonly timestamp: number

  constructor(details: SdkErrorDetails) {
    super(details.message)
    this.name = 'SdkError'
    this.code = details.code
    this.cause = details.cause
    this.context = details.context
    this.timestamp = details.context?.timestamp ?? Date.now()

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SdkError)
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes: SdkErrorCode[] = [
      SDK_ERROR_CODES.NETWORK_ERROR,
      SDK_ERROR_CODES.RPC_ERROR,
      SDK_ERROR_CODES.TRANSACTION_TIMEOUT,
      SDK_ERROR_CODES.USER_OP_TIMEOUT,
    ]
    return retryableCodes.includes(this.code)
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case SDK_ERROR_CODES.NETWORK_ERROR:
        return 'Unable to connect. Please check your internet connection.'
      case SDK_ERROR_CODES.TRANSACTION_FAILED:
      case SDK_ERROR_CODES.USER_OP_FAILED:
        return 'Transaction failed. Please try again.'
      case SDK_ERROR_CODES.TRANSACTION_REJECTED:
      case SDK_ERROR_CODES.USER_OP_REJECTED:
        return 'Transaction was rejected.'
      case SDK_ERROR_CODES.SIGNATURE_REJECTED:
        return 'Signature request was rejected.'
      case SDK_ERROR_CODES.INSUFFICIENT_GAS:
        return 'Insufficient gas for transaction.'
      case SDK_ERROR_CODES.UNAUTHORIZED:
        return 'You are not authorized to perform this action.'
      case SDK_ERROR_CODES.ACCOUNT_NOT_DEPLOYED:
        return 'Smart account is not deployed yet.'
      default:
        return this.message || 'An unexpected error occurred.'
    }
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): SdkErrorDetails & { timestamp: number } {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause,
      context: this.context,
      timestamp: this.timestamp,
    }
  }
}

/**
 * Bundler Error class
 * For errors returned by the bundler
 */
export class BundlerError extends SdkError {
  readonly bundlerCode: BundlerErrorCode
  readonly data?: unknown

  constructor(details: BundlerErrorDetails) {
    super({
      code: SDK_ERROR_CODES.BUNDLER_ERROR,
      message: details.message,
      context: details.context,
    })
    this.name = 'BundlerError'
    this.bundlerCode = details.code
    this.data = details.data
  }

  /**
   * Check if bundler error is retryable
   */
  override isRetryable(): boolean {
    // Most bundler errors are not retryable
    const retryableCodes: BundlerErrorCode[] = [
      BUNDLER_ERROR_CODES.INTERNAL_ERROR,
      BUNDLER_ERROR_CODES.SHORT_DEADLINE,
    ]
    return retryableCodes.includes(this.bundlerCode)
  }

  /**
   * Get user-friendly message for bundler errors
   */
  override getUserMessage(): string {
    switch (this.bundlerCode) {
      case BUNDLER_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT:
        return 'Transaction was rejected by the account.'
      case BUNDLER_ERROR_CODES.REJECTED_BY_PAYMASTER:
        return 'Transaction was rejected by the paymaster.'
      case BUNDLER_ERROR_CODES.INVALID_SIGNATURE:
        return 'Invalid signature provided.'
      case BUNDLER_ERROR_CODES.BANNED_OPCODE:
        return 'Transaction contains disallowed operations.'
      case BUNDLER_ERROR_CODES.BANNED_OR_THROTTLED:
        return 'Too many requests. Please wait and try again.'
      case BUNDLER_ERROR_CODES.STAKE_OR_DELAY_TOO_LOW:
        return 'Insufficient stake or delay for operation.'
      default:
        return this.message || 'Bundler error occurred.'
    }
  }
}

/**
 * User Operation Error class
 * For errors related to user operations
 */
export class UserOperationError extends SdkError {
  readonly userOpHash?: string
  readonly sender?: string
  readonly reason?: string
  readonly revertData?: string
  readonly gasUsed?: bigint

  constructor(
    code: SdkErrorCode,
    message: string,
    details?: UserOperationErrorDetails & { context?: ErrorContext }
  ) {
    super({
      code,
      message,
      context: details?.context,
    })
    this.name = 'UserOperationError'
    this.userOpHash = details?.userOpHash
    this.sender = details?.sender
    this.reason = details?.reason
    this.revertData = details?.revertData
    this.gasUsed = details?.gasUsed
  }
}

/**
 * Transaction Error class
 * For errors related to transactions
 */
export class TransactionError extends SdkError {
  readonly txHash?: string
  readonly from?: string
  readonly to?: string
  readonly reason?: string
  readonly revertData?: string
  readonly gasUsed?: bigint

  constructor(
    code: SdkErrorCode,
    message: string,
    details?: TransactionErrorDetails & { context?: ErrorContext }
  ) {
    super({
      code,
      message,
      context: details?.context,
    })
    this.name = 'TransactionError'
    this.txHash = details?.txHash
    this.from = details?.from
    this.to = details?.to
    this.reason = details?.reason
    this.revertData = details?.revertData
    this.gasUsed = details?.gasUsed
  }
}

/**
 * Gas Estimation Error class
 */
export class GasEstimationError extends SdkError {
  readonly operation: string
  readonly estimatedGas?: bigint
  readonly availableGas?: bigint
  readonly reason?: string

  constructor(message: string, details: GasEstimationErrorDetails & { context?: ErrorContext }) {
    super({
      code: SDK_ERROR_CODES.GAS_ESTIMATION_FAILED,
      message,
      context: details.context,
    })
    this.name = 'GasEstimationError'
    this.operation = details.operation
    this.estimatedGas = details.estimatedGas
    this.availableGas = details.availableGas
    this.reason = details.reason
  }
}

/**
 * Configuration Error class
 */
export class ConfigurationError extends SdkError {
  readonly parameterName?: string

  constructor(message: string, parameterName?: string, context?: ErrorContext) {
    super({
      code: SDK_ERROR_CODES.INVALID_CONFIG,
      message,
      context,
    })
    this.name = 'ConfigurationError'
    this.parameterName = parameterName
  }
}

/**
 * Validation Error class
 */
export class ValidationError extends SdkError {
  readonly field?: string
  readonly value?: unknown

  constructor(message: string, field?: string, value?: unknown, context?: ErrorContext) {
    super({
      code: SDK_ERROR_CODES.VALIDATION_ERROR,
      message,
      context,
    })
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

/**
 * Paymaster Error class
 * For errors from paymaster services
 */
export class PaymasterError extends SdkError {
  readonly paymasterCode: string
  readonly rpcCode?: number
  readonly reason?: string

  constructor(
    paymasterCode: string,
    message: string,
    details?: Omit<PaymasterErrorDetails, 'paymasterCode'> & { context?: ErrorContext }
  ) {
    super({
      code: SDK_ERROR_CODES.PAYMASTER_ERROR,
      message,
      context: details?.context,
    })
    this.name = 'PaymasterError'
    this.paymasterCode = paymasterCode
    this.rpcCode = details?.rpcCode
    this.reason = details?.reason
  }

  /**
   * Check if paymaster error is retryable
   */
  override isRetryable(): boolean {
    const retryableCodes = ['TIMEOUT', 'HTTP_ERROR']
    return retryableCodes.includes(this.paymasterCode)
  }

  /**
   * Get user-friendly message for paymaster errors
   */
  override getUserMessage(): string {
    switch (this.paymasterCode) {
      case 'SPONSOR_NOT_AVAILABLE':
        return 'Gas sponsorship is not available for this transaction.'
      case 'INSUFFICIENT_SPONSOR_BALANCE':
        return 'The sponsor does not have sufficient balance.'
      case 'TOKEN_NOT_SUPPORTED':
        return 'This token is not supported for gas payment.'
      case 'INSUFFICIENT_TOKEN_ALLOWANCE':
        return 'Please approve the token for gas payment.'
      case 'TIMEOUT':
        return 'Paymaster service timed out. Please try again.'
      case 'HTTP_ERROR':
        return 'Could not connect to paymaster service.'
      default:
        return this.message || 'Paymaster error occurred.'
    }
  }
}
