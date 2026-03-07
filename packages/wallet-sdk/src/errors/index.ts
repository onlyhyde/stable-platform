// Re-export core SDK error types for convenience
export {
  BundlerError,
  type BundlerErrorCode,
  type ErrorContext,
  PaymasterError,
  SdkError,
  type SdkErrorCode,
  UserOperationError,
} from '@stablenet/core'
export {
  AAError,
  type AAErrorInfo,
  type AAErrorSeverity,
  extractAAErrorCode,
  extractRevertReason,
  getAAErrorInfo,
  parseAAError,
} from './aaErrors'
