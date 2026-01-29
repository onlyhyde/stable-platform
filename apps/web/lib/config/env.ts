/**
 * Web App Environment Configuration
 *
 * Environment variables for the Next.js web application.
 * All client-side variables must be prefixed with NEXT_PUBLIC_
 *
 * Usage:
 * - Set in .env.local for local development
 * - Set in deployment environment for production
 */

/**
 * Environment variable names
 */
export const WEB_ENV_VARS = {
  // Devnet Service URLs
  DEVNET_RPC_URL: 'NEXT_PUBLIC_DEVNET_RPC_URL',
  DEVNET_BUNDLER_URL: 'NEXT_PUBLIC_DEVNET_BUNDLER_URL',
  DEVNET_PAYMASTER_URL: 'NEXT_PUBLIC_DEVNET_PAYMASTER_URL',
  DEVNET_STEALTH_SERVER_URL: 'NEXT_PUBLIC_DEVNET_STEALTH_SERVER_URL',
  DEVNET_EXPLORER_URL: 'NEXT_PUBLIC_DEVNET_EXPLORER_URL',

  // Testnet Service URLs
  TESTNET_RPC_URL: 'NEXT_PUBLIC_TESTNET_RPC_URL',
  TESTNET_BUNDLER_URL: 'NEXT_PUBLIC_TESTNET_BUNDLER_URL',
  TESTNET_PAYMASTER_URL: 'NEXT_PUBLIC_TESTNET_PAYMASTER_URL',
  TESTNET_STEALTH_SERVER_URL: 'NEXT_PUBLIC_TESTNET_STEALTH_SERVER_URL',
  TESTNET_EXPLORER_URL: 'NEXT_PUBLIC_TESTNET_EXPLORER_URL',

  // Contract Addresses (Devnet)
  DEVNET_ENTRY_POINT: 'NEXT_PUBLIC_DEVNET_ENTRY_POINT',
  DEVNET_ACCOUNT_FACTORY: 'NEXT_PUBLIC_DEVNET_ACCOUNT_FACTORY',
  DEVNET_PAYMASTER: 'NEXT_PUBLIC_DEVNET_PAYMASTER',
  DEVNET_STEALTH_ANNOUNCER: 'NEXT_PUBLIC_DEVNET_STEALTH_ANNOUNCER',
  DEVNET_STEALTH_REGISTRY: 'NEXT_PUBLIC_DEVNET_STEALTH_REGISTRY',
  DEVNET_SESSION_KEY_MANAGER: 'NEXT_PUBLIC_DEVNET_SESSION_KEY_MANAGER',
  DEVNET_SUBSCRIPTION_MANAGER: 'NEXT_PUBLIC_DEVNET_SUBSCRIPTION_MANAGER',
  DEVNET_RECURRING_PAYMENT_MANAGER: 'NEXT_PUBLIC_DEVNET_RECURRING_PAYMENT_MANAGER',
  DEVNET_PERMISSION_MANAGER: 'NEXT_PUBLIC_DEVNET_PERMISSION_MANAGER',

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
  // Devnet Service URLs
  DEVNET_RPC_URL: 'http://localhost:8545',
  DEVNET_BUNDLER_URL: 'http://localhost:4337',
  DEVNET_PAYMASTER_URL: 'http://localhost:4338',
  DEVNET_STEALTH_SERVER_URL: 'http://localhost:4339',
  DEVNET_EXPLORER_URL: 'http://localhost:4000',

  // Testnet Service URLs
  TESTNET_RPC_URL: 'https://testnet.stablenet.io/rpc',
  TESTNET_BUNDLER_URL: 'https://testnet.stablenet.io/bundler',
  TESTNET_PAYMASTER_URL: 'https://testnet.stablenet.io/paymaster',
  TESTNET_STEALTH_SERVER_URL: 'https://testnet.stablenet.io/stealth',
  TESTNET_EXPLORER_URL: 'https://testnet.stablenet.io/explorer',

  // Contract Addresses (Devnet)
  DEVNET_ENTRY_POINT: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  DEVNET_ACCOUNT_FACTORY: '0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c',
  DEVNET_PAYMASTER: '0x2dd78fd9b8f40659af32ef98555b8b31bc97a351',
  DEVNET_STEALTH_ANNOUNCER: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
  DEVNET_STEALTH_REGISTRY: '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4',
  DEVNET_SESSION_KEY_MANAGER: '0x4a679253410272dd5232B3Ff7cF5dbB88f295319',
  DEVNET_SUBSCRIPTION_MANAGER: '0x9d4454B023096f34B160D6B654540c56A1F81688',
  DEVNET_RECURRING_PAYMENT_MANAGER: '0x5678901234567890123456789012345678901234',
  DEVNET_PERMISSION_MANAGER: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',

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
  DEFAULT_CHAIN_ID: 31337, // Devnet
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
 * Get Devnet configuration
 */
export function getDevnetConfig() {
  return {
    rpcUrl: getEnvString(WEB_ENV_VARS.DEVNET_RPC_URL, DEFAULTS.DEVNET_RPC_URL),
    bundlerUrl: getEnvString(WEB_ENV_VARS.DEVNET_BUNDLER_URL, DEFAULTS.DEVNET_BUNDLER_URL),
    paymasterUrl: getEnvString(WEB_ENV_VARS.DEVNET_PAYMASTER_URL, DEFAULTS.DEVNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(WEB_ENV_VARS.DEVNET_STEALTH_SERVER_URL, DEFAULTS.DEVNET_STEALTH_SERVER_URL),
    explorerUrl: getEnvString(WEB_ENV_VARS.DEVNET_EXPLORER_URL, DEFAULTS.DEVNET_EXPLORER_URL),
    contracts: {
      entryPoint: getEnvString(WEB_ENV_VARS.DEVNET_ENTRY_POINT, DEFAULTS.DEVNET_ENTRY_POINT) as `0x${string}`,
      accountFactory: getEnvString(WEB_ENV_VARS.DEVNET_ACCOUNT_FACTORY, DEFAULTS.DEVNET_ACCOUNT_FACTORY) as `0x${string}`,
      paymaster: getEnvString(WEB_ENV_VARS.DEVNET_PAYMASTER, DEFAULTS.DEVNET_PAYMASTER) as `0x${string}`,
      stealthAnnouncer: getEnvString(WEB_ENV_VARS.DEVNET_STEALTH_ANNOUNCER, DEFAULTS.DEVNET_STEALTH_ANNOUNCER) as `0x${string}`,
      stealthRegistry: getEnvString(WEB_ENV_VARS.DEVNET_STEALTH_REGISTRY, DEFAULTS.DEVNET_STEALTH_REGISTRY) as `0x${string}`,
      sessionKeyManager: getEnvString(WEB_ENV_VARS.DEVNET_SESSION_KEY_MANAGER, DEFAULTS.DEVNET_SESSION_KEY_MANAGER) as `0x${string}`,
      subscriptionManager: getEnvString(WEB_ENV_VARS.DEVNET_SUBSCRIPTION_MANAGER, DEFAULTS.DEVNET_SUBSCRIPTION_MANAGER) as `0x${string}`,
      recurringPaymentManager: getEnvString(WEB_ENV_VARS.DEVNET_RECURRING_PAYMENT_MANAGER, DEFAULTS.DEVNET_RECURRING_PAYMENT_MANAGER) as `0x${string}`,
      permissionManager: getEnvString(WEB_ENV_VARS.DEVNET_PERMISSION_MANAGER, DEFAULTS.DEVNET_PERMISSION_MANAGER) as `0x${string}`,
    },
  }
}

/**
 * Get Testnet configuration
 */
export function getTestnetConfig() {
  return {
    rpcUrl: getEnvString(WEB_ENV_VARS.TESTNET_RPC_URL, DEFAULTS.TESTNET_RPC_URL),
    bundlerUrl: getEnvString(WEB_ENV_VARS.TESTNET_BUNDLER_URL, DEFAULTS.TESTNET_BUNDLER_URL),
    paymasterUrl: getEnvString(WEB_ENV_VARS.TESTNET_PAYMASTER_URL, DEFAULTS.TESTNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(WEB_ENV_VARS.TESTNET_STEALTH_SERVER_URL, DEFAULTS.TESTNET_STEALTH_SERVER_URL),
    explorerUrl: getEnvString(WEB_ENV_VARS.TESTNET_EXPLORER_URL, DEFAULTS.TESTNET_EXPLORER_URL),
    contracts: {
      entryPoint: getEnvString(WEB_ENV_VARS.TESTNET_ENTRY_POINT, DEFAULTS.TESTNET_ENTRY_POINT) as `0x${string}`,
      accountFactory: getEnvString(WEB_ENV_VARS.TESTNET_ACCOUNT_FACTORY, DEFAULTS.TESTNET_ACCOUNT_FACTORY) as `0x${string}`,
      paymaster: getEnvString(WEB_ENV_VARS.TESTNET_PAYMASTER, DEFAULTS.TESTNET_PAYMASTER) as `0x${string}`,
      stealthAnnouncer: getEnvString(WEB_ENV_VARS.TESTNET_STEALTH_ANNOUNCER, DEFAULTS.TESTNET_STEALTH_ANNOUNCER) as `0x${string}`,
      stealthRegistry: getEnvString(WEB_ENV_VARS.TESTNET_STEALTH_REGISTRY, DEFAULTS.TESTNET_STEALTH_REGISTRY) as `0x${string}`,
      sessionKeyManager: getEnvString(WEB_ENV_VARS.TESTNET_SESSION_KEY_MANAGER, DEFAULTS.TESTNET_SESSION_KEY_MANAGER) as `0x${string}`,
      subscriptionManager: getEnvString(WEB_ENV_VARS.TESTNET_SUBSCRIPTION_MANAGER, DEFAULTS.TESTNET_SUBSCRIPTION_MANAGER) as `0x${string}`,
      recurringPaymentManager: getEnvString(WEB_ENV_VARS.TESTNET_RECURRING_PAYMENT_MANAGER, DEFAULTS.TESTNET_RECURRING_PAYMENT_MANAGER) as `0x${string}`,
      permissionManager: getEnvString(WEB_ENV_VARS.TESTNET_PERMISSION_MANAGER, DEFAULTS.TESTNET_PERMISSION_MANAGER) as `0x${string}`,
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
    case 31337:
      return getDevnetConfig()
    case 11155111:
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
  }
}
