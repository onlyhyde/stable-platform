import type { Address } from 'viem'
import {
  getDevnetConfig,
  getTestnetConfig,
  getAppConfig as getAppConfigFromEnv,
  getContractAddresses as getContractAddressesFromEnv,
  getServiceUrls as getServiceUrlsFromEnv,
} from './config'

/**
 * Contract addresses type
 */
export type ContractAddresses = {
  entryPoint: Address
  accountFactory: Address
  paymaster: Address
  stealthAnnouncer: Address
  stealthRegistry: Address
}

/**
 * Service URLs type
 */
export type ServiceUrls = {
  bundler: string
  paymaster: string
  stealthServer: string
}

/**
 * Get contract addresses for a chain (with environment override support)
 */
export function getContractAddresses(chainId: number): ContractAddresses | undefined {
  const addresses = getContractAddressesFromEnv(chainId)
  if (addresses) {
    return addresses as ContractAddresses
  }
  return undefined
}

/**
 * Get service URLs for a chain (with environment override support)
 */
export function getServiceUrls(chainId: number): ServiceUrls | undefined {
  const urls = getServiceUrlsFromEnv(chainId)
  if (urls) {
    return urls as ServiceUrls
  }
  return undefined
}

/**
 * Contract addresses by chain ID
 * @deprecated Use getContractAddresses(chainId) instead for environment override support
 */
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Devnet
  31337: getDevnetConfig().contracts,
  // Testnet
  11155111: getTestnetConfig().contracts,
}

/**
 * Service URLs by chain ID
 * @deprecated Use getServiceUrls(chainId) instead for environment override support
 */
export const SERVICE_URLS: Record<number, ServiceUrls> = {
  31337: {
    bundler: getDevnetConfig().bundlerUrl,
    paymaster: getDevnetConfig().paymasterUrl,
    stealthServer: getDevnetConfig().stealthServerUrl,
  },
  11155111: {
    bundler: getTestnetConfig().bundlerUrl,
    paymaster: getTestnetConfig().paymasterUrl,
    stealthServer: getTestnetConfig().stealthServerUrl,
  },
}

/**
 * Default tokens by chain
 */
export const DEFAULT_TOKENS: Record<number, Array<{
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
}>> = {
  31337: [
    {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    {
      address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    },
    {
      address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
    },
  ],
  11155111: [
    {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  ],
}

/**
 * Get app configuration (with environment override support)
 */
export function getAppConfigValue() {
  return getAppConfigFromEnv()
}

/**
 * App configuration
 * @deprecated Use getAppConfigValue() instead for environment override support
 */
export const APP_CONFIG = getAppConfigFromEnv()
