/**
 * Base API client with common functionality
 */

import { getApiConfig } from '../../config'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

/**
 * Get default timeout from configuration
 */
function getDefaultTimeout(): number {
  return getApiConfig().timeoutMs
}

export class BaseApiClient {
  protected baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Make an API request
   */
  protected async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, timeout = getDefaultTimeout() } = options

    const url = `${this.baseUrl}${endpoint}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiClientError(
          errorData.message ?? `HTTP ${response.status}`,
          errorData.code ?? `HTTP_${response.status}`,
          response.status,
          errorData.details
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof ApiClientError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiClientError('Request timeout', 'TIMEOUT', 408)
        }
        throw new ApiClientError(error.message, 'NETWORK_ERROR', 0)
      }

      throw new ApiClientError('Unknown error', 'UNKNOWN', 0)
    }
  }

  /**
   * GET request
   */
  protected get<T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  protected post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  /**
   * PUT request
   */
  protected put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  /**
   * DELETE request
   */
  protected delete<T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  /**
   * PATCH request
   */
  protected patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
  }
}

/**
 * API Client Error
 */
export class ApiClientError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}
