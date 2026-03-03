/**
 * Module Utilities
 * Encoding, validation, and helper functions for ERC-7579 modules
 */

export {
  calculateRecurringPaymentStatus,
  calculateTotalRecurringCost,
  checkSessionKeyPermission,
  createDAppSessionKey,
  // Types
  type ExecutorValidationResult,
  encodeBatchExecutorCalls,
  encodeExecuteRecurringPayment,
  // Common
  encodeExecutorCall,
  // Recurring Payment
  encodeRecurringPaymentInit,
  // Session Key
  encodeSessionKeyInit,
  // Aggregated export
  executorUtils,
  generatePaymentId,
  type PermissionCheckResult,
  type RecurringPaymentStatus,
  validateRecurringPaymentConfig,
  validateSessionKeyConfig,
} from './executorUtils'
export {
  calculateSelector,
  decodeTokenReceiverFlags,
  encodeBatchFallbackRegistration,
  encodeERC721ReceivedReturn,
  encodeERC1155BatchReceivedReturn,
  encodeERC1155ReceivedReturn,
  // Generic Fallback
  encodeFallbackHandlerRegistration,
  // Flash Loan
  encodeFlashLoanInit,
  encodeSupportsInterfaceCall,
  // Token Receiver
  encodeTokenReceiverInit,
  type FallbackHandlerRegistration,
  // Types
  type FallbackValidationResult,
  type FlashLoanCallbackConfig,
  // Aggregated export
  fallbackUtils,
  getSupportedInterfaceIds,
  getTokenReceiverHandlers,
  INTERFACE_IDS,
  // Constants
  INTERFACE_SELECTORS,
  isFlashLoanAuthorized,
  type TokenReceiverCapability,
  validateFlashLoanConfig,
  validateTokenReceiverConfig,
} from './fallbackUtils'

export {
  type AuditLogEntry,
  calculateSpendingLimitStatus,
  decodeAuditEventFlags,
  // Audit
  encodeAuditHookInit,
  encodeMultipleSpendingLimitsInit,
  encodeSetLimit,
  // Spending Limit
  encodeSpendingLimitInit,
  formatAuditLogEntry,
  formatSpendingLimit,
  // Common Hook
  getPeriodName,
  // Types
  type HookValidationResult,
  // Aggregated export
  hookUtils,
  PERIOD_PRESETS,
  type SpendingLimitStatus,
  suggestSpendingLimit,
  validateAuditHookConfig,
  validateSpendingLimitConfig,
  wouldExceedLimit,
} from './hookUtils'
export {
  type DecodedNonceKey,
  decodeValidatorNonceKey,
  type EncodeValidatorNonceKeyOptions,
  encodeValidatorNonceKey,
  isRootValidator,
  VALIDATION_MODE,
  type ValidationMode,
  VALIDATION_TYPE,
  type ValidationType,
} from './nonceUtils'
export {
  decodeECDSAValidatorInit,
  decodeMultiSigValidatorInit,
  decodeWebAuthnValidatorInit,
  encodeECDSASignature,
  // ECDSA
  encodeECDSAValidatorInit,
  encodeMultiSigSignature,
  // MultiSig
  encodeMultiSigValidatorInit,
  encodeWebAuthnSignature,
  // WebAuthn
  encodeWebAuthnValidatorInit,
  generateSignerChangeHash,
  // Common
  identifyValidatorType,
  isValidSignatureFormat,
  parseWebAuthnCredential,
  // Types
  type ValidatorValidationResult,
  validateECDSAValidatorConfig,
  validateMultiSigValidatorConfig,
  validateWebAuthnValidatorConfig,
  // Aggregated export
  validatorUtils,
  type WebAuthnSignatureData,
} from './validatorUtils'
