/**
 * SDK Error Handling Module
 * Exports all error types, classes, and utilities
 */

// Error classes
export {
  BundlerError,
  ConfigurationError,
  GasEstimationError,
  PaymasterError,
  SdkError,
  TransactionError,
  UserOperationError,
  ValidationError,
} from './SdkError'
// Types
export {
  BUNDLER_ERROR_CODES,
  type BundlerErrorCode,
  type BundlerErrorDetails,
  type ErrorContext,
  type GasEstimationErrorDetails,
  type PaymasterErrorDetails,
  SDK_ERROR_CODES,
  type SdkErrorCode,
  type SdkErrorDetails,
  type TransactionErrorDetails,
  type UserOperationErrorDetails,
} from './types'

// Utilities
export {
  assertCondition,
  assertDefined,
  createBundlerError,
  createConfigurationError,
  createPaymasterError,
  createTransactionError,
  createUserOperationError,
  createValidationError,
  isBundlerError,
  isPaymasterError,
  isSdkError,
  isTransactionError,
  isUserOperationError,
  normalizeError,
  withErrorHandling,
} from './utils'
