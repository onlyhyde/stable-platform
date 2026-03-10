/**
 * Chain Configuration
 *
 * Delegates to @stablenet/contracts for contract addresses, service URLs,
 * and token definitions. This module re-exports and wraps the contracts
 * package to provide a unified config API.
 */

import type {
  ChainAddresses,
  ChainConfig,
  ServiceUrls,
  TokenDefinition,
} from '@stablenet/contracts'
import {
  CHAIN_ADDRESSES,
  getChainAddresses as contractsGetChainAddresses,
  getChainConfig as contractsGetChainConfig,
  getDefaultTokens as contractsGetDefaultTokens,
  getServiceUrls as contractsGetServiceUrls,
  DEFAULT_TOKENS,
  isChainSupported,
  SERVICE_URLS,
  ZERO_ADDRESS,
} from '@stablenet/contracts'

/**
 * Re-export contract data from @stablenet/contracts (single source of truth)
 */
export { CHAIN_ADDRESSES, DEFAULT_TOKENS, SERVICE_URLS, ZERO_ADDRESS, isChainSupported }

/**
 * Re-export types for convenience
 */
export type { ChainAddresses, ChainConfig, ServiceUrls, TokenDefinition }

/**
 * Get chain configuration by chain ID
 * Delegates to @stablenet/contracts
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  try {
    return contractsGetChainConfig(chainId)
  } catch {
    return undefined
  }
}

/**
 * Get chain addresses by chain ID
 * Delegates to @stablenet/contracts
 */
export function getChainAddresses(chainId: number): ChainAddresses | undefined {
  try {
    return contractsGetChainAddresses(chainId)
  } catch {
    return undefined
  }
}

/**
 * Get service URLs by chain ID
 * Delegates to @stablenet/contracts
 */
export function getServiceUrls(chainId: number): ServiceUrls | undefined {
  try {
    return contractsGetServiceUrls(chainId)
  } catch {
    return undefined
  }
}

/**
 * Get tokens by chain ID
 */
export function getChainTokens(chainId: number): TokenDefinition[] {
  try {
    return contractsGetDefaultTokens(chainId)
  } catch {
    return []
  }
}
