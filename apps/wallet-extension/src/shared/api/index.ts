/**
 * API Module Exports
 */

// Error handling
export {
  ApiError,
  API_ERROR_CODES,
  isApiError,
  normalizeError,
  createErrorFromResponse,
  getErrorCodeFromStatus,
  type ApiErrorCode,
  type ApiErrorDetails,
} from './errors'

// Base API client
export {
  BaseApi,
  type RequestConfig,
  type ApiResponse,
  type BaseApiConfig,
} from './BaseApi'
