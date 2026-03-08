/**
 * SDK Configuration Module
 *
 * Centralized configuration constants for the StableNet SDK.
 * Import from this module to access all configuration values.
 */

// Client configuration
export {
  // Structured config
  CLIENT_CONFIG,
  DEFAULT_CONFIRMATION_TIMEOUT,
  // Confirmations
  DEFAULT_CONFIRMATIONS,
  DEFAULT_INDEXER_TIMEOUT,
  // Retry settings
  DEFAULT_MAX_RETRIES,
  // Polling
  DEFAULT_POLLING_INTERVAL,
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_RETRY_DELAY,
  // Timeouts
  DEFAULT_RPC_TIMEOUT,
  RETRY_BACKOFF_MULTIPLIER,
  USER_OP_POLLING_INTERVAL,
} from './client'
// Gas configuration
export {
  // Base gas limits
  BASE_TRANSFER_GAS,
  calculateCalldataCost,
  calculatePreVerificationGas,
  calculateUnusedGasPenalty,
  CALLDATA_NONZERO_BYTE_COST,
  CALLDATA_ZERO_BYTE_COST,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_MAX_FEE_PER_GAS,
  DEFAULT_PRE_VERIFICATION_GAS,
  // Smart Account
  DEFAULT_VERIFICATION_GAS_LIMIT,
  // EIP-7702
  EIP7702_AUTH_GAS,
  GAS_BUFFER_DIVISOR,
  // Gas buffer
  GAS_BUFFER_MULTIPLIER,
  // Structured config
  GAS_CONFIG,
  GAS_PER_AUTHORIZATION,
  isL2Chain,
  L2_CHAIN_IDS,
  MAX_GAS_LIMIT,
  MAX_PRIORITY_FEE,
  // Priority fee bounds
  MIN_PRIORITY_FEE,
  PAYMASTER_POST_OP_GAS,
  PAYMASTER_VERIFICATION_GAS,
  PER_USEROP_OVERHEAD,
  SETCODE_BASE_GAS,
  // EIP-4337 v0.9 unused gas penalty
  UNUSED_GAS_PENALTY_DIVISOR,
  UNUSED_GAS_PENALTY_THRESHOLD,
} from './gas'
