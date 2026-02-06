/**
 * Module System
 * Module registry and utilities for ERC-7579 modular Smart Accounts
 */

export {
  createModuleRegistry,
  type ModuleRegistry,
  type ModuleRegistryEntry,
  type ModuleSearchFilters,
  type ModuleRegistryConfig,
  // Built-in modules
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  BUILT_IN_MODULES,
} from './moduleRegistry'

// Module Client (unified interface)
export {
  createModuleClient,
  type ModuleClient,
  type ModuleClientConfig,
  type ModuleInstallResult,
  type ModuleCalldata,
  type ValidationResult,
  type ConflictCheckResult,
} from './moduleClient'

// Sub-clients for advanced usage (SRP: separated concerns)
export {
  createModuleQueryClient,
  type ModuleQueryClient,
  type ModuleQueryClientConfig,
} from './queryClient'

export {
  createModuleOperationClient,
  type ModuleOperationClient,
  type ModuleOperationClientConfig,
} from './operationClient'

// Validator Utilities
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
  // Aggregated
  validatorUtils,
  // Types
  type ValidatorValidationResult,
  type WebAuthnSignatureData,
  // Executor Utilities
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
  // Common Executor
  encodeExecutorCall,
  encodeBatchExecutorCalls,
  generatePaymentId,
  // Aggregated
  executorUtils,
  // Types
  type ExecutorValidationResult,
  type PermissionCheckResult,
  type RecurringPaymentStatus,
  // Hook Utilities
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
  // Aggregated
  hookUtils,
  // Types
  type HookValidationResult,
  type SpendingLimitStatus,
  type AuditLogEntry,
  // Fallback Utilities
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
  // Aggregated
  fallbackUtils,
  // Types
  type FallbackValidationResult,
  type TokenReceiverCapability,
  type FlashLoanCallbackConfig,
  type FallbackHandlerRegistration,
} from './utils'
