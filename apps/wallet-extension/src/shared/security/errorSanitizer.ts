/**
 * Error Sanitizer (SEC-15)
 *
 * Sanitizes error messages to prevent leaking internal information
 * while maintaining useful debugging context for development.
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('ErrorSanitizer')

/**
 * Patterns that indicate internal/sensitive information
 */
const SENSITIVE_PATTERNS = [
  // File paths
  /\/Users\/[^/]+/gi,
  /\/home\/[^/]+/gi,
  /C:\\Users\\[^\\]+/gi,
  /[a-zA-Z]:\\[^:]+\.(ts|js|tsx|jsx)/gi,

  // Stack traces
  /at\s+\S+\s+\([^)]+\)/g,
  /at\s+[^\n]+:\d+:\d+/g,

  // Internal module paths
  /node_modules\/[^\s]+/g,
  /\.\.\/[^\s]+/g,

  // Memory addresses
  /0x[0-9a-fA-F]{8,}/g,

  // Internal error codes that might reveal implementation
  /ENOENT|EACCES|EPERM|ECONNREFUSED/g,

  // Database/storage errors
  /IndexedDB|localStorage|sessionStorage|chrome\.storage/gi,

  // API keys or tokens (partial matches)
  /[a-zA-Z0-9_-]{20,}/g,

  // IP addresses (internal)
  /\b(?:192\.168|10\.|172\.(?:1[6-9]|2[0-9]|3[01]))\.\d{1,3}\.\d{1,3}\b/g,

  // Internal hostnames
  /localhost:\d+/g,
]

/**
 * Patterns for specific error types with safe replacements
 */
const ERROR_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /failed to fetch/i,
    replacement: 'Network request failed',
  },
  {
    pattern: /network error/i,
    replacement: 'Network connection error',
  },
  {
    pattern: /timeout/i,
    replacement: 'Request timed out',
  },
  {
    pattern: /invalid json/i,
    replacement: 'Invalid response format',
  },
  {
    pattern: /unexpected token/i,
    replacement: 'Invalid response format',
  },
  {
    pattern: /cannot read propert/i,
    replacement: 'Internal error occurred',
  },
  {
    pattern: /undefined is not/i,
    replacement: 'Internal error occurred',
  },
  {
    pattern: /null is not/i,
    replacement: 'Internal error occurred',
  },
  {
    pattern: /chrome\.(runtime|storage|tabs)/i,
    replacement: 'Extension error',
  },
]

/**
 * Known safe error messages that can be passed through
 */
const SAFE_ERROR_MESSAGES = new Set([
  'Vault is locked',
  'Vault is not initialized',
  'Incorrect password',
  'User rejected the request',
  'Approval request expired',
  'Permission denied',
  'Rate limit exceeded',
  'Invalid address',
  'Invalid chain ID',
  'Invalid transaction',
  'Insufficient funds',
  'Gas estimation failed',
  'Transaction failed',
  'Network not supported',
  'Account not found',
  'Connection terminated',
  'Re-authentication required',
  'Session decryption failed',
  'Session encryption failed',
])

/**
 * Generic safe messages for different error categories
 */
const GENERIC_MESSAGES: Record<string, string> = {
  network: 'A network error occurred. Please try again.',
  authentication: 'Authentication failed. Please try again.',
  permission: 'Permission denied for this operation.',
  validation: 'The request contains invalid data.',
  internal: 'An internal error occurred. Please try again.',
  timeout: 'The operation timed out. Please try again.',
  storage: 'Storage operation failed. Please try again.',
  default: 'An error occurred. Please try again.',
}

/**
 * Error categories for classification
 */
type ErrorCategory = keyof typeof GENERIC_MESSAGES

/**
 * Sanitize an error message for external display
 *
 * @param error - The error to sanitize (Error object or string)
 * @param options - Sanitization options
 * @returns Sanitized error message safe for display
 */
export function sanitizeErrorMessage(
  error: Error | string | unknown,
  options: {
    /** Allow known safe messages through */
    allowSafeMessages?: boolean
    /** Include error code if available */
    includeErrorCode?: boolean
    /** Log original error for debugging */
    logOriginal?: boolean
    /** Force a specific category */
    category?: ErrorCategory
  } = {}
): string {
  const {
    allowSafeMessages = true,
    includeErrorCode = true,
    logOriginal = true,
    category,
  } = options

  // Extract message from error
  let message = extractMessage(error)
  const errorCode = extractErrorCode(error)

  // Log original error for debugging (in development)
  if (logOriginal && process.env.NODE_ENV !== 'production') {
    logger.debug('Original error:', { message, errorCode, error })
  }

  // Check if it's a known safe message
  if (allowSafeMessages && SAFE_ERROR_MESSAGES.has(message)) {
    return includeErrorCode && errorCode ? `${message} (${errorCode})` : message
  }

  // Apply specific replacements
  for (const { pattern, replacement } of ERROR_REPLACEMENTS) {
    if (pattern.test(message)) {
      message = replacement
      break
    }
  }

  // Remove sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[redacted]')
  }

  // If message still contains potentially sensitive info, use generic
  if (containsSensitiveInfo(message)) {
    const detectedCategory = category || classifyError(error)
    message = (GENERIC_MESSAGES[detectedCategory] ?? GENERIC_MESSAGES.default) as string
  }

  // Add error code if available and requested
  if (includeErrorCode && errorCode) {
    return `${message} (${errorCode})`
  }

  return message
}

/**
 * Extract error message from various error types
 */
function extractMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') {
      return obj.message
    }
    if (typeof obj.error === 'string') {
      return obj.error
    }
  }

  return 'Unknown error'
}

/**
 * Extract error code if available
 */
function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.code === 'number' || typeof obj.code === 'string') {
      return String(obj.code)
    }
  }
  return undefined
}

/**
 * Check if message still contains potentially sensitive info
 */
function containsSensitiveInfo(message: string): boolean {
  // Check for redacted markers (indicates sensitive content was found)
  if (message.includes('[redacted]')) {
    return true
  }

  // Check for path-like patterns
  if (/\/[a-z_-]+\/[a-z_-]+\//i.test(message)) {
    return true
  }

  // Check for line:column patterns (stack trace remnants)
  if (/:\d+:\d+/.test(message)) {
    return true
  }

  // Check for long alphanumeric strings (possible tokens/keys)
  if (/[a-zA-Z0-9]{32,}/.test(message)) {
    return true
  }

  return false
}

/**
 * Classify error into a category
 */
function classifyError(error: unknown): ErrorCategory {
  const message = extractMessage(error).toLowerCase()

  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network'
  }

  if (message.includes('auth') || message.includes('password') || message.includes('credential')) {
    return 'authentication'
  }

  if (
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('unauthorized')
  ) {
    return 'permission'
  }

  if (message.includes('invalid') || message.includes('required') || message.includes('missing')) {
    return 'validation'
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout'
  }

  if (
    message.includes('storage') ||
    message.includes('database') ||
    message.includes('indexeddb')
  ) {
    return 'storage'
  }

  return 'default'
}

/**
 * Create a sanitized error object
 */
export function createSanitizedError(
  error: unknown,
  options?: Parameters<typeof sanitizeErrorMessage>[1]
): Error {
  const message = sanitizeErrorMessage(error, options)
  const sanitized = new Error(message)

  // Copy error code if present
  const code = extractErrorCode(error)
  if (code) {
    ;(sanitized as Error & { code?: string }).code = code
  }

  return sanitized
}

/**
 * Wrap an async function to sanitize any thrown errors
 */
export function withSanitizedErrors<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: Parameters<typeof sanitizeErrorMessage>[1]
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      throw createSanitizedError(error, options)
    }
  }) as T
}
