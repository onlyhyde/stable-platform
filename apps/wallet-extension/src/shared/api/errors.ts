/**
 * API Error Handling
 * Standardized error types and utilities for API requests
 */

/**
 * API Error codes for categorizing errors
 */
export const API_ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',

  // HTTP errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Application errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/**
 * API Error details structure
 */
export interface ApiErrorDetails {
  code: ApiErrorCode
  message: string
  status?: number
  url?: string
  method?: string
  cause?: unknown
  timestamp: number
  requestId?: string
}

/**
 * Custom API Error class with detailed error information
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status?: number
  readonly url?: string
  readonly method?: string
  readonly cause?: unknown
  readonly timestamp: number
  readonly requestId?: string

  constructor(details: Omit<ApiErrorDetails, 'timestamp'> & { timestamp?: number }) {
    super(details.message)
    this.name = 'ApiError'
    this.code = details.code
    this.status = details.status
    this.url = details.url
    this.method = details.method
    this.cause = details.cause
    this.timestamp = details.timestamp ?? Date.now()
    this.requestId = details.requestId

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes: ApiErrorCode[] = [
      API_ERROR_CODES.NETWORK_ERROR,
      API_ERROR_CODES.TIMEOUT,
      API_ERROR_CODES.SERVICE_UNAVAILABLE,
      API_ERROR_CODES.RATE_LIMITED,
    ]
    return retryableCodes.includes(this.code)
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status !== undefined && this.status >= 500
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): ApiErrorDetails {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      url: this.url,
      method: this.method,
      cause: this.cause,
      timestamp: this.timestamp,
      requestId: this.requestId,
    }
  }

  /**
   * Create a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case API_ERROR_CODES.NETWORK_ERROR:
        return 'Unable to connect. Please check your internet connection.'
      case API_ERROR_CODES.TIMEOUT:
        return 'Request timed out. Please try again.'
      case API_ERROR_CODES.UNAUTHORIZED:
        return 'Session expired. Please reconnect your wallet.'
      case API_ERROR_CODES.FORBIDDEN:
        return 'You do not have permission to perform this action.'
      case API_ERROR_CODES.NOT_FOUND:
        return 'The requested resource was not found.'
      case API_ERROR_CODES.RATE_LIMITED:
        return 'Too many requests. Please wait and try again.'
      case API_ERROR_CODES.SERVER_ERROR:
      case API_ERROR_CODES.SERVICE_UNAVAILABLE:
        return 'Server error. Please try again later.'
      default:
        return this.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Get API error code from HTTP status
 */
export function getErrorCodeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return API_ERROR_CODES.BAD_REQUEST
    case 401:
      return API_ERROR_CODES.UNAUTHORIZED
    case 403:
      return API_ERROR_CODES.FORBIDDEN
    case 404:
      return API_ERROR_CODES.NOT_FOUND
    case 409:
      return API_ERROR_CODES.CONFLICT
    case 429:
      return API_ERROR_CODES.RATE_LIMITED
    case 500:
      return API_ERROR_CODES.SERVER_ERROR
    case 503:
      return API_ERROR_CODES.SERVICE_UNAVAILABLE
    default:
      if (status >= 400 && status < 500) {
        return API_ERROR_CODES.BAD_REQUEST
      }
      if (status >= 500) {
        return API_ERROR_CODES.SERVER_ERROR
      }
      return API_ERROR_CODES.UNKNOWN_ERROR
  }
}

/**
 * Normalize any error to ApiError
 */
export function normalizeError(
  error: unknown,
  context?: { url?: string; method?: string }
): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error
  }

  // Fetch AbortError
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({
      code: API_ERROR_CODES.ABORTED,
      message: 'Request was cancelled',
      ...context,
    })
  }

  // Network error (TypeError from fetch)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError({
      code: API_ERROR_CODES.NETWORK_ERROR,
      message: 'Network request failed',
      cause: error,
      ...context,
    })
  }

  // Standard Error
  if (error instanceof Error) {
    return new ApiError({
      code: API_ERROR_CODES.UNKNOWN_ERROR,
      message: error.message,
      cause: error,
      ...context,
    })
  }

  // Unknown error type
  return new ApiError({
    code: API_ERROR_CODES.UNKNOWN_ERROR,
    message: String(error),
    cause: error,
    ...context,
  })
}

/**
 * Check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Create ApiError from fetch Response
 */
export async function createErrorFromResponse(
  response: Response,
  context?: { method?: string }
): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`
  let cause: unknown

  try {
    const body = await response.text()
    if (body) {
      try {
        const json = JSON.parse(body)
        message = json.message || json.error || message
        cause = json
      } catch {
        message = body.slice(0, 200)
        cause = body
      }
    }
  } catch {
    // Ignore parse errors
  }

  return new ApiError({
    code: getErrorCodeFromStatus(response.status),
    message,
    status: response.status,
    url: response.url,
    method: context?.method,
    cause,
    requestId: response.headers.get('x-request-id') ?? undefined,
  })
}
