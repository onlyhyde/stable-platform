import type { Address } from 'viem'
import {
  getAppConfig as getAppConfigFromEnv,
  getContractAddresses as getContractAddressesFromEnv,
  getDevnetConfig,
  getLocalConfig,
  getServiceUrls as getServiceUrlsFromEnv,
  getTestnetConfig,
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
  indexer: string
  orderRouter: string
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
  // Anvil (Local)
  31337: getDevnetConfig().contracts,
  // StableNet Local
  8283: getLocalConfig().contracts,
  // StableNet Testnet
  82830: getTestnetConfig().contracts,
  // Sepolia (legacy)
  11155111: getTestnetConfig().contracts,
}

/**
 * Service URLs by chain ID
 * @deprecated Use getServiceUrls(chainId) instead for environment override support
 */
export const SERVICE_URLS: Record<number, ServiceUrls> = {
  // Anvil (Local)
  31337: {
    bundler: getDevnetConfig().bundlerUrl,
    paymaster: getDevnetConfig().paymasterUrl,
    stealthServer: getDevnetConfig().stealthServerUrl,
    indexer: getDevnetConfig().indexerUrl,
    orderRouter: getDevnetConfig().orderRouterUrl,
  },
  // StableNet Local - uses user's custom RPC settings if set
  8283: {
    bundler: getLocalConfig().bundlerUrl,
    paymaster: getLocalConfig().paymasterUrl,
    stealthServer: getLocalConfig().stealthServerUrl,
    indexer: getLocalConfig().indexerUrl,
    orderRouter: getLocalConfig().orderRouterUrl,
  },
  // StableNet Testnet - uses user's custom RPC settings if set
  82830: {
    bundler: getTestnetConfig().bundlerUrl,
    paymaster: getTestnetConfig().paymasterUrl,
    stealthServer: getTestnetConfig().stealthServerUrl,
    indexer: getTestnetConfig().indexerUrl,
    orderRouter: getTestnetConfig().orderRouterUrl,
  },
  // Sepolia (legacy)
  11155111: {
    bundler: getTestnetConfig().bundlerUrl,
    paymaster: getTestnetConfig().paymasterUrl,
    stealthServer: getTestnetConfig().stealthServerUrl,
    indexer: getTestnetConfig().indexerUrl,
    orderRouter: getTestnetConfig().orderRouterUrl,
  },
}

/**
 * Default tokens by chain
 */
export const DEFAULT_TOKENS: Record<
  number,
  Array<{
    address: Address
    name: string
    symbol: string
    decimals: number
    logoUrl?: string
  }>
> = {
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
