import type { Address } from 'viem'
import type { ChainAddresses, ChainConfig, ServiceUrls, TokenDefinition } from '@stablenet/types'
import { ENTRY_POINT_V07 } from './entryPoints'
import { getAnvilConfig, getSepoliaConfig } from './env'

/**
 * Chain Configuration
 * Contract addresses and service URLs per chain
 */

/**
 * Zero address placeholder for undeployed contracts
 */
const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

/**
 * Anvil local testnet addresses
 * These are deployed via local scripts during development
 */
export const ANVIL_ADDRESSES: ChainAddresses = {
  chainId: 31337,
  core: {
    entryPoint: ENTRY_POINT_V07,
    kernel: ZERO_ADDRESS, // Deploy locally
    kernelFactory: ZERO_ADDRESS, // Deploy locally
  },
  validators: {
    ecdsaValidator: ZERO_ADDRESS,
    webAuthnValidator: ZERO_ADDRESS,
    multiEcdsaValidator: ZERO_ADDRESS,
  },
  executors: {
    ownableExecutor: ZERO_ADDRESS,
  },
  hooks: {
    spendingLimitHook: ZERO_ADDRESS,
  },
  paymasters: {
    verifyingPaymaster: ZERO_ADDRESS,
    tokenPaymaster: ZERO_ADDRESS,
  },
  privacy: {
    stealthAnnouncer: ZERO_ADDRESS,
    stealthRegistry: ZERO_ADDRESS,
  },
  compliance: {
    kycRegistry: ZERO_ADDRESS,
    complianceValidator: ZERO_ADDRESS,
  },
  delegatePresets: [],
}

/**
 * Get Anvil service URLs (with environment overrides)
 */
export function getAnvilServices(): ServiceUrls {
  const config = getAnvilConfig()
  return {
    bundler: config.bundlerUrl,
    paymaster: config.paymasterUrl,
    stealthServer: config.stealthServerUrl,
  }
}

/**
 * Anvil service URLs (for backward compatibility)
 * Configurable via:
 * - STABLENET_ANVIL_BUNDLER_URL
 * - STABLENET_ANVIL_PAYMASTER_URL
 * - STABLENET_ANVIL_STEALTH_SERVER_URL
 */
export const ANVIL_SERVICES: ServiceUrls = getAnvilServices()

/**
 * Anvil tokens (for testing)
 */
export const ANVIL_TOKENS: TokenDefinition[] = []

/**
 * Sepolia testnet addresses
 */
export const SEPOLIA_ADDRESSES: ChainAddresses = {
  chainId: 11155111,
  core: {
    entryPoint: ENTRY_POINT_V07,
    kernel: ZERO_ADDRESS, // To be deployed
    kernelFactory: ZERO_ADDRESS, // To be deployed
  },
  validators: {
    ecdsaValidator: ZERO_ADDRESS,
    webAuthnValidator: ZERO_ADDRESS,
    multiEcdsaValidator: ZERO_ADDRESS,
  },
  executors: {
    ownableExecutor: ZERO_ADDRESS,
  },
  hooks: {
    spendingLimitHook: ZERO_ADDRESS,
  },
  paymasters: {
    verifyingPaymaster: ZERO_ADDRESS,
    tokenPaymaster: ZERO_ADDRESS,
  },
  privacy: {
    stealthAnnouncer: ZERO_ADDRESS,
    stealthRegistry: ZERO_ADDRESS,
  },
  compliance: {
    kycRegistry: ZERO_ADDRESS,
    complianceValidator: ZERO_ADDRESS,
  },
  delegatePresets: [],
}

/**
 * Get Sepolia service URLs (with environment overrides)
 */
export function getSepoliaServices(): ServiceUrls {
  const config = getSepoliaConfig()
  return {
    bundler: config.bundlerUrl,
    paymaster: config.paymasterUrl,
    stealthServer: config.stealthServerUrl,
  }
}

/**
 * Sepolia service URLs (for backward compatibility)
 * Configurable via:
 * - STABLENET_SEPOLIA_BUNDLER_URL
 * - STABLENET_SEPOLIA_PAYMASTER_URL
 * - STABLENET_SEPOLIA_STEALTH_SERVER_URL
 */
export const SEPOLIA_SERVICES: ServiceUrls = getSepoliaServices()

/**
 * Sepolia tokens
 */
export const SEPOLIA_TOKENS: TokenDefinition[] = [
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address, // USDC on Sepolia
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    chainId: 11155111,
  },
]

/**
 * Complete chain configurations by chain ID
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  31337: {
    addresses: ANVIL_ADDRESSES,
    services: ANVIL_SERVICES,
    tokens: ANVIL_TOKENS,
  },
  11155111: {
    addresses: SEPOLIA_ADDRESSES,
    services: SEPOLIA_SERVICES,
    tokens: SEPOLIA_TOKENS,
  },
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId]
}

/**
 * Get chain addresses by chain ID
 */
export function getChainAddresses(chainId: number): ChainAddresses | undefined {
  return CHAIN_CONFIGS[chainId]?.addresses
}

/**
 * Get service URLs by chain ID
 */
export function getServiceUrls(chainId: number): ServiceUrls | undefined {
  return CHAIN_CONFIGS[chainId]?.services
}

/**
 * Get tokens by chain ID
 */
export function getChainTokens(chainId: number): TokenDefinition[] {
  return CHAIN_CONFIGS[chainId]?.tokens ?? []
}
