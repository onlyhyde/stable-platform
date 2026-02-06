/**
 * Web App Environment Configuration
 *
 * Environment variables for the Next.js web application.
 * All client-side variables must be prefixed with NEXT_PUBLIC_
 *
 * Priority order for RPC/Bundler/Paymaster URLs:
 * 1. User settings from localStorage (Settings page)
 * 2. Environment variables
 * 3. Default values
 *
 * Usage:
 * - Set in .env.local for local development
 * - Set in deployment environment for production
 * - Override via Settings > Network > RPC Configuration
 */

import { getRpcSettings } from '../utils'

/**
 * Environment variable names
 */
export const WEB_ENV_VARS = {
  // Local Service URLs
  LOCAL_RPC_URL: 'NEXT_PUBLIC_LOCAL_RPC_URL',
  LOCAL_BUNDLER_URL: 'NEXT_PUBLIC_LOCAL_BUNDLER_URL',
  LOCAL_PAYMASTER_URL: 'NEXT_PUBLIC_LOCAL_PAYMASTER_URL',
  LOCAL_STEALTH_SERVER_URL: 'NEXT_PUBLIC_LOCAL_STEALTH_SERVER_URL',
  LOCAL_EXPLORER_URL: 'NEXT_PUBLIC_LOCAL_EXPLORER_URL',
  LOCAL_INDEXER_URL: 'NEXT_PUBLIC_LOCAL_INDEXER_URL',

  // Testnet Service URLs
  TESTNET_RPC_URL: 'NEXT_PUBLIC_TESTNET_RPC_URL',
  TESTNET_BUNDLER_URL: 'NEXT_PUBLIC_TESTNET_BUNDLER_URL',
  TESTNET_PAYMASTER_URL: 'NEXT_PUBLIC_TESTNET_PAYMASTER_URL',
  TESTNET_STEALTH_SERVER_URL: 'NEXT_PUBLIC_TESTNET_STEALTH_SERVER_URL',
  TESTNET_EXPLORER_URL: 'NEXT_PUBLIC_TESTNET_EXPLORER_URL',
  TESTNET_INDEXER_URL: 'NEXT_PUBLIC_TESTNET_INDEXER_URL',

  // Contract Addresses (Local)
  LOCAL_ENTRY_POINT: 'NEXT_PUBLIC_LOCAL_ENTRY_POINT',
  LOCAL_ACCOUNT_FACTORY: 'NEXT_PUBLIC_LOCAL_ACCOUNT_FACTORY',
  LOCAL_PAYMASTER: 'NEXT_PUBLIC_LOCAL_PAYMASTER',
  LOCAL_STEALTH_ANNOUNCER: 'NEXT_PUBLIC_LOCAL_STEALTH_ANNOUNCER',
  LOCAL_STEALTH_REGISTRY: 'NEXT_PUBLIC_LOCAL_STEALTH_REGISTRY',
  LOCAL_SESSION_KEY_MANAGER: 'NEXT_PUBLIC_LOCAL_SESSION_KEY_MANAGER',
  LOCAL_SUBSCRIPTION_MANAGER: 'NEXT_PUBLIC_LOCAL_SUBSCRIPTION_MANAGER',
  LOCAL_RECURRING_PAYMENT_MANAGER: 'NEXT_PUBLIC_LOCAL_RECURRING_PAYMENT_MANAGER',
  LOCAL_PERMISSION_MANAGER: 'NEXT_PUBLIC_LOCAL_PERMISSION_MANAGER',

  // Contract Addresses (Testnet)
  TESTNET_ENTRY_POINT: 'NEXT_PUBLIC_TESTNET_ENTRY_POINT',
  TESTNET_ACCOUNT_FACTORY: 'NEXT_PUBLIC_TESTNET_ACCOUNT_FACTORY',
  TESTNET_PAYMASTER: 'NEXT_PUBLIC_TESTNET_PAYMASTER',
  TESTNET_STEALTH_ANNOUNCER: 'NEXT_PUBLIC_TESTNET_STEALTH_ANNOUNCER',
  TESTNET_STEALTH_REGISTRY: 'NEXT_PUBLIC_TESTNET_STEALTH_REGISTRY',
  TESTNET_SESSION_KEY_MANAGER: 'NEXT_PUBLIC_TESTNET_SESSION_KEY_MANAGER',
  TESTNET_SUBSCRIPTION_MANAGER: 'NEXT_PUBLIC_TESTNET_SUBSCRIPTION_MANAGER',
  TESTNET_RECURRING_PAYMENT_MANAGER: 'NEXT_PUBLIC_TESTNET_RECURRING_PAYMENT_MANAGER',
  TESTNET_PERMISSION_MANAGER: 'NEXT_PUBLIC_TESTNET_PERMISSION_MANAGER',

  // App Configuration
  DEFAULT_SLIPPAGE: 'NEXT_PUBLIC_DEFAULT_SLIPPAGE',
  MAX_SLIPPAGE: 'NEXT_PUBLIC_MAX_SLIPPAGE',
  TX_TIMEOUT: 'NEXT_PUBLIC_TX_TIMEOUT',
  DEFAULT_CHAIN_ID: 'NEXT_PUBLIC_DEFAULT_CHAIN_ID',
} as const

/**
 * Default values
 */
const DEFAULTS = {
  // Local Service URLs (StableNet Local - chainId 8283)
  LOCAL_RPC_URL: 'http://127.0.0.1:8501',
  LOCAL_BUNDLER_URL: 'http://127.0.0.1:4337',
  LOCAL_PAYMASTER_URL: 'http://127.0.0.1:4338',
  LOCAL_STEALTH_SERVER_URL: 'http://127.0.0.1:4339',
  LOCAL_EXPLORER_URL: 'http://127.0.0.1:3001',
  LOCAL_INDEXER_URL: 'http://127.0.0.1:8080/api',

  // Testnet Service URLs (StableNet Testnet - chainId 82830)
  TESTNET_RPC_URL: 'https://rpc.testnet.stablenet.dev',
  TESTNET_BUNDLER_URL: 'https://bundler.testnet.stablenet.dev',
  TESTNET_PAYMASTER_URL: 'https://paymaster.testnet.stablenet.dev',
  TESTNET_STEALTH_SERVER_URL: 'https://stealth.testnet.stablenet.dev',
  TESTNET_EXPLORER_URL: 'https://explorer.testnet.stablenet.dev',
  TESTNET_INDEXER_URL: 'https://indexer.testnet.stablenet.dev/api',

  // Contract Addresses (Local)
  LOCAL_ENTRY_POINT: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  LOCAL_ACCOUNT_FACTORY: '0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c',
  LOCAL_PAYMASTER: '0x2dd78fd9b8f40659af32ef98555b8b31bc97a351',
  LOCAL_STEALTH_ANNOUNCER: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
  LOCAL_STEALTH_REGISTRY: '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4',
  LOCAL_SESSION_KEY_MANAGER: '0x4a679253410272dd5232B3Ff7cF5dbB88f295319',
  LOCAL_SUBSCRIPTION_MANAGER: '0x9d4454B023096f34B160D6B654540c56A1F81688',
  LOCAL_RECURRING_PAYMENT_MANAGER: '0x5678901234567890123456789012345678901234',
  LOCAL_PERMISSION_MANAGER: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',

  // Contract Addresses (Testnet - ERC-4337 v0.7)
  TESTNET_ENTRY_POINT: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  TESTNET_ACCOUNT_FACTORY: '0x0000000000000000000000000000000000000000',
  TESTNET_PAYMASTER: '0x0000000000000000000000000000000000000000',
  TESTNET_STEALTH_ANNOUNCER: '0x0000000000000000000000000000000000000000',
  TESTNET_STEALTH_REGISTRY: '0x0000000000000000000000000000000000000000',
  TESTNET_SESSION_KEY_MANAGER: '0x0000000000000000000000000000000000000000',
  TESTNET_SUBSCRIPTION_MANAGER: '0x0000000000000000000000000000000000000000',
  TESTNET_RECURRING_PAYMENT_MANAGER: '0x0000000000000000000000000000000000000000',
  TESTNET_PERMISSION_MANAGER: '0x0000000000000000000000000000000000000000',

  // App Configuration
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MAX_SLIPPAGE: 50, // 50%
  TX_TIMEOUT: 60000, // 60 seconds
  DEFAULT_CHAIN_ID: 8283, // StableNet Local
} as const

/**
 * Get environment variable with fallback (browser-safe)
 */
function getEnvString(name: string, defaultValue: string): string {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env[name] ?? defaultValue
  }
  // Client-side (Next.js inlines NEXT_PUBLIC_ vars at build time)
  const value = (process.env as Record<string, string | undefined>)[name]
  return value ?? defaultValue
}

/**
 * Get environment variable as number
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const value = getEnvString(name, String(defaultValue))
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * Get user's custom RPC settings from localStorage (if any)
 * Returns null on server-side or if no settings saved
 */
function getUserRpcSettings() {
  return getRpcSettings()
}

/**
 * Get Local configuration (StableNet Local - chainId 8283)
 * User settings from Settings page take priority over env vars and defaults
 */
export function getLocalConfig() {
  const userSettings = getUserRpcSettings()

  return {
    // User settings > Environment variables > Defaults
    rpcUrl:
      userSettings?.rpcUrl || getEnvString(WEB_ENV_VARS.LOCAL_RPC_URL, DEFAULTS.LOCAL_RPC_URL),
    bundlerUrl:
      userSettings?.bundlerUrl ||
      getEnvString(WEB_ENV_VARS.LOCAL_BUNDLER_URL, DEFAULTS.LOCAL_BUNDLER_URL),
    paymasterUrl:
      userSettings?.paymasterUrl ||
      getEnvString(WEB_ENV_VARS.LOCAL_PAYMASTER_URL, DEFAULTS.LOCAL_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      WEB_ENV_VARS.LOCAL_STEALTH_SERVER_URL,
      DEFAULTS.LOCAL_STEALTH_SERVER_URL
    ),
    explorerUrl: getEnvString(WEB_ENV_VARS.LOCAL_EXPLORER_URL, DEFAULTS.LOCAL_EXPLORER_URL),
    indexerUrl: getEnvString(WEB_ENV_VARS.LOCAL_INDEXER_URL, DEFAULTS.LOCAL_INDEXER_URL),
    contracts: {
      entryPoint: getEnvString(
        WEB_ENV_VARS.LOCAL_ENTRY_POINT,
        DEFAULTS.LOCAL_ENTRY_POINT
      ) as `0x${string}`,
      accountFactory: getEnvString(
        WEB_ENV_VARS.LOCAL_ACCOUNT_FACTORY,
        DEFAULTS.LOCAL_ACCOUNT_FACTORY
      ) as `0x${string}`,
      paymaster: getEnvString(
        WEB_ENV_VARS.LOCAL_PAYMASTER,
        DEFAULTS.LOCAL_PAYMASTER
      ) as `0x${string}`,
      stealthAnnouncer: getEnvString(
        WEB_ENV_VARS.LOCAL_STEALTH_ANNOUNCER,
        DEFAULTS.LOCAL_STEALTH_ANNOUNCER
      ) as `0x${string}`,
      stealthRegistry: getEnvString(
        WEB_ENV_VARS.LOCAL_STEALTH_REGISTRY,
        DEFAULTS.LOCAL_STEALTH_REGISTRY
      ) as `0x${string}`,
      sessionKeyManager: getEnvString(
        WEB_ENV_VARS.LOCAL_SESSION_KEY_MANAGER,
        DEFAULTS.LOCAL_SESSION_KEY_MANAGER
      ) as `0x${string}`,
      subscriptionManager: getEnvString(
        WEB_ENV_VARS.LOCAL_SUBSCRIPTION_MANAGER,
        DEFAULTS.LOCAL_SUBSCRIPTION_MANAGER
      ) as `0x${string}`,
      recurringPaymentManager: getEnvString(
        WEB_ENV_VARS.LOCAL_RECURRING_PAYMENT_MANAGER,
        DEFAULTS.LOCAL_RECURRING_PAYMENT_MANAGER
      ) as `0x${string}`,
      permissionManager: getEnvString(
        WEB_ENV_VARS.LOCAL_PERMISSION_MANAGER,
        DEFAULTS.LOCAL_PERMISSION_MANAGER
      ) as `0x${string}`,
    },
  }
}

/**
 * @deprecated Use getLocalConfig instead
 */
export const getDevnetConfig = getLocalConfig

/**
 * Get Testnet configuration (StableNet Testnet - chainId 82830)
 * User settings from Settings page take priority over env vars and defaults
 */
export function getTestnetConfig() {
  const userSettings = getUserRpcSettings()

  return {
    // User settings > Environment variables > Defaults
    rpcUrl:
      userSettings?.rpcUrl || getEnvString(WEB_ENV_VARS.TESTNET_RPC_URL, DEFAULTS.TESTNET_RPC_URL),
    bundlerUrl:
      userSettings?.bundlerUrl ||
      getEnvString(WEB_ENV_VARS.TESTNET_BUNDLER_URL, DEFAULTS.TESTNET_BUNDLER_URL),
    paymasterUrl:
      userSettings?.paymasterUrl ||
      getEnvString(WEB_ENV_VARS.TESTNET_PAYMASTER_URL, DEFAULTS.TESTNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      WEB_ENV_VARS.TESTNET_STEALTH_SERVER_URL,
      DEFAULTS.TESTNET_STEALTH_SERVER_URL
    ),
    explorerUrl: getEnvString(WEB_ENV_VARS.TESTNET_EXPLORER_URL, DEFAULTS.TESTNET_EXPLORER_URL),
    indexerUrl: getEnvString(WEB_ENV_VARS.TESTNET_INDEXER_URL, DEFAULTS.TESTNET_INDEXER_URL),
    contracts: {
      entryPoint: getEnvString(
        WEB_ENV_VARS.TESTNET_ENTRY_POINT,
        DEFAULTS.TESTNET_ENTRY_POINT
      ) as `0x${string}`,
      accountFactory: getEnvString(
        WEB_ENV_VARS.TESTNET_ACCOUNT_FACTORY,
        DEFAULTS.TESTNET_ACCOUNT_FACTORY
      ) as `0x${string}`,
      paymaster: getEnvString(
        WEB_ENV_VARS.TESTNET_PAYMASTER,
        DEFAULTS.TESTNET_PAYMASTER
      ) as `0x${string}`,
      stealthAnnouncer: getEnvString(
        WEB_ENV_VARS.TESTNET_STEALTH_ANNOUNCER,
        DEFAULTS.TESTNET_STEALTH_ANNOUNCER
      ) as `0x${string}`,
      stealthRegistry: getEnvString(
        WEB_ENV_VARS.TESTNET_STEALTH_REGISTRY,
        DEFAULTS.TESTNET_STEALTH_REGISTRY
      ) as `0x${string}`,
      sessionKeyManager: getEnvString(
        WEB_ENV_VARS.TESTNET_SESSION_KEY_MANAGER,
        DEFAULTS.TESTNET_SESSION_KEY_MANAGER
      ) as `0x${string}`,
      subscriptionManager: getEnvString(
        WEB_ENV_VARS.TESTNET_SUBSCRIPTION_MANAGER,
        DEFAULTS.TESTNET_SUBSCRIPTION_MANAGER
      ) as `0x${string}`,
      recurringPaymentManager: getEnvString(
        WEB_ENV_VARS.TESTNET_RECURRING_PAYMENT_MANAGER,
        DEFAULTS.TESTNET_RECURRING_PAYMENT_MANAGER
      ) as `0x${string}`,
      permissionManager: getEnvString(
        WEB_ENV_VARS.TESTNET_PERMISSION_MANAGER,
        DEFAULTS.TESTNET_PERMISSION_MANAGER
      ) as `0x${string}`,
    },
  }
}

/**
 * Get app configuration
 */
export function getAppConfig() {
  return {
    name: 'StableNet',
    description: 'StableNet Smart Account Platform',
    defaultSlippage: getEnvNumber(WEB_ENV_VARS.DEFAULT_SLIPPAGE, DEFAULTS.DEFAULT_SLIPPAGE),
    maxSlippage: getEnvNumber(WEB_ENV_VARS.MAX_SLIPPAGE, DEFAULTS.MAX_SLIPPAGE),
    txTimeout: getEnvNumber(WEB_ENV_VARS.TX_TIMEOUT, DEFAULTS.TX_TIMEOUT),
    defaultChainId: getEnvNumber(WEB_ENV_VARS.DEFAULT_CHAIN_ID, DEFAULTS.DEFAULT_CHAIN_ID),
  }
}

/**
 * Get configuration by chain ID
 */
export function getConfigByChainId(chainId: number) {
  switch (chainId) {
    case 8283: // StableNet Local
      return getLocalConfig()
    case 82830: // StableNet Testnet
      return getTestnetConfig()
    default:
      return undefined
  }
}

/**
 * Get contract addresses by chain ID
 */
export function getContractAddresses(chainId: number) {
  const config = getConfigByChainId(chainId)
  return config?.contracts
}

/**
 * Get service URLs by chain ID
 */
export function getServiceUrls(chainId: number) {
  const config = getConfigByChainId(chainId)
  if (!config) return undefined
  return {
    bundler: config.bundlerUrl,
    paymaster: config.paymasterUrl,
    stealthServer: config.stealthServerUrl,
    indexer: config.indexerUrl,
  }
}
