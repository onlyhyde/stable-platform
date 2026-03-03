/**
 * Contract address utilities and getters
 */

import type { Address } from 'viem'
import { CHAIN_ADDRESSES, DEFAULT_TOKENS, SERVICE_URLS } from './generated/addresses'
import {
  CHAIN_PRECOMPILES,
  PRECOMPILED_ADDRESSES,
  SYSTEM_CONTRACTS,
  SYSTEM_PRECOMPILES,
  NATIVE_COIN_ADAPTER_ADDRESS,
  GOV_VALIDATOR_ADDRESS,
  GOV_MASTER_MINTER_ADDRESS,
  GOV_MINTER_ADDRESS,
  GOV_COUNCIL_ADDRESS,
  BLS_POP_PRECOMPILE_ADDRESS,
  NATIVE_COIN_MANAGER_ADDRESS,
  ACCOUNT_MANAGER_ADDRESS,
} from './precompiles'
import type {
  ChainAddresses,
  ChainConfig,
  PrecompiledAddresses,
  ServiceUrls,
  TokenDefinition,
} from './types'

// Merge precompiles into CHAIN_ADDRESSES for chains that have them
for (const [chainId, precompiles] of Object.entries(CHAIN_PRECOMPILES)) {
  const chain = CHAIN_ADDRESSES[Number(chainId)]
  if (chain) {
    chain.precompiles = precompiles
  }
}

// Re-export generated data
export { CHAIN_ADDRESSES, DEFAULT_TOKENS, SERVICE_URLS }

// Re-export precompile constants
export {
  CHAIN_PRECOMPILES,
  PRECOMPILED_ADDRESSES,
  SYSTEM_CONTRACTS,
  SYSTEM_PRECOMPILES,
  NATIVE_COIN_ADAPTER_ADDRESS,
  GOV_VALIDATOR_ADDRESS,
  GOV_MASTER_MINTER_ADDRESS,
  GOV_MINTER_ADDRESS,
  GOV_COUNCIL_ADDRESS,
  BLS_POP_PRECOMPILE_ADDRESS,
  NATIVE_COIN_MANAGER_ADDRESS,
  ACCOUNT_MANAGER_ADDRESS,
}

/**
 * Zero address constant for validation
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// ─── Canonical Addresses (same on all production EVM chains via CREATE2) ─────
// These are used as SDK defaults for chains without local deployment data.
// Per-chain deployed addresses live in `generated/addresses.ts` (CHAIN_ADDRESSES).
// Use `getEntryPoint(chainId)` to get the correct address for a given chain —
// it returns the chain-specific address when available, or falls back to the
// canonical address below.

/** Canonical EntryPoint address (ERC-4337 v0.9) */
export const ENTRY_POINT_ADDRESS: Address = '0xEf6817fe73741A8F10088f9511c64b666a338A14'

/** @deprecated Use ENTRY_POINT_ADDRESS instead. */
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

// ─── Precompiles (chain 8283 only) ──────────────────────────────────────────

export function getPrecompiles(chainId: number): PrecompiledAddresses | undefined {
  return CHAIN_PRECOMPILES[chainId]
}

export function getNativeCoinAdapter(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemContracts.nativeCoinAdapter
}

export function getGovValidator(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemContracts.govValidator
}

export function getGovMasterMinter(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemContracts.govMasterMinter
}

export function getGovMinter(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemContracts.govMinter
}

export function getGovCouncil(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemContracts.govCouncil
}

export function getBlsPopPrecompile(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemPrecompiles.blsPopPrecompile
}

export function getNativeCoinManager(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemPrecompiles.nativeCoinManager
}

export function getAccountManager(chainId: number): Address {
  const p = getPrecompiles(chainId)
  if (!p) throw new Error(`Chain ${chainId} has no precompiled contracts`)
  return p.systemPrecompiles.accountManager
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
