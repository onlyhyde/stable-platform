/**
 * Client Configuration Constants
 *
 * Centralized timeout, retry, and polling settings for all SDK clients.
 * All values are documented with their purpose and typical use cases.
 */

// ============================================================================
// Timeout Settings (milliseconds)
// ============================================================================

/**
 * Default RPC request timeout (10 seconds)
 * Used for standard JSON-RPC calls to bundlers/paymasters
 */
export const DEFAULT_RPC_TIMEOUT = 10_000

/**
 * Default provider request timeout (30 seconds)
 * Used for blockchain RPC provider calls (may need longer for complex queries)
 */
export const DEFAULT_PROVIDER_TIMEOUT = 30_000

/**
 * Default transaction confirmation timeout (60 seconds)
 * Maximum wait time for transaction to be confirmed
 */
export const DEFAULT_CONFIRMATION_TIMEOUT = 60_000

/**
 * Default indexer request timeout (30 seconds)
 * Used for indexer API calls
 */
export const DEFAULT_INDEXER_TIMEOUT = 30_000

// ============================================================================
// Retry Settings
// ============================================================================

/**
 * Default maximum retry attempts
 * Number of times to retry a failed request
 */
export const DEFAULT_MAX_RETRIES = 3

/**
 * Default retry delay (1 second)
 * Base delay between retries (used with exponential backoff)
 */
export const DEFAULT_RETRY_DELAY = 1_000

/**
 * Backoff multiplier for exponential retry
 * Each retry waits: baseDelay * (multiplier ^ attemptNumber)
 */
export const RETRY_BACKOFF_MULTIPLIER = 2

// ============================================================================
// Polling Settings
// ============================================================================

/**
 * Default polling interval (1 second)
 * How often to check for transaction receipt
 */
export const DEFAULT_POLLING_INTERVAL = 1_000

/**
 * UserOperation receipt polling interval
 */
export const USER_OP_POLLING_INTERVAL = 1_000

// ============================================================================
// Confirmation Settings
// ============================================================================

/**
 * Default confirmation count
 * Number of block confirmations to wait for
 */
export const DEFAULT_CONFIRMATIONS = 1

// ============================================================================
// Client Config Object (for structured access)
// ============================================================================

/**
 * Complete client configuration object
 * Provides structured access to all client settings
 */
export const CLIENT_CONFIG = {
  timeout: {
    rpc: DEFAULT_RPC_TIMEOUT,
    provider: DEFAULT_PROVIDER_TIMEOUT,
    confirmation: DEFAULT_CONFIRMATION_TIMEOUT,
    indexer: DEFAULT_INDEXER_TIMEOUT,
  },
  retry: {
    maxAttempts: DEFAULT_MAX_RETRIES,
    delay: DEFAULT_RETRY_DELAY,
    backoffMultiplier: RETRY_BACKOFF_MULTIPLIER,
  },
  polling: {
    interval: DEFAULT_POLLING_INTERVAL,
    userOp: USER_OP_POLLING_INTERVAL,
  },
  confirmation: {
    count: DEFAULT_CONFIRMATIONS,
  },
} as const
