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
