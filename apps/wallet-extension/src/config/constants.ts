/**
 * Wallet Extension Configuration Constants
 *
 * Centralized configuration for the wallet extension.
 * Values can be overridden via environment variables at build time.
 *
 * Environment variables follow the pattern:
 * - VITE_WALLET_[CATEGORY]_[NAME]
 */

// Vite injects environment variables at build time
// This gets the env object from Vite's import.meta.env or returns empty object
declare const __VITE_ENV__: Record<string, string | undefined> | undefined

// For build-time environment variable injection
// Vite replaces import.meta.env.* with actual values at build time
function getViteEnv(): Record<string, string | undefined> {
  // Use globalThis to access import.meta.env in a way that Jest can handle
  // Vite will replace this at build time
  try {
    // biome-ignore lint/suspicious/noExplicitAny: Vite/Jest compat requires any cast
    const meta = (globalThis as any).import?.meta?.env
    if (meta) {
      return meta as Record<string, string | undefined>
    }
  } catch {
    // Fallback for test environments
  }
  return {}
}

/**
 * Environment variable names
 */
export const WALLET_ENV_VARS = {
  // API URLs
  BANK_API_URL: 'VITE_WALLET_BANK_API_URL',
  ONRAMP_API_URL: 'VITE_WALLET_ONRAMP_API_URL',

  // Network URLs (StableNet Local)
  LOCAL_RPC_URL: 'VITE_WALLET_LOCAL_RPC_URL',
  LOCAL_BUNDLER_URL: 'VITE_WALLET_LOCAL_BUNDLER_URL',
  LOCAL_PAYMASTER_URL: 'VITE_WALLET_LOCAL_PAYMASTER_URL',
  LOCAL_STEALTH_SERVER_URL: 'VITE_WALLET_LOCAL_STEALTH_SERVER_URL',

  // Network URLs (Devnet)
  DEVNET_RPC_URL: 'VITE_WALLET_DEVNET_RPC_URL',
  DEVNET_BUNDLER_URL: 'VITE_WALLET_DEVNET_BUNDLER_URL',
  DEVNET_PAYMASTER_URL: 'VITE_WALLET_DEVNET_PAYMASTER_URL',
  DEVNET_STEALTH_SERVER_URL: 'VITE_WALLET_DEVNET_STEALTH_SERVER_URL',

  // Network URLs (Testnet/Sepolia)
  TESTNET_RPC_URL: 'VITE_WALLET_TESTNET_RPC_URL',
  TESTNET_BUNDLER_URL: 'VITE_WALLET_TESTNET_BUNDLER_URL',
  TESTNET_PAYMASTER_URL: 'VITE_WALLET_TESTNET_PAYMASTER_URL',
  TESTNET_STEALTH_SERVER_URL: 'VITE_WALLET_TESTNET_STEALTH_SERVER_URL',

  // Timeouts and Intervals
  API_TIMEOUT_MS: 'VITE_WALLET_API_TIMEOUT_MS',
  GAS_POLLING_INTERVAL_MS: 'VITE_WALLET_GAS_POLLING_INTERVAL_MS',
  APPROVAL_EXPIRY_MS: 'VITE_WALLET_APPROVAL_EXPIRY_MS',

  // Security
  AUTO_LOCK_MINUTES: 'VITE_WALLET_AUTO_LOCK_MINUTES',
  PBKDF2_ITERATIONS: 'VITE_WALLET_PBKDF2_ITERATIONS',
  ENFORCE_HTTPS_RPC_URLS: 'VITE_WALLET_ENFORCE_HTTPS_RPC_URLS',

  // Limits
  GAS_HISTORY_MAX_LENGTH: 'VITE_WALLET_GAS_HISTORY_MAX_LENGTH',
  APPROVAL_HISTORY_MAX_LENGTH: 'VITE_WALLET_APPROVAL_HISTORY_MAX_LENGTH',

  // RPC Configuration
  RPC_REQUEST_TIMEOUT_MS: 'VITE_WALLET_RPC_REQUEST_TIMEOUT_MS',
  TOAST_DURATION_MS: 'VITE_WALLET_TOAST_DURATION_MS',

} as const

/**
 * Default values
 */
const DEFAULTS = {
  // API URLs (match simulator service ports)
  BANK_API_URL: 'http://localhost:4350/api/v1',
  ONRAMP_API_URL: 'http://localhost:4352/api/v1',

  // Network URLs (StableNet Local - Chain ID 8283)
  LOCAL_RPC_URL: 'http://localhost:8501',
  LOCAL_BUNDLER_URL: 'http://localhost:4337',
  LOCAL_PAYMASTER_URL: 'http://localhost:4338',
  LOCAL_STEALTH_SERVER_URL: 'http://localhost:4339',

  // Network URLs (Devnet)
  DEVNET_RPC_URL: 'http://localhost:8545',
  DEVNET_BUNDLER_URL: 'http://localhost:4337',
  DEVNET_PAYMASTER_URL: 'http://localhost:4338',
  DEVNET_STEALTH_SERVER_URL: 'http://localhost:4339',

  // Network URLs (Testnet/Sepolia)
  TESTNET_RPC_URL: 'https://testnet.stablenet.io/rpc',
  TESTNET_BUNDLER_URL: 'https://testnet.stablenet.io/bundler',
  TESTNET_PAYMASTER_URL: 'https://testnet.stablenet.io/paymaster',
  TESTNET_STEALTH_SERVER_URL: 'https://testnet.stablenet.io/stealth',

  // Timeouts and Intervals
  API_TIMEOUT_MS: 30000,
  GAS_POLLING_INTERVAL_MS: 15000, // 15 seconds
  APPROVAL_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes

  // Security
  AUTO_LOCK_MINUTES: 5,
  PBKDF2_ITERATIONS: 100000,
  ENFORCE_HTTPS_RPC_URLS: false, // Set to true in production to enforce HTTPS for RPC URLs

  // Limits
  GAS_HISTORY_MAX_LENGTH: 100,
  APPROVAL_HISTORY_MAX_LENGTH: 50,

  // RPC Configuration
  RPC_REQUEST_TIMEOUT_MS: 60000, // 60 seconds for RPC requests
  TOAST_DURATION_MS: 5000, // 5 seconds for toast notifications
} as const

/**
 * Get environment variable with fallback
 */
function getEnvString(name: string, defaultValue: string): string {
  try {
    const env = getViteEnv()
    const value = env[name]
    if (value !== undefined && value !== '') {
      return value
    }
  } catch {
    // Fallback to default in environments without Vite
  }
  return defaultValue
}

/**
 * Get environment variable as number
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const strValue = getEnvString(name, String(defaultValue))
  const num = Number.parseInt(strValue, 10)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const strValue = getEnvString(name, String(defaultValue))
  return strValue === 'true' || strValue === '1'
}

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Get API configuration
 */
export function getApiConfig() {
  return {
    bankApiUrl: getEnvString(WALLET_ENV_VARS.BANK_API_URL, DEFAULTS.BANK_API_URL),
    onrampApiUrl: getEnvString(WALLET_ENV_VARS.ONRAMP_API_URL, DEFAULTS.ONRAMP_API_URL),
    timeoutMs: getEnvNumber(WALLET_ENV_VARS.API_TIMEOUT_MS, DEFAULTS.API_TIMEOUT_MS),
  }
}

// =============================================================================
// Network Configuration
// =============================================================================

/**
 * Get StableNet Local network configuration
 */
export function getLocalNetworkConfig() {
  return {
    rpcUrl: getEnvString(WALLET_ENV_VARS.LOCAL_RPC_URL, DEFAULTS.LOCAL_RPC_URL),
    bundlerUrl: getEnvString(WALLET_ENV_VARS.LOCAL_BUNDLER_URL, DEFAULTS.LOCAL_BUNDLER_URL),
    paymasterUrl: getEnvString(WALLET_ENV_VARS.LOCAL_PAYMASTER_URL, DEFAULTS.LOCAL_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      WALLET_ENV_VARS.LOCAL_STEALTH_SERVER_URL,
      DEFAULTS.LOCAL_STEALTH_SERVER_URL
    ),
  }
}

/**
 * Get Devnet network configuration
 */
export function getDevnetNetworkConfig() {
  return {
    rpcUrl: getEnvString(WALLET_ENV_VARS.DEVNET_RPC_URL, DEFAULTS.DEVNET_RPC_URL),
    bundlerUrl: getEnvString(WALLET_ENV_VARS.DEVNET_BUNDLER_URL, DEFAULTS.DEVNET_BUNDLER_URL),
    paymasterUrl: getEnvString(WALLET_ENV_VARS.DEVNET_PAYMASTER_URL, DEFAULTS.DEVNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      WALLET_ENV_VARS.DEVNET_STEALTH_SERVER_URL,
      DEFAULTS.DEVNET_STEALTH_SERVER_URL
    ),
  }
}

/**
 * Get Testnet network configuration
 */
export function getTestnetNetworkConfig() {
  return {
    rpcUrl: getEnvString(WALLET_ENV_VARS.TESTNET_RPC_URL, DEFAULTS.TESTNET_RPC_URL),
    bundlerUrl: getEnvString(WALLET_ENV_VARS.TESTNET_BUNDLER_URL, DEFAULTS.TESTNET_BUNDLER_URL),
    paymasterUrl: getEnvString(
      WALLET_ENV_VARS.TESTNET_PAYMASTER_URL,
      DEFAULTS.TESTNET_PAYMASTER_URL
    ),
    stealthServerUrl: getEnvString(
      WALLET_ENV_VARS.TESTNET_STEALTH_SERVER_URL,
      DEFAULTS.TESTNET_STEALTH_SERVER_URL
    ),
  }
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfigByChainId(chainId: number) {
  switch (chainId) {
    case 8283:
      return getLocalNetworkConfig()
    case 31337:
      return getDevnetNetworkConfig()
    case 11155111:
      return getTestnetNetworkConfig()
    default:
      return undefined
  }
}

// =============================================================================
// Gas Fee Configuration
// =============================================================================

/**
 * Get gas fee configuration
 */
export function getGasFeeConfig() {
  return {
    pollingIntervalMs: getEnvNumber(
      WALLET_ENV_VARS.GAS_POLLING_INTERVAL_MS,
      DEFAULTS.GAS_POLLING_INTERVAL_MS
    ),
    historyMaxLength: getEnvNumber(
      WALLET_ENV_VARS.GAS_HISTORY_MAX_LENGTH,
      DEFAULTS.GAS_HISTORY_MAX_LENGTH
    ),
  }
}

/**
 * Gas unit constant (1 Gwei in Wei)
 */
export const GWEI = BigInt(1_000_000_000)

// =============================================================================
// Approval Configuration
// =============================================================================

/**
 * Get approval configuration
 */
export function getApprovalConfig() {
  return {
    expiryMs: getEnvNumber(WALLET_ENV_VARS.APPROVAL_EXPIRY_MS, DEFAULTS.APPROVAL_EXPIRY_MS),
    historyMaxLength: getEnvNumber(
      WALLET_ENV_VARS.APPROVAL_HISTORY_MAX_LENGTH,
      DEFAULTS.APPROVAL_HISTORY_MAX_LENGTH
    ),
  }
}

// =============================================================================
// Security Configuration
// =============================================================================

/**
 * Get security configuration
 */
export function getSecurityConfig() {
  return {
    autoLockMinutes: getEnvNumber(WALLET_ENV_VARS.AUTO_LOCK_MINUTES, DEFAULTS.AUTO_LOCK_MINUTES),
    pbkdf2Iterations: getEnvNumber(WALLET_ENV_VARS.PBKDF2_ITERATIONS, DEFAULTS.PBKDF2_ITERATIONS),
    /**
     * When enabled, enforces HTTPS for all RPC URLs in production.
     * Set to false by default for local development/testing with HTTP URLs.
     * Enable via VITE_WALLET_ENFORCE_HTTPS_RPC_URLS=true for production builds.
     */
    enforceHttpsRpcUrls: getEnvBoolean(
      WALLET_ENV_VARS.ENFORCE_HTTPS_RPC_URLS,
      DEFAULTS.ENFORCE_HTTPS_RPC_URLS
    ),
  }
}

/**
 * Crypto configuration constants
 * These are fixed for security reasons and should not be changed via environment
 */
export const CRYPTO_CONFIG = {
  ALGORITHM: 'AES-GCM',
  KEY_LENGTH: 256,
  IV_LENGTH: 12,
  SALT_LENGTH: 32,
  TAG_LENGTH: 128,
  VAULT_VERSION: 1,
} as const

// =============================================================================
// Storage Keys
// =============================================================================

/**
 * Chrome storage keys
 */
export const STORAGE_KEYS = {
  AUTO_LOCK_MINUTES: 'stablenet_auto_lock_minutes',
  AUTO_LOCK_ALARM: 'stablenet-auto-lock',
  IDLE_CHECK_ALARM: 'stablenet-idle-check',
} as const

// =============================================================================
// RPC Configuration
// =============================================================================

/**
 * Get RPC configuration
 */
export function getRpcConfig() {
  return {
    requestTimeoutMs: getEnvNumber(
      WALLET_ENV_VARS.RPC_REQUEST_TIMEOUT_MS,
      DEFAULTS.RPC_REQUEST_TIMEOUT_MS
    ),
  }
}

// =============================================================================
// UI Configuration
// =============================================================================

/**
 * Get UI configuration
 */
export function getUiConfig() {
  return {
    toastDurationMs: getEnvNumber(WALLET_ENV_VARS.TOAST_DURATION_MS, DEFAULTS.TOAST_DURATION_MS),
  }
}

// =============================================================================
// Chain IDs
// =============================================================================

/**
 * Well-known chain IDs
 */
export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  HARDHAT: 31337,
  LOCALHOST: 1337,
  STABLENET_LOCAL: 8283,
} as const

/**
 * Convert chain ID to hex string
 */
export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`
}

/**
 * Parse hex chain ID to number
 */
export function hexToChainId(hex: string): number {
  return Number.parseInt(hex, 16)
}

// =============================================================================
// URL Security Validation
// =============================================================================

/**
 * Validate RPC URL for security requirements
 * When enforceHttpsRpcUrls is enabled, rejects HTTP URLs (except localhost)
 *
 * @param url - The RPC URL to validate
 * @returns Object with valid status and optional error message
 */
export function validateRpcUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    // Always allow localhost/127.0.0.1 for development
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'

    // Check HTTPS enforcement when enabled
    const securityConfig = getSecurityConfig()
    if (securityConfig.enforceHttpsRpcUrls && !isLocalhost) {
      if (parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: `HTTPS is required for RPC URLs in production. Got: ${parsed.protocol}`,
        }
      }
    }

    // Validate protocol is http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol for RPC URL. Expected http: or https:, got: ${parsed.protocol}`,
      }
    }

    return { valid: true }
  } catch {
    return {
      valid: false,
      error: `Invalid URL format: ${url}`,
    }
  }
}

/**
 * Assert that an RPC URL is valid, throwing an error if not
 *
 * @param url - The RPC URL to validate
 * @throws Error if URL is invalid or fails security requirements
 */
export function assertValidRpcUrl(url: string): void {
  const result = validateRpcUrl(url)
  if (!result.valid) {
    throw new Error(result.error)
  }
}
