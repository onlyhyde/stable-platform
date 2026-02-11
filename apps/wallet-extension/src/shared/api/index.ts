/**
 * API Module Exports
 */

// Base API client
export {
  type ApiResponse,
  BaseApi,
  type BaseApiConfig,
  type RequestConfig,
} from './BaseApi'
// Error handling
export {
  API_ERROR_CODES,
  ApiError,
  type ApiErrorCode,
  type ApiErrorDetails,
  createErrorFromResponse,
  getErrorCodeFromStatus,
  isApiError,
  normalizeError,
} from './errors'
