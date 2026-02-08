/**
 * Contract address utilities and getters
 */

import type { Address } from 'viem'
import { CHAIN_ADDRESSES, DEFAULT_TOKENS, SERVICE_URLS } from './generated/addresses'
import type { ChainAddresses, ChainConfig, ServiceUrls, TokenDefinition } from './types'

// Re-export generated data
export { CHAIN_ADDRESSES, DEFAULT_TOKENS, SERVICE_URLS }

/**
 * Zero address constant for validation
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

/**
 * Check if an address is the zero address
 */
export function isZeroAddress(address: Address): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
}

/**
 * Validate that an address is not the zero address
 * @throws Error if address is zero address
 */
export function assertNotZeroAddress(address: Address, context?: string): void {
  if (isZeroAddress(address)) {
    const message = context
      ? `${context}: address cannot be zero address`
      : 'Address cannot be zero address'
    throw new Error(message)
  }
}

/**
 * Supported chain IDs
 */
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_ADDRESSES).map(Number) as number[]

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_ADDRESSES
}

/**
 * Get all contract addresses for a chain
 * @throws Error if chain is not supported
 */
export function getChainAddresses(chainId: number): ChainAddresses {
  const addresses = CHAIN_ADDRESSES[chainId]
  if (!addresses) {
    throw new Error(
      `Chain ${chainId} is not supported. Supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`
    )
  }
  return addresses
}

/**
 * Get service URLs for a chain
 * @throws Error if chain is not supported
 */
export function getServiceUrls(chainId: number): ServiceUrls {
  const urls = SERVICE_URLS[chainId]
  if (!urls) {
    throw new Error(`Service URLs for chain ${chainId} are not configured`)
  }
  return urls
}

/**
 * Get default tokens for a chain
 */
export function getDefaultTokens(chainId: number): TokenDefinition[] {
  return DEFAULT_TOKENS[chainId] ?? []
}

/**
 * Get complete chain configuration
 */
export function getChainConfig(chainId: number): ChainConfig {
  return {
    addresses: getChainAddresses(chainId),
    services: getServiceUrls(chainId),
    tokens: getDefaultTokens(chainId),
  }
}

/**
 * Get EntryPoint address for a chain
 */
export function getEntryPoint(chainId: number): Address {
  return getChainAddresses(chainId).core.entryPoint
}

/**
 * Get Kernel implementation address for a chain
 */
export function getKernel(chainId: number): Address {
  return getChainAddresses(chainId).core.kernel
}

/**
 * Get KernelFactory address for a chain
 */
export function getKernelFactory(chainId: number): Address {
  return getChainAddresses(chainId).core.kernelFactory
}

/**
 * Get VerifyingPaymaster address for a chain
 */
export function getVerifyingPaymaster(chainId: number): Address {
  return getChainAddresses(chainId).paymasters.verifyingPaymaster
}

/**
 * Get ECDSAValidator address for a chain
 */
export function getEcdsaValidator(chainId: number): Address {
  return getChainAddresses(chainId).validators.ecdsaValidator
}

/**
 * Get StealthAnnouncer address for a chain
 */
export function getStealthAnnouncer(chainId: number): Address {
  return getChainAddresses(chainId).privacy.stealthAnnouncer
}

/**
 * Get StealthRegistry address for a chain
 */
export function getStealthRegistry(chainId: number): Address {
  return getChainAddresses(chainId).privacy.stealthRegistry
}

/**
 * Get SubscriptionManager address for a chain
 */
export function getSubscriptionManager(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.subscriptionManager
}

/**
 * Get RecurringPaymentExecutor address for a chain
 */
export function getRecurringPaymentExecutor(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.recurringPaymentExecutor
}

/**
 * Get ERC7715 PermissionManager address for a chain
 */
export function getPermissionManager(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.permissionManager
}

/**
 * Get delegate presets for EIP-7702
 */
export function getDelegatePresets(chainId: number) {
  return getChainAddresses(chainId).delegatePresets
}

/**
 * Get default delegate preset for EIP-7702
 */
export function getDefaultDelegatePreset(chainId: number) {
  const presets = getDelegatePresets(chainId)
  return presets[0] ?? null
}

/**
 * Legacy compatibility exports
 * These match the old CONTRACT_ADDRESSES structure for gradual migration
 */
export function getLegacyContractAddresses(chainId: number) {
  const addresses = getChainAddresses(chainId)
  return {
    entryPoint: addresses.core.entryPoint,
    accountFactory: addresses.core.kernelFactory,
    paymaster: addresses.paymasters.verifyingPaymaster,
    stealthAnnouncer: addresses.privacy.stealthAnnouncer,
    stealthRegistry: addresses.privacy.stealthRegistry,
  }
}
