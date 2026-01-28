/**
 * Wallet Extension Configuration
 *
 * Centralized configuration management for the wallet extension.
 * All values can be overridden via VITE_WALLET_ environment variables at build time.
 */

export {
  // Environment variable names
  WALLET_ENV_VARS,
  // API configuration
  getApiConfig,
  // Network configuration
  getDevnetNetworkConfig,
  getTestnetNetworkConfig,
  getNetworkConfigByChainId,
  // Gas fee configuration
  getGasFeeConfig,
  GWEI,
  // Approval configuration
  getApprovalConfig,
  // Security configuration
  getSecurityConfig,
  CRYPTO_CONFIG,
  // Storage keys
  STORAGE_KEYS,
} from './constants'
