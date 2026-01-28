/**
 * SDK Error Handling Module
 * Exports all error types, classes, and utilities
 */

// Types
export {
  SDK_ERROR_CODES,
  BUNDLER_ERROR_CODES,
  type SdkErrorCode,
  type BundlerErrorCode,
  type ErrorContext,
  type SdkErrorDetails,
  type BundlerErrorDetails,
  type UserOperationErrorDetails,
  type TransactionErrorDetails,
  type GasEstimationErrorDetails,
} from './types'

// Error classes
export {
  SdkError,
  BundlerError,
  UserOperationError,
  TransactionError,
  GasEstimationError,
  ConfigurationError,
  ValidationError,
} from './SdkError'

// Utilities
export {
  isSdkError,
  isBundlerError,
  isUserOperationError,
  isTransactionError,
  normalizeError,
  createBundlerError,
  createUserOperationError,
  createTransactionError,
  createConfigurationError,
  createValidationError,
  withErrorHandling,
  assertCondition,
  assertDefined,
} from './utils'
