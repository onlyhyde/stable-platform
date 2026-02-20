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

// ─── Canonical Addresses (same on all production EVM chains via CREATE2) ─────
// These are used as SDK defaults for chains without local deployment data.

/** Canonical EntryPoint v0.7 (ERC-4337) */
export const ENTRY_POINT_V07_ADDRESS: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

/** Canonical Kernel v3.1 Factory (ZeroDev) */
export const KERNEL_V3_1_FACTORY_ADDRESS: Address = '0x6723b44Abeec4E71eBE3232BD5B455805baDD22f'

/** Canonical ECDSA Validator (ZeroDev) */
export const ECDSA_VALIDATOR_ADDRESS: Address = '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390'

/** Canonical Kernel implementation addresses */
export const KERNEL_ADDRESSES = {
  KERNEL_V3_1: '0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27' as Address,
  KERNEL_V3_0: '0xd3082872F8B06073A021b4602e022d5A070d7cfC' as Address,
} as const

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
 * Get a contract address by its raw key name
 * Useful for dynamic access when you know the key from addresses.json
 */
export function getContractAddress(chainId: number, key: string): Address {
  const addresses = getChainAddresses(chainId)
  return (addresses.raw[key] as Address) ?? ZERO_ADDRESS
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

// ─── Core ────────────────────────────────────────────────────────────────────

export function getEntryPoint(chainId: number): Address {
  return getChainAddresses(chainId).core.entryPoint
}

export function getKernel(chainId: number): Address {
  return getChainAddresses(chainId).core.kernel
}

export function getKernelFactory(chainId: number): Address {
  return getChainAddresses(chainId).core.kernelFactory
}

export function getFactoryStaker(chainId: number): Address {
  return getChainAddresses(chainId).core.factoryStaker
}

// ─── Validators ──────────────────────────────────────────────────────────────

export function getEcdsaValidator(chainId: number): Address {
  return getChainAddresses(chainId).validators.ecdsaValidator
}

export function getWebAuthnValidator(chainId: number): Address {
  return getChainAddresses(chainId).validators.webAuthnValidator
}

export function getMultiChainValidator(chainId: number): Address {
  return getChainAddresses(chainId).validators.multiChainValidator
}

export function getMultiSigValidator(chainId: number): Address {
  return getChainAddresses(chainId).validators.multiSigValidator
}

// ─── Paymasters ──────────────────────────────────────────────────────────────

export function getVerifyingPaymaster(chainId: number): Address {
  return getChainAddresses(chainId).paymasters.verifyingPaymaster
}

export function getErc20Paymaster(chainId: number): Address {
  return getChainAddresses(chainId).paymasters.erc20Paymaster
}

export function getSponsorPaymaster(chainId: number): Address {
  return getChainAddresses(chainId).paymasters.sponsorPaymaster
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export function getStealthAnnouncer(chainId: number): Address {
  return getChainAddresses(chainId).privacy.stealthAnnouncer
}

export function getStealthRegistry(chainId: number): Address {
  return getChainAddresses(chainId).privacy.stealthRegistry
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function getSubscriptionManager(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.subscriptionManager
}

export function getRecurringPaymentExecutor(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.recurringPaymentExecutor
}

export function getPermissionManager(chainId: number): Address {
  return getChainAddresses(chainId).subscriptions.permissionManager
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

export function getWkrc(chainId: number): Address {
  return getChainAddresses(chainId).tokens.wkrc
}

export function getUsdc(chainId: number): Address {
  return getChainAddresses(chainId).tokens.usdc
}

// ─── DeFi ────────────────────────────────────────────────────────────────────

export function getLendingPool(chainId: number): Address {
  return getChainAddresses(chainId).defi.lendingPool
}

export function getStakingVault(chainId: number): Address {
  return getChainAddresses(chainId).defi.stakingVault
}

export function getPriceOracle(chainId: number): Address {
  return getChainAddresses(chainId).defi.priceOracle
}

// ─── Uniswap ─────────────────────────────────────────────────────────────────

export function getUniswapFactory(chainId: number): Address {
  return getChainAddresses(chainId).uniswap.factory
}

export function getUniswapRouter(chainId: number): Address {
  return getChainAddresses(chainId).uniswap.swapRouter
}

export function getUniswapQuoter(chainId: number): Address {
  return getChainAddresses(chainId).uniswap.quoter
}

// ─── Delegate Presets ────────────────────────────────────────────────────────

export function getDelegatePresets(chainId: number) {
  return getChainAddresses(chainId).delegatePresets
}

export function getDefaultDelegatePreset(chainId: number) {
  const presets = getDelegatePresets(chainId)
  return presets[0] ?? null
}

// ─── Legacy compatibility ────────────────────────────────────────────────────

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
