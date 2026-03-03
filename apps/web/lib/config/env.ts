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

import {
  getEntryPoint,
  getKernelFactory,
  getPermissionManager,
  getRecurringPaymentExecutor,
  getStealthAnnouncer,
  getStealthRegistry,
  getSubscriptionManager,
  getVerifyingPaymaster,
  getContractAddress,
} from '@stablenet/contracts'

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
  LOCAL_ORDER_ROUTER_URL: 'NEXT_PUBLIC_LOCAL_ORDER_ROUTER_URL',

  // Testnet Service URLs
  TESTNET_RPC_URL: 'NEXT_PUBLIC_TESTNET_RPC_URL',
  TESTNET_BUNDLER_URL: 'NEXT_PUBLIC_TESTNET_BUNDLER_URL',
  TESTNET_PAYMASTER_URL: 'NEXT_PUBLIC_TESTNET_PAYMASTER_URL',
  TESTNET_STEALTH_SERVER_URL: 'NEXT_PUBLIC_TESTNET_STEALTH_SERVER_URL',
  TESTNET_EXPLORER_URL: 'NEXT_PUBLIC_TESTNET_EXPLORER_URL',
  TESTNET_INDEXER_URL: 'NEXT_PUBLIC_TESTNET_INDEXER_URL',
  TESTNET_ORDER_ROUTER_URL: 'NEXT_PUBLIC_TESTNET_ORDER_ROUTER_URL',

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
  LOCAL_ORDER_ROUTER_URL: 'http://localhost:8087',

  // Testnet Service URLs (StableNet Testnet - chainId 82830)
  TESTNET_RPC_URL: 'https://rpc.testnet.stablenet.dev',
  TESTNET_BUNDLER_URL: 'https://bundler.testnet.stablenet.dev',
  TESTNET_PAYMASTER_URL: 'https://paymaster.testnet.stablenet.dev',
  TESTNET_STEALTH_SERVER_URL: 'https://stealth.testnet.stablenet.dev',
  TESTNET_EXPLORER_URL: 'https://explorer.testnet.stablenet.dev',
  TESTNET_INDEXER_URL: 'https://indexer.testnet.stablenet.dev/api',
  TESTNET_ORDER_ROUTER_URL: 'http://localhost:8087',

  // Contract Addresses (Local - StableNet chain 8283, sourced from @stablenet/contracts)
  LOCAL_ENTRY_POINT: getEntryPoint(8283),
  LOCAL_ACCOUNT_FACTORY: getKernelFactory(8283),
  LOCAL_PAYMASTER: getVerifyingPaymaster(8283),
  LOCAL_STEALTH_ANNOUNCER: getStealthAnnouncer(8283),
  LOCAL_STEALTH_REGISTRY: getStealthRegistry(8283),
  LOCAL_SESSION_KEY_MANAGER: getContractAddress(8283, 'sessionKeyExecutor'),
  LOCAL_SUBSCRIPTION_MANAGER: getSubscriptionManager(8283),
  LOCAL_RECURRING_PAYMENT_MANAGER: getRecurringPaymentExecutor(8283),
  LOCAL_PERMISSION_MANAGER: getPermissionManager(8283),

  // Contract Addresses (Testnet - ERC-4337 v0.9)
  TESTNET_ENTRY_POINT: '0xEf6817fe73741A8F10088f9511c64b666a338A14',
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
}

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
    orderRouterUrl: getEnvString(
      WEB_ENV_VARS.LOCAL_ORDER_ROUTER_URL,
      DEFAULTS.LOCAL_ORDER_ROUTER_URL
    ),
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
    orderRouterUrl: getEnvString(
      WEB_ENV_VARS.TESTNET_ORDER_ROUTER_URL,
      DEFAULTS.TESTNET_ORDER_ROUTER_URL
    ),
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
    orderRouter: config.orderRouterUrl,
  }
}
