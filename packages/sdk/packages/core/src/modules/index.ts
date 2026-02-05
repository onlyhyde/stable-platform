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

export {
  createModuleClient,
  type ModuleClient,
  type ModuleClientConfig,
  type ModuleInstallResult,
  type ModuleCalldata,
} from './moduleClient'

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
} from './utils'
