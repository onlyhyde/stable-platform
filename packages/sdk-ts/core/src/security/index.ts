/**
 * Security Module
 *
 * Comprehensive security utilities for Web3 applications:
 * - Transaction risk analysis
 * - EIP-7702 authorization risk analysis
 * - EIP-712 typed data validation
 * - Signature risk analysis
 * - Phishing detection
 * - Rate limiting
 * - Input validation
 * - Legacy API warnings
 */

// Authorization Risk Analyzer (EIP-7702)
export {
  type AuthorizationRiskLevel,
  type AuthorizationRiskParams,
  type AuthorizationRiskResult,
  analyzeAuthorizationRisk,
  formatRiskWarningsForUI,
  getAuthorizationSummary,
} from './authorizationRiskAnalyzer'
// Input Validator
export {
  createInputValidator,
  type HexValidationOptions,
  InputValidator,
  isValidAddress as isValidInputAddress,
  isValidChainId,
  isValidHex,
  isValidRpcRequest,
  isValidTransactionObject,
  type RpcRequestObject,
  type SanitizeOptions,
  sanitizeString,
  type TransactionObject,
  type ValidationResult as InputValidationResult,
} from './inputValidator'
// Legacy API Warning
export {
  type ApiWarning,
  createConsoleDeprecationNotice,
  DeprecationStatus,
  type DeprecationStatusType,
  type EthSignSettings,
  formatWarningForUI as formatApiWarningForUI,
  getAllApiWarnings,
  getApiWarning,
  getEthSignSettings,
  getWarningsByStatus,
  hasApiWarning,
  isEthSignAllowed,
  resetEthSignSettings,
  shouldBlockMethod,
  shouldShowEthSignWarning,
  updateEthSignSettings,
} from './legacyApiWarning'
// Phishing Detector
export {
  createPhishingDetector,
  type DomainResult,
  PhishingDetector,
  type PhishingDetectorConfig,
  PhishingPatternType,
  type PhishingPatternTypeValue,
  type PhishingResult,
  RiskLevel,
  type RiskLevelType,
} from './phishingDetector'
// Rate Limiter
export {
  createRateLimiter,
  DEFAULT_LIMITS,
  METHOD_CATEGORIES,
  type RateLimitConfig,
  RateLimiter,
  type RateLimitResult,
} from './rateLimiter'
// Signature Risk Analyzer
export {
  type ContractInteraction,
  createSignatureRiskAnalyzer,
  type EIP712TypedData,
  SignatureMethod,
  type SignatureMethodType,
  SignatureRiskAnalyzer,
  SignatureRiskLevel,
  type SignatureRiskLevelType,
  type SignatureRiskResult,
  SignatureRiskType,
  type SignatureRiskTypeValue,
} from './signatureRiskAnalyzer'
// Signature Verifier (EIP-1271)
export {
  createSignatureVerifier,
  decodeIsValidSignatureResult,
  EIP1271_ABI,
  EIP1271_INVALID_VALUE,
  EIP1271_MAGIC_VALUE,
  encodeIsValidSignatureCall,
  IS_VALID_SIGNATURE_SELECTOR,
  isEIP1271MagicValue,
  type SignatureType,
  type SignatureVerificationResult,
  SignatureVerifier,
  type VerifyHashParams,
  type VerifyPersonalMessageParams,
  type VerifySignatureOptions,
  type VerifyTypedDataParams,
} from './signatureVerifier'
// Transaction Risk Analyzer
export {
  createTransactionRiskAnalyzer,
  type DecodedMethod,
  TransactionRiskAnalyzer,
  TransactionRiskLevel,
  type TransactionRiskLevelType,
  type TransactionRiskParams,
  type TransactionRiskResult,
  TransactionRiskType,
  type TransactionRiskTypeValue,
} from './transactionRiskAnalyzer'
// Typed Data Validator (EIP-712)
export {
  createTypedDataValidator,
  type DomainValidationResult,
  type DomainWarning,
  type DomainWarningType,
  type TypedData,
  type TypedDataDomain,
  TypedDataValidator,
} from './typedDataValidator'
