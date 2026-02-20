/**
 * Wallet Extension Configuration
 *
 * Centralized configuration management for the wallet extension.
 * All values can be overridden via VITE_WALLET_ environment variables at build time.
 */

export {
  CRYPTO_CONFIG,
  GWEI,
  // API configuration
  getApiConfig,
  // Approval configuration
  getApprovalConfig,
  // Network configuration
  getDevnetNetworkConfig,
  // Gas fee configuration
  getGasFeeConfig,
  getNetworkConfigByChainId,
  // Security configuration
  getSecurityConfig,
  getTestnetNetworkConfig,
  // Storage keys
  STORAGE_KEYS,
  // Environment variable names
  WALLET_ENV_VARS,
} from './constants'
