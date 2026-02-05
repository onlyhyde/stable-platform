/**
 * Module Utilities
 * Encoding, validation, and helper functions for ERC-7579 modules
 */

export {
  // ECDSA
  encodeECDSAValidatorInit,
  decodeECDSAValidatorInit,
  validateECDSAValidatorConfig,
  encodeECDSASignature,
  // WebAuthn
  encodeWebAuthnValidatorInit,
  decodeWebAuthnValidatorInit,
  validateWebAuthnValidatorConfig,
  encodeWebAuthnSignature,
  parseWebAuthnCredential,
  // MultiSig
  encodeMultiSigValidatorInit,
  decodeMultiSigValidatorInit,
  validateMultiSigValidatorConfig,
  encodeMultiSigSignature,
  generateSignerChangeHash,
  // Common
  identifyValidatorType,
  isValidSignatureFormat,
  // Aggregated export
  validatorUtils,
  // Types
  type ValidatorValidationResult,
  type WebAuthnSignatureData,
} from './validatorUtils'

export {
  // Session Key
  encodeSessionKeyInit,
  validateSessionKeyConfig,
  checkSessionKeyPermission,
  createDAppSessionKey,
  // Recurring Payment
  encodeRecurringPaymentInit,
  validateRecurringPaymentConfig,
  calculateRecurringPaymentStatus,
  calculateTotalRecurringCost,
  encodeExecuteRecurringPayment,
  // Common
  encodeExecutorCall,
  encodeBatchExecutorCalls,
  generatePaymentId,
  // Aggregated export
  executorUtils,
  // Types
  type ExecutorValidationResult,
  type PermissionCheckResult,
  type RecurringPaymentStatus,
} from './executorUtils'

export {
  // Spending Limit
  encodeSpendingLimitInit,
  encodeMultipleSpendingLimitsInit,
  validateSpendingLimitConfig,
  calculateSpendingLimitStatus,
  wouldExceedLimit,
  formatSpendingLimit,
  encodeSetLimit,
  // Audit
  encodeAuditHookInit,
  decodeAuditEventFlags,
  validateAuditHookConfig,
  formatAuditLogEntry,
  // Common Hook
  getPeriodName,
  suggestSpendingLimit,
  PERIOD_PRESETS,
  // Aggregated export
  hookUtils,
  // Types
  type HookValidationResult,
  type SpendingLimitStatus,
  type AuditLogEntry,
} from './hookUtils'

export {
  // Token Receiver
  encodeTokenReceiverInit,
  decodeTokenReceiverFlags,
  validateTokenReceiverConfig,
  getTokenReceiverHandlers,
  encodeERC721ReceivedReturn,
  encodeERC1155ReceivedReturn,
  encodeERC1155BatchReceivedReturn,
  // Flash Loan
  encodeFlashLoanInit,
  validateFlashLoanConfig,
  isFlashLoanAuthorized,
  // Generic Fallback
  encodeFallbackHandlerRegistration,
  encodeBatchFallbackRegistration,
  calculateSelector,
  encodeSupportsInterfaceCall,
  getSupportedInterfaceIds,
  // Constants
  INTERFACE_SELECTORS,
  INTERFACE_IDS,
  // Aggregated export
  fallbackUtils,
  // Types
  type FallbackValidationResult,
  type TokenReceiverCapability,
  type FlashLoanCallbackConfig,
  type FallbackHandlerRegistration,
} from './fallbackUtils'
