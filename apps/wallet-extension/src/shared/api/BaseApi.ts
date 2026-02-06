/**
 * Base API Client
 * Provides standardized HTTP request handling with error management
 */

import { API_ERROR_CODES, ApiError, createErrorFromResponse, normalizeError } from './errors'

/**
 * Request configuration options
 */
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
  retries?: number
  retryDelay?: number
  signal?: AbortSignal
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
}

/**
 * Base API configuration
 */
export interface BaseApiConfig {
  baseUrl: string
  defaultTimeout?: number
  defaultRetries?: number
  defaultRetryDelay?: number
  defaultHeaders?: Record<string, string>
  onError?: (error: ApiError) => void
  onRequest?: (url: string, config: RequestConfig) => void
  onResponse?: <T>(response: ApiResponse<T>) => void
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 0,
  retryDelay: 1000,
}

/**
 * Base API client class
 * Provides standardized HTTP request handling with proper error management
 */
export class BaseApi {
  protected readonly baseUrl: string
  protected readonly defaultTimeout: number
  protected readonly defaultRetries: number
  protected readonly defaultRetryDelay: number
  protected readonly defaultHeaders: Record<string, string>
  protected readonly onError?: (error: ApiError) => void
  protected readonly onRequest?: (url: string, config: RequestConfig) => void
  protected readonly onResponse?: <T>(response: ApiResponse<T>) => void

  constructor(config: BaseApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.defaultTimeout = config.defaultTimeout ?? DEFAULT_CONFIG.timeout
    this.defaultRetries = config.defaultRetries ?? DEFAULT_CONFIG.retries
    this.defaultRetryDelay = config.defaultRetryDelay ?? DEFAULT_CONFIG.retryDelay
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.defaultHeaders,
    }
    this.onError = config.onError
    this.onRequest = config.onRequest
    this.onResponse = config.onResponse
  }

  /**
   * Make an HTTP request
   */
  async request<T>(path: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path)
    const method = config.method ?? 'GET'
    const timeout = config.timeout ?? this.defaultTimeout
    const retries = config.retries ?? this.defaultRetries
    const retryDelay = config.retryDelay ?? this.defaultRetryDelay

    // Notify request hook
    this.onRequest?.(url, config)

    let lastError: ApiError | null = null
    let attempts = 0

    while (attempts <= retries) {
      try {
        const response = await this.executeRequest<T>(url, method, config, timeout)

        // Notify response hook
        this.onResponse?.(response)

        return response
      } catch (error) {
        lastError = normalizeError(error, { url, method })

        // Check if we should retry
        if (attempts < retries && lastError.isRetryable()) {
          attempts++
          await this.delay(retryDelay * attempts) // Exponential backoff
          continue
        }

        // Notify error hook
        this.onError?.(lastError)

        throw lastError
      }
    }

    // Should never reach here, but TypeScript needs this
    throw (
      lastError ??
      new ApiError({
        code: API_ERROR_CODES.UNKNOWN_ERROR,
        message: 'Request failed',
        url,
        method,
      })
    )
  }

  /**
   * Execute a single request attempt
   */
  private async executeRequest<T>(
    url: string,
    method: string,
    config: RequestConfig,
    timeout: number
  ): Promise<ApiResponse<T>> {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Combine signals if user provided one
    const signal = config.signal
      ? this.combineSignals(config.signal, controller.signal)
      : controller.signal

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal,
      })

      // Clear timeout since request completed
      clearTimeout(timeoutId)

      // Handle non-OK responses
      if (!response.ok) {
        throw await createErrorFromResponse(response, { method })
      }

      // Parse response
      let data: T
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = (await response.text()) as unknown as T
      }

      return {
        data,
        status: response.status,
        headers: response.headers,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Check if it was a timeout or user abort
        if (config.signal?.aborted) {
          throw new ApiError({
            code: API_ERROR_CODES.ABORTED,
            message: 'Request was cancelled',
            url,
            method,
          })
        }
        throw new ApiError({
          code: API_ERROR_CODES.TIMEOUT,
          message: `Request timed out after ${timeout}ms`,
          url,
          method,
        })
      }

      throw error
    }
  }

  /**
   * Convenience methods
   */
  async get<T>(path: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'GET' })
    return response.data
  }

  async post<T>(
    path: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'POST', body })
    return response.data
  }

  async put<T>(
    path: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'PUT', body })
    return response.data
  }

  async patch<T>(
    path: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'PATCH', body })
    return response.data
  }

  async delete<T>(path: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'DELETE' })
    return response.data
  }

  /**
   * Build full URL from path
   */
  protected buildUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${this.baseUrl}${normalizedPath}`
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Combine multiple abort signals
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        return controller.signal
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    return controller.signal
  }
}
