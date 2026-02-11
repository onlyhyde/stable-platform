/**
 * JSON-RPC Client
 *
 * Unified JSON-RPC 2.0 client with retry logic, timeout handling,
 * and standardized error handling.
 *
 * Follows DIP: depends on abstractions (interfaces) not concretions.
 * Follows SRP: handles only RPC communication.
 *
 * @example
 * ```typescript
 * const client = createJsonRpcClient({
 *   url: 'https://bundler.example.com',
 *   timeout: 10000,
 *   maxRetries: 3,
 * })
 *
 * const result = await client.request<string>('eth_chainId', [])
 * ```
 */

import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  DEFAULT_RPC_TIMEOUT,
  RETRY_BACKOFF_MULTIPLIER,
} from '../config'
import { isRpcError, RpcError } from './errors'
import type {
  JsonRpcClientConfig,
  JsonRpcRequest,
  JsonRpcRequestOptions,
  JsonRpcResponse,
} from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * JSON-RPC Client interface
 */
export interface JsonRpcClient {
  /** Make a JSON-RPC request */
  request<TResult = unknown, TParams = unknown[]>(
    method: string,
    params: TParams,
    options?: JsonRpcRequestOptions
  ): Promise<TResult>

  /** Get the configured URL */
  readonly url: string

  /** Check if the endpoint is reachable */
  isAvailable(): Promise<boolean>
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Create a JSON-RPC client
 */
export function createJsonRpcClient(config: JsonRpcClientConfig): JsonRpcClient {
  const {
    url,
    timeout = DEFAULT_RPC_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    headers: defaultHeaders = {},
    apiKey,
  } = config

  // Request counter for unique IDs
  let requestId = 0

  /**
   * Build request headers
   */
  function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...customHeaders,
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    return headers
  }

  /**
   * Execute a single request attempt
   */
  async function executeRequest<TResult, TParams>(
    method: string,
    params: TParams,
    requestTimeout: number,
    headers: Record<string, string>
  ): Promise<TResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

    const request: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      id: ++requestId,
      method,
      params,
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle HTTP errors
      if (!response.ok) {
        throw RpcError.http(url, response.status, response.statusText)
      }

      // Parse response
      let data: JsonRpcResponse<TResult>
      try {
        data = await response.json()
      } catch (parseError) {
        throw RpcError.parseError(url, parseError instanceof Error ? parseError : undefined)
      }

      // Handle RPC errors
      if (data.error) {
        throw RpcError.fromRpcError(data.error, { url, method })
      }

      return data.result as TResult
    } catch (error) {
      clearTimeout(timeoutId)

      // Convert AbortError to timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        throw RpcError.timeout(url, requestTimeout)
      }

      // Re-throw RpcErrors
      if (isRpcError(error)) {
        throw error
      }

      // Convert other errors to network errors
      if (error instanceof Error) {
        // Check for network-related errors
        if (
          error.name === 'TypeError' ||
          error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND')
        ) {
          throw RpcError.network(url, error)
        }
      }

      // Unknown error
      throw new RpcError('UNKNOWN', String(error), { url, method })
    }
  }

  /**
   * Sleep helper with exponential backoff
   */
  async function sleep(attempt: number): Promise<void> {
    const delay = retryDelay * RETRY_BACKOFF_MULTIPLIER ** attempt
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Make a JSON-RPC request with retry logic
   */
  async function request<TResult = unknown, TParams = unknown[]>(
    method: string,
    params: TParams,
    options?: JsonRpcRequestOptions
  ): Promise<TResult> {
    const requestTimeout = options?.timeout ?? timeout
    const retriesAllowed = options?.retries ?? maxRetries
    const headers = buildHeaders(options?.headers)

    let lastError: RpcError | undefined

    for (let attempt = 0; attempt <= retriesAllowed; attempt++) {
      try {
        return await executeRequest<TResult, TParams>(method, params, requestTimeout, headers)
      } catch (error) {
        if (!isRpcError(error)) {
          throw error
        }

        lastError = error

        // Check if we should retry
        const isLastAttempt = attempt === retriesAllowed
        if (isLastAttempt || !error.isRetryable()) {
          throw error
        }

        // Wait before retrying
        await sleep(attempt)
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError ?? new RpcError('UNKNOWN', 'Request failed', { url, method })
  }

  /**
   * Check if endpoint is available
   */
  async function isAvailable(): Promise<boolean> {
    try {
      // Most RPC endpoints support eth_chainId
      await request('eth_chainId', [], { retries: 0 })
      return true
    } catch {
      return false
    }
  }

  return {
    request,
    url,
    isAvailable,
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a bundler client
 */
export function createBundlerRpcClient(
  url: string,
  options?: Partial<JsonRpcClientConfig>
): JsonRpcClient {
  return createJsonRpcClient({
    url,
    timeout: options?.timeout ?? DEFAULT_RPC_TIMEOUT,
    maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelay: options?.retryDelay ?? DEFAULT_RETRY_DELAY,
    headers: options?.headers,
    apiKey: options?.apiKey,
  })
}

/**
 * Create a paymaster client
 */
export function createPaymasterRpcClient(
  url: string,
  apiKey?: string,
  options?: Partial<JsonRpcClientConfig>
): JsonRpcClient {
  return createJsonRpcClient({
    url,
    apiKey,
    timeout: options?.timeout ?? DEFAULT_RPC_TIMEOUT,
    maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelay: options?.retryDelay ?? DEFAULT_RETRY_DELAY,
    headers: options?.headers,
  })
}
