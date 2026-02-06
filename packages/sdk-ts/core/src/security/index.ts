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

// Transaction Risk Analyzer
export {
  TransactionRiskAnalyzer,
  createTransactionRiskAnalyzer,
  TransactionRiskLevel,
  TransactionRiskType,
  type TransactionRiskLevelType,
  type TransactionRiskTypeValue,
  type TransactionRiskResult,
  type TransactionRiskParams,
  type DecodedMethod,
} from './transactionRiskAnalyzer'

// Authorization Risk Analyzer (EIP-7702)
export {
  analyzeAuthorizationRisk,
  getAuthorizationSummary,
  formatRiskWarningsForUI,
  type AuthorizationRiskLevel,
  type AuthorizationRiskResult,
  type AuthorizationRiskParams,
} from './authorizationRiskAnalyzer'

// Typed Data Validator (EIP-712)
export {
  TypedDataValidator,
  createTypedDataValidator,
  type TypedDataDomain,
  type TypedData,
  type DomainValidationResult,
  type DomainWarning,
  type DomainWarningType,
} from './typedDataValidator'

// Signature Risk Analyzer
export {
  SignatureRiskAnalyzer,
  createSignatureRiskAnalyzer,
  SignatureMethod,
  SignatureRiskLevel,
  SignatureRiskType,
  type SignatureMethodType,
  type SignatureRiskLevelType,
  type SignatureRiskTypeValue,
  type SignatureRiskResult,
  type EIP712TypedData,
  type ContractInteraction,
} from './signatureRiskAnalyzer'

// Phishing Detector
export {
  PhishingDetector,
  createPhishingDetector,
  RiskLevel,
  PhishingPatternType,
  type RiskLevelType,
  type PhishingPatternTypeValue,
  type PhishingResult,
  type DomainResult,
  type PhishingDetectorConfig,
} from './phishingDetector'

// Rate Limiter
export {
  RateLimiter,
  createRateLimiter,
  DEFAULT_LIMITS,
  METHOD_CATEGORIES,
  type RateLimitConfig,
  type RateLimitResult,
} from './rateLimiter'

// Input Validator
export {
  InputValidator,
  createInputValidator,
  isValidAddress as isValidInputAddress,
  isValidHex,
  isValidChainId,
  isValidTransactionObject,
  isValidRpcRequest,
  sanitizeString,
  type ValidationResult as InputValidationResult,
  type HexValidationOptions,
  type SanitizeOptions,
  type TransactionObject,
  type RpcRequestObject,
} from './inputValidator'

// Legacy API Warning
export {
  DeprecationStatus,
  hasApiWarning,
  getApiWarning,
  shouldBlockMethod,
  getAllApiWarnings,
  getWarningsByStatus,
  formatWarningForUI as formatApiWarningForUI,
  createConsoleDeprecationNotice,
  updateEthSignSettings,
  getEthSignSettings,
  isEthSignAllowed,
  shouldShowEthSignWarning,
  resetEthSignSettings,
  type DeprecationStatusType,
  type ApiWarning,
  type EthSignSettings,
} from './legacyApiWarning'
