/**
 * SDK Configuration Module
 *
 * Centralized configuration constants for the StableNet SDK.
 * Import from this module to access all configuration values.
 */

// Gas configuration
export {
  // Priority fee bounds
  MIN_PRIORITY_FEE,
  MAX_PRIORITY_FEE,
  DEFAULT_MAX_FEE_PER_GAS,
  // Base gas limits
  BASE_TRANSFER_GAS,
  MAX_GAS_LIMIT,
  // Gas buffer
  GAS_BUFFER_MULTIPLIER,
  GAS_BUFFER_DIVISOR,
  // EIP-7702
  EIP7702_AUTH_GAS,
  GAS_PER_AUTHORIZATION,
  SETCODE_BASE_GAS,
  // Smart Account
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_CALL_GAS_LIMIT,
  PAYMASTER_VERIFICATION_GAS,
  PAYMASTER_POST_OP_GAS,
  // Structured config
  GAS_CONFIG,
} from './gas'

// Client configuration
export {
  // Timeouts
  DEFAULT_RPC_TIMEOUT,
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_CONFIRMATION_TIMEOUT,
  DEFAULT_INDEXER_TIMEOUT,
  // Retry settings
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  RETRY_BACKOFF_MULTIPLIER,
  // Polling
  DEFAULT_POLLING_INTERVAL,
  USER_OP_POLLING_INTERVAL,
  // Confirmations
  DEFAULT_CONFIRMATIONS,
  // Structured config
  CLIENT_CONFIG,
} from './client'
