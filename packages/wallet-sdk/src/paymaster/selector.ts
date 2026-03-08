/**
 * PaymasterSelector - Multi-paymaster selection with priority-based fallback
 *
 * EIP-4337 Paymaster Guide recommends supporting multiple paymaster services
 * for reliability and cost optimization. This module provides:
 * - Priority-ordered paymaster list
 * - Health-check based selection
 * - Automatic fallback on failure
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */

import type { Address, Hex } from 'viem'
import {
  type PaymasterDataResponse,
  type PaymasterStubDataResponse,
  type PaymasterUserOpContext,
  getPaymasterData,
  getPaymasterStubData,
} from './index'

// ============================================================================
// Types
// ============================================================================

/**
 * Individual paymaster endpoint configuration
 */
export interface PaymasterEndpoint {
  /** Paymaster service URL */
  url: string
  /** Display name for logging */
  name?: string
  /** Priority (lower = higher priority, default: 0) */
  priority?: number
  /** Request timeout in ms (default: 10000) */
  timeout?: number
}

/**
 * PaymasterSelector configuration
 */
export interface PaymasterSelectorConfig {
  /** Paymaster endpoints (tried in priority order) */
  endpoints: PaymasterEndpoint[]
  /** Health check interval in ms (default: 30000) */
  healthCheckInterval?: number
}

/**
 * Result of a paymaster selection attempt
 */
export interface PaymasterSelectionResult<T> {
  /** The paymaster endpoint that succeeded */
  endpoint: PaymasterEndpoint
  /** The response data */
  data: T
}

// ============================================================================
// PaymasterSelector
// ============================================================================

/**
 * Selects and manages multiple paymaster services with fallback.
 *
 * @example
 * ```ts
 * const selector = createPaymasterSelector({
 *   endpoints: [
 *     { url: 'https://paymaster-a.example.com', name: 'Primary', priority: 0 },
 *     { url: 'https://paymaster-b.example.com', name: 'Backup', priority: 1 },
 *   ],
 * })
 *
 * // Tries Primary first, falls back to Backup on failure
 * const stub = await selector.getStubData(userOp, entryPoint, chainId)
 * ```
 */
export interface PaymasterSelector {
  /** Get stub data for gas estimation, trying endpoints in priority order */
  getStubData(
    userOp: PaymasterUserOpContext,
    entryPoint: Address,
    chainId: Hex
  ): Promise<PaymasterSelectionResult<PaymasterStubDataResponse>>

  /** Get final paymaster data, trying endpoints in priority order */
  getData(
    userOp: PaymasterUserOpContext,
    entryPoint: Address,
    chainId: Hex
  ): Promise<PaymasterSelectionResult<PaymasterDataResponse>>

  /** Get stub data from a specific endpoint (for pinning after selection) */
  getStubDataFrom(
    endpoint: PaymasterEndpoint,
    userOp: PaymasterUserOpContext,
    entryPoint: Address,
    chainId: Hex
  ): Promise<PaymasterStubDataResponse>

  /** Get final data from a specific endpoint (for pinning after selection) */
  getDataFrom(
    endpoint: PaymasterEndpoint,
    userOp: PaymasterUserOpContext,
    entryPoint: Address,
    chainId: Hex
  ): Promise<PaymasterDataResponse>

  /** Mark an endpoint as unhealthy (will be skipped until health check passes) */
  markUnhealthy(url: string): void

  /** Get sorted list of healthy endpoints */
  getHealthyEndpoints(): PaymasterEndpoint[]
}

/**
 * Create a PaymasterSelector from a single URL (backward compatible)
 */
export function createPaymasterSelectorFromUrl(url: string): PaymasterSelector {
  return createPaymasterSelector({
    endpoints: [{ url, name: 'default', priority: 0 }],
  })
}

/**
 * Create a PaymasterSelector with multiple endpoints
 */
export function createPaymasterSelector(
  config: PaymasterSelectorConfig
): PaymasterSelector {
  const { endpoints, healthCheckInterval = 30_000 } = config
  const unhealthyUntil = new Map<string, number>()

  // Sort endpoints by priority (ascending)
  const sorted = [...endpoints].sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
  )

  function getHealthyEndpoints(): PaymasterEndpoint[] {
    const now = Date.now()
    return sorted.filter((ep) => {
      const until = unhealthyUntil.get(ep.url)
      if (until && now < until) return false
      // Expired cooldown — remove entry
      if (until) unhealthyUntil.delete(ep.url)
      return true
    })
  }

  function markUnhealthy(url: string): void {
    unhealthyUntil.set(url, Date.now() + healthCheckInterval)
  }

  async function tryEndpoints<T>(
    fn: (endpoint: PaymasterEndpoint) => Promise<T>
  ): Promise<PaymasterSelectionResult<T>> {
    const healthy = getHealthyEndpoints()
    if (healthy.length === 0) {
      throw new PaymasterSelectorError(
        'All paymaster endpoints are unhealthy',
        sorted.map((ep) => ep.url)
      )
    }

    const errors: Array<{ url: string; error: unknown }> = []

    for (const endpoint of healthy) {
      try {
        const data = await fn(endpoint)
        return { endpoint, data }
      } catch (err) {
        markUnhealthy(endpoint.url)
        errors.push({ url: endpoint.url, error: err })
      }
    }

    throw new PaymasterSelectorError(
      `All paymaster endpoints failed: ${errors.map((e) => `${e.url}: ${e.error instanceof Error ? e.error.message : String(e.error)}`).join('; ')}`,
      errors.map((e) => e.url)
    )
  }

  return {
    getStubData(userOp, entryPoint, chainId) {
      return tryEndpoints((ep) =>
        getPaymasterStubData(ep.url, userOp, entryPoint, chainId)
      )
    },

    getData(userOp, entryPoint, chainId) {
      return tryEndpoints((ep) =>
        getPaymasterData(ep.url, userOp, entryPoint, chainId)
      )
    },

    getStubDataFrom(endpoint, userOp, entryPoint, chainId) {
      return getPaymasterStubData(endpoint.url, userOp, entryPoint, chainId)
    },

    getDataFrom(endpoint, userOp, entryPoint, chainId) {
      return getPaymasterData(endpoint.url, userOp, entryPoint, chainId)
    },

    markUnhealthy,
    getHealthyEndpoints,
  }
}

// ============================================================================
// Error
// ============================================================================

export class PaymasterSelectorError extends Error {
  readonly failedUrls: string[]

  constructor(message: string, failedUrls: string[]) {
    super(message)
    this.name = 'PaymasterSelectorError'
    this.failedUrls = failedUrls
  }
}
