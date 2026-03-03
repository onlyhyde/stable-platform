/**
 * Module System
 * Module registry and utilities for ERC-7579 modular Smart Accounts
 */

// Module Client (unified interface)
export {
  type ConflictCheckResult,
  createModuleClient,
  type ModuleCalldata,
  type ModuleClient,
  type ModuleClientConfig,
  type ModuleInstallResult,
  type ValidationResult,
} from './moduleClient'
export {
  BUILT_IN_MODULES,
  createModuleRegistry,
  // Built-in modules
  ECDSA_VALIDATOR,
  type ModuleRegistry,
  type ModuleRegistryConfig,
  type ModuleRegistryEntry,
  type ModuleSearchFilters,
  MULTISIG_VALIDATOR,
  RECURRING_PAYMENT_EXECUTOR,
  SESSION_KEY_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  WEBAUTHN_VALIDATOR,
} from './moduleRegistry'
export {
  createModuleOperationClient,
  type ModuleOperationClient,
  type ModuleOperationClientConfig,
} from './operationClient'
// Sub-clients for advanced usage (SRP: separated concerns)
export {
  createModuleQueryClient,
  type ModuleQueryClient,
  type ModuleQueryClientConfig,
} from './queryClient'

// Nonce Utils
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
} from './utils/nonceUtils'

// Validator Router
export {
  createValidatorRouter,
  type ValidatorRouter,
  type ValidatorRouterConfig,
} from './validatorRouter'

// Validator Utilities
export {
  type AuditLogEntry,
  calculateRecurringPaymentStatus,
  calculateSelector,
  calculateSpendingLimitStatus,
  calculateTotalRecurringCost,
  checkSessionKeyPermission,
  createDAppSessionKey,
  decodeAuditEventFlags,
  decodeECDSAValidatorInit,
  decodeMultiSigValidatorInit,
  decodeTokenReceiverFlags,
  decodeWebAuthnValidatorInit,
  // Types
  type ExecutorValidationResult,
  // Audit
  encodeAuditHookInit,
  encodeBatchExecutorCalls,
  encodeBatchFallbackRegistration,
  encodeECDSASignature,
  // ECDSA
  encodeECDSAValidatorInit,
  encodeERC721ReceivedReturn,
  encodeERC1155BatchReceivedReturn,
  encodeERC1155ReceivedReturn,
  encodeExecuteRecurringPayment,
  // Common Executor
  encodeExecutorCall,
  // Generic Fallback
  encodeFallbackHandlerRegistration,
  // Flash Loan
  encodeFlashLoanInit,
  encodeMultipleSpendingLimitsInit,
  encodeMultiSigSignature,
  // MultiSig
  encodeMultiSigValidatorInit,
  // Recurring Payment
  encodeRecurringPaymentInit,
  // Executor Utilities
  // Session Key
  encodeSessionKeyInit,
  encodeSetLimit,
  // Hook Utilities
  // Spending Limit
  encodeSpendingLimitInit,
  encodeSupportsInterfaceCall,
  // Fallback Utilities
  // Token Receiver
  encodeTokenReceiverInit,
  encodeWebAuthnSignature,
  // WebAuthn
  encodeWebAuthnValidatorInit,
  // Aggregated
  executorUtils,
  type FallbackHandlerRegistration,
  // Types
  type FallbackValidationResult,
  type FlashLoanCallbackConfig,
  // Aggregated
  fallbackUtils,
  formatAuditLogEntry,
  formatSpendingLimit,
  generatePaymentId,
  generateSignerChangeHash,
  // Common Hook
  getPeriodName,
  getSupportedInterfaceIds,
  getTokenReceiverHandlers,
  // Types
  type HookValidationResult,
  // Aggregated
  hookUtils,
  INTERFACE_IDS,
  // Constants
  INTERFACE_SELECTORS,
  // Common
  identifyValidatorType,
  isFlashLoanAuthorized,
  isValidSignatureFormat,
  PERIOD_PRESETS,
  type PermissionCheckResult,
  parseWebAuthnCredential,
  type RecurringPaymentStatus,
  type SpendingLimitStatus,
  suggestSpendingLimit,
  type TokenReceiverCapability,
  // Types
  type ValidatorValidationResult,
  validateAuditHookConfig,
  validateECDSAValidatorConfig,
  validateFlashLoanConfig,
  validateMultiSigValidatorConfig,
  validateRecurringPaymentConfig,
  validateSessionKeyConfig,
  validateSpendingLimitConfig,
  validateTokenReceiverConfig,
  validateWebAuthnValidatorConfig,
  // Aggregated
  validatorUtils,
  type WebAuthnSignatureData,
  wouldExceedLimit,
} from './utils'
