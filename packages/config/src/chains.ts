import type { ChainAddresses, ChainConfig, ServiceUrls, TokenDefinition } from '@stablenet/types'
import type { Address } from 'viem'
import { ENTRY_POINT_V07 } from './entryPoints'
import { getAnvilConfig, getLocalConfig, getSepoliaConfig } from './env'

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
 * StableNet Local addresses (Chain ID 8283)
 * These are deployed on the StableNet Local chain during development
 */
export const LOCAL_ADDRESSES: ChainAddresses = {
  chainId: 8283,
  core: {
    entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
    kernel: '0xa61b944dd427a85495b685d93237cb73087e0035' as Address,
    kernelFactory: '0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3' as Address,
  },
  validators: {
    ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
    webAuthnValidator: '0x169844994bd5b64c3a264c54d6b0863bb7df0487' as Address,
    multiEcdsaValidator: '0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5' as Address,
  },
  executors: {
    ownableExecutor: '0x621b0872c00f6328bd9001a121af09dd18b193e0' as Address,
  },
  hooks: {
    spendingLimitHook: '0x304cb9f3725e8b807c2fe951c8db7fea4176f1c5' as Address,
  },
  paymasters: {
    verifyingPaymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
    tokenPaymaster: '0xaf420bfe67697a5724235e4676136f264023d099' as Address,
  },
  privacy: {
    stealthAnnouncer: '0x7706eeaacd036c8c981147991913419e3fc33abc' as Address,
    stealthRegistry: '0xfb8b3fce6fd358b6f13a05a216bdc1deb46c7cd9' as Address,
  },
  compliance: {
    kycRegistry: '0xcb23f218447bebb4e0244b40fba5ae0d0e749649' as Address,
    complianceValidator: '0xce4959e3a3d4ae3a92d6c9b6b4c570b4ff501346' as Address,
  },
  delegatePresets: [],
}

/**
 * Get StableNet Local service URLs (with environment overrides)
 */
export function getLocalServices(): ServiceUrls {
  const config = getLocalConfig()
  return {
    bundler: config.bundlerUrl,
    paymaster: config.paymasterUrl,
    stealthServer: config.stealthServerUrl,
  }
}

/**
 * StableNet Local service URLs (for backward compatibility)
 * Configurable via:
 * - STABLENET_LOCAL_BUNDLER_URL
 * - STABLENET_LOCAL_PAYMASTER_URL
 * - STABLENET_LOCAL_STEALTH_SERVER_URL
 */
export const LOCAL_SERVICES: ServiceUrls = getLocalServices()

/**
 * StableNet Local tokens
 */
export const LOCAL_TOKENS: TokenDefinition[] = []

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
  8283: {
    addresses: LOCAL_ADDRESSES,
    services: LOCAL_SERVICES,
    tokens: LOCAL_TOKENS,
  },
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
