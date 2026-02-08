// Mock module for @stablenet/core - resolved by jest moduleNameMapper
// Provides comprehensive mocks for all security module exports

// --- Enums (as const objects) ---

const TransactionRiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

const TransactionRiskType = {
  HIGH_VALUE: 'high_value',
  TOKEN_APPROVAL: 'token_approval',
  UNLIMITED_APPROVAL: 'unlimited_approval',
  NFT_APPROVAL_ALL: 'nft_approval_all',
  TOKEN_TRANSFER: 'token_transfer',
  CONTRACT_INTERACTION: 'contract_interaction',
  ZERO_ADDRESS: 'zero_address',
  SELF_TRANSFER: 'self_transfer',
  HIGH_GAS_PRICE: 'high_gas_price',
  SUSPICIOUS_DATA: 'suspicious_data',
  UNKNOWN_CONTRACT: 'unknown_contract',
  EMPTY_DATA_WITH_VALUE: 'empty_data_with_value',
  POSSIBLE_PHISHING: 'possible_phishing',
}

const SignatureMethod = {
  ETH_SIGN: 'eth_sign',
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
}

const SignatureRiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

const SignatureRiskType = {
  BLIND_SIGNING: 'blind_signing',
  TOKEN_APPROVAL: 'token_approval',
  UNLIMITED_APPROVAL: 'unlimited_approval',
  NFT_APPROVAL_ALL: 'nft_approval_all',
  MALFORMED_DATA: 'malformed_data',
  SUSPICIOUS_MESSAGE: 'suspicious_message',
  LEGACY_FORMAT: 'legacy_format',
}

const RiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

const PhishingPatternType = {
  BLOCKLISTED: 'blocklisted',
  TYPOSQUATTING: 'typosquatting',
  HOMOGRAPH: 'homograph',
  SUSPICIOUS_SUBDOMAIN: 'suspicious_subdomain',
  IP_ADDRESS: 'ip_address',
  INVALID_URL: 'invalid_url',
  SUSPICIOUS_TLD: 'suspicious_tld',
}

const DeprecationStatus = {
  DEPRECATED: 'deprecated',
  DANGEROUS: 'dangerous',
  LEGACY: 'legacy',
  REMOVED: 'removed',
}

// --- Constants ---

const DEFAULT_LIMITS = {
  sensitive: { maxRequests: 5, windowMs: 60000 },
  signing: { maxRequests: 10, windowMs: 60000 },
  connection: { maxRequests: 10, windowMs: 60000 },
  read: { maxRequests: 100, windowMs: 60000 },
  default: { maxRequests: 60, windowMs: 60000 },
}

const METHOD_CATEGORIES = {
  eth_sendTransaction: 'sensitive',
  eth_sendUserOperation: 'sensitive',
  wallet_addEthereumChain: 'sensitive',
  personal_sign: 'signing',
  eth_sign: 'signing',
  eth_signTypedData: 'signing',
  eth_signTypedData_v3: 'signing',
  eth_signTypedData_v4: 'signing',
  eth_signTransaction: 'signing',
  eth_requestAccounts: 'connection',
  wallet_requestPermissions: 'connection',
  eth_accounts: 'read',
  eth_chainId: 'read',
  net_version: 'read',
  eth_getBalance: 'read',
  eth_blockNumber: 'read',
  eth_gasPrice: 'read',
  eth_call: 'read',
  eth_getCode: 'read',
  eth_getTransactionReceipt: 'read',
  eth_getBlockByNumber: 'read',
  eth_estimateGas: 'read',
}

// --- Default result factories ---

function defaultValidationResult(isValid = true) {
  return { isValid, errors: [], warnings: [] }
}

function defaultRiskResult() {
  return {
    riskLevel: TransactionRiskLevel.SAFE,
    risks: [],
    warnings: [],
    decodedMethod: null,
  }
}

function defaultSignatureRiskResult() {
  return {
    riskLevel: SignatureRiskLevel.SAFE,
    risks: [],
    warnings: [],
    method: SignatureMethod.PERSONAL_SIGN,
  }
}

function defaultPhishingResult() {
  return {
    isPhishing: false,
    riskLevel: RiskLevel.SAFE,
    patterns: [],
    warnings: [],
  }
}

function defaultDomainResult() {
  return {
    isPhishing: false,
    riskLevel: RiskLevel.SAFE,
    patterns: [],
    warnings: [],
  }
}

function defaultRateLimitResult() {
  return { allowed: true, retryAfter: 0 }
}

function defaultDomainValidationResult() {
  return { isValid: true, warnings: [], errors: [] }
}

// --- Classes ---

class InputValidator {
  validateAddress(address) {
    const isValid = typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
    return defaultValidationResult(isValid)
  }
  validateHex(hex, options = {}) {
    const isValid = typeof hex === 'string' && /^0x[0-9a-fA-F]*$/.test(hex)
    return defaultValidationResult(isValid)
  }
  validateChainId(chainId) {
    const isValid = typeof chainId === 'number' && chainId > 0
    return defaultValidationResult(isValid)
  }
  validateTransaction(tx) {
    return defaultValidationResult(true)
  }
  validateRpcRequest(request) {
    return defaultValidationResult(true)
  }
  sanitizeString(input, options = {}) {
    if (options.maxLength && input.length > options.maxLength) {
      return input.slice(0, options.maxLength)
    }
    if (options.escapeHtml) {
      return input.replace(/[<>&"']/g, (c) => {
        const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }
        return map[c] || c
      })
    }
    return input
  }
}

class RateLimiter {
  constructor(customLimits) {
    this._limits = { ...DEFAULT_LIMITS, ...customLimits }
    this._requests = new Map()
  }
  checkLimit(origin, method) {
    return defaultRateLimitResult()
  }
  destroy() {}
}

class TransactionRiskAnalyzer {
  analyzeTransaction(params) {
    return defaultRiskResult()
  }
}

class SignatureRiskAnalyzer {
  analyzeSignature(method, data) {
    return defaultSignatureRiskResult()
  }
}

class PhishingDetector {
  constructor(config = {}) {
    this._config = config
  }
  checkUrl(url) {
    return defaultPhishingResult()
  }
  checkDomain(domain) {
    return defaultDomainResult()
  }
}

class TypedDataValidator {
  validateTypedData(typedData, currentChainId, requestOrigin) {
    return defaultDomainValidationResult()
  }
  validateDomain(domain, currentChainId, requestOrigin) {
    return defaultDomainValidationResult()
  }
}

class IndexerClient {
  constructor(config) {
    this._config = config
  }
}

// --- Standalone Functions ---

function isValidInputAddress(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
}
function isValidAddress(address) {
  return isValidInputAddress(address)
}
function isValidHex(hex, options) {
  return typeof hex === 'string' && /^0x[0-9a-fA-F]*$/.test(hex)
}
function isValidChainId(chainId) {
  return typeof chainId === 'number' && chainId > 0
}
function isValidTransactionObject(tx) {
  return typeof tx === 'object' && tx !== null
}
function isValidRpcRequest(request) {
  return typeof request === 'object' && request !== null && typeof request.method === 'string'
}
function sanitizeString(input, options) {
  return new InputValidator().sanitizeString(input, options || {})
}

// Factory functions
function createInputValidator() {
  return new InputValidator()
}
function createRateLimiter(customLimits) {
  return new RateLimiter(customLimits)
}
function createTransactionRiskAnalyzer() {
  return new TransactionRiskAnalyzer()
}
function createSignatureRiskAnalyzer() {
  return new SignatureRiskAnalyzer()
}
function createPhishingDetector(config) {
  return new PhishingDetector(config)
}
function createTypedDataValidator() {
  return new TypedDataValidator()
}
function createIndexerClient(config) {
  return new IndexerClient(config)
}

// --- Legacy API Warning ---

const _apiWarnings = {
  eth_sign: {
    method: 'eth_sign',
    status: DeprecationStatus.DANGEROUS,
    message: 'eth_sign is dangerous - it signs arbitrary data without displaying it to the user',
    alternative: 'personal_sign',
    shouldBlock: false,
    riskLevel: 'critical',
  },
  eth_signTypedData: {
    method: 'eth_signTypedData',
    status: DeprecationStatus.LEGACY,
    message: 'eth_signTypedData v1 is deprecated',
    alternative: 'eth_signTypedData_v4',
    shouldBlock: false,
    riskLevel: 'medium',
  },
  eth_signTypedData_v3: {
    method: 'eth_signTypedData_v3',
    status: DeprecationStatus.DEPRECATED,
    message: 'eth_signTypedData_v3 is deprecated in favor of v4',
    alternative: 'eth_signTypedData_v4',
    shouldBlock: false,
    riskLevel: 'low',
  },
}

let _ethSignSettings = {
  allowEthSign: false,
  showEthSignWarning: true,
}

function hasApiWarning(method) {
  return method in _apiWarnings
}
function getApiWarning(method) {
  return _apiWarnings[method] || null
}
function shouldBlockMethod(method) {
  const w = _apiWarnings[method]
  return w ? w.shouldBlock : false
}
function getAllApiWarnings() {
  return Object.values(_apiWarnings)
}
function getWarningsByStatus(status) {
  return Object.values(_apiWarnings).filter((w) => w.status === status)
}
function formatApiWarningForUI(warning) {
  return {
    title: `${warning.method} - ${warning.status}`,
    description: warning.message,
    severity:
      warning.riskLevel === 'critical'
        ? 'danger'
        : warning.riskLevel === 'medium'
          ? 'warning'
          : 'info',
    action: warning.alternative ? `Use ${warning.alternative} instead` : undefined,
  }
}
function formatWarningForUI(warning) {
  return formatApiWarningForUI(warning)
}
function createConsoleDeprecationNotice(method) {
  const w = _apiWarnings[method]
  if (!w) return ''
  return `[StableNet] Warning: ${method} is ${w.status}. ${w.message}`
}
function updateEthSignSettings(settings) {
  _ethSignSettings = { ..._ethSignSettings, ...settings }
}
function getEthSignSettings() {
  return { ..._ethSignSettings }
}
function isEthSignAllowed() {
  return _ethSignSettings.allowEthSign
}
function shouldShowEthSignWarning() {
  return _ethSignSettings.showEthSignWarning
}
function resetEthSignSettings() {
  _ethSignSettings = { allowEthSign: false, showEthSignWarning: true }
}

// --- Error classes ---

class SdkError extends Error {
  constructor(code, message, context) {
    super(message)
    this.code = code
    this.context = context
    this.name = 'SdkError'
  }
}

class ValidationError extends SdkError {
  constructor(message, context) {
    super('VALIDATION_ERROR', message, context)
    this.name = 'ValidationError'
  }
}

// --- RPC utilities ---

class RpcError extends Error {
  constructor(code, message, data) {
    super(message)
    this.code = code
    this.data = data
    this.name = 'RpcError'
  }
}

function isRpcError(err) {
  return err instanceof RpcError
}

// --- Authorization risk (EIP-7702) ---

function analyzeAuthorizationRisk(params) {
  return { riskLevel: 'safe', warnings: [] }
}
function getAuthorizationSummary(params) {
  return ''
}
function formatRiskWarningsForUI(warnings) {
  return warnings.map((w) => ({ ...w }))
}

// --- Token utilities ---

function formatTokenBalance(balance, decimals) {
  return '0'
}
function parseTokenAmount(amount, decimals) {
  return BigInt(0)
}

// --- Provider/Client stubs ---

function createViemProvider(config) {
  return {}
}
function createJsonRpcClient(config) {
  return {}
}
function createBundlerRpcClient(config) {
  return {}
}
function createPaymasterRpcClient(config) {
  return {}
}
function createBundlerClient(config) {
  return {}
}
function createSmartAccountClient(config) {
  return {}
}
function createPaymasterClient(config) {
  return {}
}

// --- Module system stubs ---

function createModuleRegistry(config) {
  return {}
}
function createModuleClient(config) {
  return {}
}

// --- Gas ---

function createGasEstimator(config) {
  return {}
}

// --- Transaction ---

function createTransactionRouter(config) {
  return {}
}
function createEOATransactionBuilder(config) {
  return {}
}

// --- Error utilities ---

function normalizeError(err) {
  return err instanceof Error ? err : new Error(String(err))
}
function isSdkError(err) {
  return err instanceof SdkError
}

module.exports = {
  // Enums
  TransactionRiskLevel,
  TransactionRiskType,
  SignatureMethod,
  SignatureRiskLevel,
  SignatureRiskType,
  RiskLevel,
  PhishingPatternType,
  DeprecationStatus,

  // Constants
  DEFAULT_LIMITS,
  METHOD_CATEGORIES,

  // Classes
  InputValidator,
  RateLimiter,
  TransactionRiskAnalyzer,
  SignatureRiskAnalyzer,
  PhishingDetector,
  TypedDataValidator,
  IndexerClient,

  // Factory functions
  createInputValidator,
  createRateLimiter,
  createTransactionRiskAnalyzer,
  createSignatureRiskAnalyzer,
  createPhishingDetector,
  createTypedDataValidator,
  createIndexerClient,

  // Standalone validation functions
  isValidInputAddress,
  isValidAddress,
  isValidHex,
  isValidChainId,
  isValidTransactionObject,
  isValidRpcRequest,
  sanitizeString,

  // Legacy API Warning functions
  hasApiWarning,
  getApiWarning,
  shouldBlockMethod,
  getAllApiWarnings,
  getWarningsByStatus,
  formatApiWarningForUI,
  formatWarningForUI,
  createConsoleDeprecationNotice,
  updateEthSignSettings,
  getEthSignSettings,
  isEthSignAllowed,
  shouldShowEthSignWarning,
  resetEthSignSettings,

  // Authorization risk
  analyzeAuthorizationRisk,
  getAuthorizationSummary,
  formatRiskWarningsForUI,

  // Token utilities
  formatTokenBalance,
  parseTokenAmount,

  // Error classes
  SdkError,
  ValidationError,
  RpcError,
  isRpcError,
  normalizeError,
  isSdkError,

  // Provider/Client stubs
  createViemProvider,
  createJsonRpcClient,
  createBundlerRpcClient,
  createPaymasterRpcClient,
  createBundlerClient,
  createSmartAccountClient,
  createPaymasterClient,

  // Module system
  createModuleRegistry,
  createModuleClient,

  // Gas
  createGasEstimator,

  // Transaction
  createTransactionRouter,
  createEOATransactionBuilder,
}
