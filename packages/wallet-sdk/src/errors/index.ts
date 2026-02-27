export {
  AAError,
  extractAAErrorCode,
  extractRevertReason,
  getAAErrorInfo,
  parseAAError,
  type AAErrorInfo,
  type AAErrorSeverity,
} from './aaErrors'

// Re-export core SDK error types for convenience
export {
  BundlerError,
  PaymasterError,
  SdkError,
  UserOperationError,
  type BundlerErrorCode,
  type ErrorContext,
  type SdkErrorCode,
} from '@stablenet/core'
