/**
 * Environment Variable Configuration
 *
 * Allows overriding SDK configuration via environment variables.
 * This is useful for:
 * - Different deployment environments (dev, staging, prod)
 * - Custom service URLs
 * - Testing with different chain configurations
 *
 * Environment variables follow the pattern:
 * - STABLENET_[CHAIN]_RPC_URL
 * - STABLENET_[CHAIN]_BUNDLER_URL
 * - STABLENET_[CHAIN]_PAYMASTER_URL
 * - STABLENET_[CHAIN]_STEALTH_SERVER_URL
 * - STABLENET_[CHAIN]_EXPLORER_URL
 */

// Declare process type for environments without @types/node
declare const process: { env: Record<string, string | undefined> } | undefined

import type { Network, ServiceUrls } from '@stablenet/types'

/**
 * Environment variable names by chain
 */
export const SDK_ENV_VARS = {
  // Anvil (Local)
  ANVIL_RPC_URL: 'STABLENET_ANVIL_RPC_URL',
  ANVIL_BUNDLER_URL: 'STABLENET_ANVIL_BUNDLER_URL',
  ANVIL_PAYMASTER_URL: 'STABLENET_ANVIL_PAYMASTER_URL',
  ANVIL_STEALTH_SERVER_URL: 'STABLENET_ANVIL_STEALTH_SERVER_URL',

  // StableNet Local (Chain ID 8283)
  LOCAL_RPC_URL: 'STABLENET_LOCAL_RPC_URL',
  LOCAL_BUNDLER_URL: 'STABLENET_LOCAL_BUNDLER_URL',
  LOCAL_PAYMASTER_URL: 'STABLENET_LOCAL_PAYMASTER_URL',
  LOCAL_STEALTH_SERVER_URL: 'STABLENET_LOCAL_STEALTH_SERVER_URL',
  LOCAL_EXPLORER_URL: 'STABLENET_LOCAL_EXPLORER_URL',
  LOCAL_INDEXER_URL: 'STABLENET_LOCAL_INDEXER_URL',

  // Devnet
  DEVNET_RPC_URL: 'STABLENET_DEVNET_RPC_URL',
  DEVNET_BUNDLER_URL: 'STABLENET_DEVNET_BUNDLER_URL',
  DEVNET_PAYMASTER_URL: 'STABLENET_DEVNET_PAYMASTER_URL',
  DEVNET_STEALTH_SERVER_URL: 'STABLENET_DEVNET_STEALTH_SERVER_URL',

  // Sepolia
  SEPOLIA_RPC_URL: 'STABLENET_SEPOLIA_RPC_URL',
  SEPOLIA_BUNDLER_URL: 'STABLENET_SEPOLIA_BUNDLER_URL',
  SEPOLIA_PAYMASTER_URL: 'STABLENET_SEPOLIA_PAYMASTER_URL',
  SEPOLIA_STEALTH_SERVER_URL: 'STABLENET_SEPOLIA_STEALTH_SERVER_URL',
  SEPOLIA_EXPLORER_URL: 'STABLENET_SEPOLIA_EXPLORER_URL',

  // Mainnet
  MAINNET_RPC_URL: 'STABLENET_MAINNET_RPC_URL',
  MAINNET_BUNDLER_URL: 'STABLENET_MAINNET_BUNDLER_URL',
  MAINNET_PAYMASTER_URL: 'STABLENET_MAINNET_PAYMASTER_URL',
  MAINNET_STEALTH_SERVER_URL: 'STABLENET_MAINNET_STEALTH_SERVER_URL',
  MAINNET_EXPLORER_URL: 'STABLENET_MAINNET_EXPLORER_URL',

  // Default chain ID for new wallets
  DEFAULT_CHAIN_ID: 'STABLENET_DEFAULT_CHAIN_ID',
} as const

/**
 * Default values (fallback when no env var is set)
 */
const DEFAULTS = {
  // Anvil (Local)
  ANVIL_RPC_URL: 'http://127.0.0.1:8545',
  ANVIL_BUNDLER_URL: 'http://127.0.0.1:4337',
  ANVIL_PAYMASTER_URL: 'http://127.0.0.1:4338',
  ANVIL_STEALTH_SERVER_URL: 'http://127.0.0.1:4339',

  // StableNet Local (Chain ID 8283)
  LOCAL_RPC_URL: 'http://127.0.0.1:8501',
  LOCAL_BUNDLER_URL: 'http://127.0.0.1:4337',
  LOCAL_PAYMASTER_URL: 'http://127.0.0.1:4338',
  LOCAL_STEALTH_SERVER_URL: 'http://127.0.0.1:4339',
  LOCAL_EXPLORER_URL: 'http://127.0.0.1:3001',
  LOCAL_INDEXER_URL: 'http://127.0.0.1:8080',

  // Devnet
  DEVNET_RPC_URL: 'http://localhost:8545',
  DEVNET_BUNDLER_URL: 'http://localhost:4337',
  DEVNET_PAYMASTER_URL: 'http://localhost:4338',
  DEVNET_STEALTH_SERVER_URL: 'http://localhost:4339',

  // Sepolia
  SEPOLIA_RPC_URL: 'https://rpc.sepolia.org',
  SEPOLIA_BUNDLER_URL: 'https://bundler.sepolia.stablenet.dev',
  SEPOLIA_PAYMASTER_URL: 'https://paymaster.sepolia.stablenet.dev',
  SEPOLIA_STEALTH_SERVER_URL: 'https://stealth.sepolia.stablenet.dev',
  SEPOLIA_EXPLORER_URL: 'https://sepolia.etherscan.io',

  // Mainnet
  MAINNET_RPC_URL: 'https://eth.llamarpc.com',
  MAINNET_BUNDLER_URL: 'https://bundler.mainnet.stablenet.dev',
  MAINNET_PAYMASTER_URL: 'https://paymaster.mainnet.stablenet.dev',
  MAINNET_STEALTH_SERVER_URL: 'https://stealth.mainnet.stablenet.dev',
  MAINNET_EXPLORER_URL: 'https://etherscan.io',

  // Default chain ID
  DEFAULT_CHAIN_ID: 31337, // Anvil
} as const

/**
 * Get environment variable with fallback
 */
function getEnvString(name: string, defaultValue: string): string {
  if (typeof process === 'undefined' || !process.env) return defaultValue
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  return value
}

/**
 * Get environment variable as number
 */
function getEnvNumber(name: string, defaultValue: number): number {
  if (typeof process === 'undefined' || !process.env) return defaultValue
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  const num = Number.parseInt(value, 10)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * Get Anvil network configuration from environment
 */
export function getAnvilConfig() {
  return {
    rpcUrl: getEnvString(SDK_ENV_VARS.ANVIL_RPC_URL, DEFAULTS.ANVIL_RPC_URL),
    bundlerUrl: getEnvString(SDK_ENV_VARS.ANVIL_BUNDLER_URL, DEFAULTS.ANVIL_BUNDLER_URL),
    paymasterUrl: getEnvString(SDK_ENV_VARS.ANVIL_PAYMASTER_URL, DEFAULTS.ANVIL_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      SDK_ENV_VARS.ANVIL_STEALTH_SERVER_URL,
      DEFAULTS.ANVIL_STEALTH_SERVER_URL
    ),
  }
}

/**
 * Get StableNet Local network configuration from environment
 */
export function getLocalConfig() {
  return {
    rpcUrl: getEnvString(SDK_ENV_VARS.LOCAL_RPC_URL, DEFAULTS.LOCAL_RPC_URL),
    bundlerUrl: getEnvString(SDK_ENV_VARS.LOCAL_BUNDLER_URL, DEFAULTS.LOCAL_BUNDLER_URL),
    paymasterUrl: getEnvString(SDK_ENV_VARS.LOCAL_PAYMASTER_URL, DEFAULTS.LOCAL_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      SDK_ENV_VARS.LOCAL_STEALTH_SERVER_URL,
      DEFAULTS.LOCAL_STEALTH_SERVER_URL
    ),
    explorerUrl: getEnvString(SDK_ENV_VARS.LOCAL_EXPLORER_URL, DEFAULTS.LOCAL_EXPLORER_URL),
    indexerUrl: getEnvString(SDK_ENV_VARS.LOCAL_INDEXER_URL, DEFAULTS.LOCAL_INDEXER_URL),
  }
}

/**
 * Get Devnet network configuration from environment
 */
export function getDevnetConfig() {
  return {
    rpcUrl: getEnvString(SDK_ENV_VARS.DEVNET_RPC_URL, DEFAULTS.DEVNET_RPC_URL),
    bundlerUrl: getEnvString(SDK_ENV_VARS.DEVNET_BUNDLER_URL, DEFAULTS.DEVNET_BUNDLER_URL),
    paymasterUrl: getEnvString(SDK_ENV_VARS.DEVNET_PAYMASTER_URL, DEFAULTS.DEVNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      SDK_ENV_VARS.DEVNET_STEALTH_SERVER_URL,
      DEFAULTS.DEVNET_STEALTH_SERVER_URL
    ),
  }
}

/**
 * Get Sepolia network configuration from environment
 */
export function getSepoliaConfig() {
  return {
    rpcUrl: getEnvString(SDK_ENV_VARS.SEPOLIA_RPC_URL, DEFAULTS.SEPOLIA_RPC_URL),
    bundlerUrl: getEnvString(SDK_ENV_VARS.SEPOLIA_BUNDLER_URL, DEFAULTS.SEPOLIA_BUNDLER_URL),
    paymasterUrl: getEnvString(SDK_ENV_VARS.SEPOLIA_PAYMASTER_URL, DEFAULTS.SEPOLIA_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      SDK_ENV_VARS.SEPOLIA_STEALTH_SERVER_URL,
      DEFAULTS.SEPOLIA_STEALTH_SERVER_URL
    ),
    explorerUrl: getEnvString(SDK_ENV_VARS.SEPOLIA_EXPLORER_URL, DEFAULTS.SEPOLIA_EXPLORER_URL),
  }
}

/**
 * Get Mainnet network configuration from environment
 */
export function getMainnetConfig() {
  return {
    rpcUrl: getEnvString(SDK_ENV_VARS.MAINNET_RPC_URL, DEFAULTS.MAINNET_RPC_URL),
    bundlerUrl: getEnvString(SDK_ENV_VARS.MAINNET_BUNDLER_URL, DEFAULTS.MAINNET_BUNDLER_URL),
    paymasterUrl: getEnvString(SDK_ENV_VARS.MAINNET_PAYMASTER_URL, DEFAULTS.MAINNET_PAYMASTER_URL),
    stealthServerUrl: getEnvString(
      SDK_ENV_VARS.MAINNET_STEALTH_SERVER_URL,
      DEFAULTS.MAINNET_STEALTH_SERVER_URL
    ),
    explorerUrl: getEnvString(SDK_ENV_VARS.MAINNET_EXPLORER_URL, DEFAULTS.MAINNET_EXPLORER_URL),
  }
}

/**
 * Get default chain ID from environment
 */
export function getDefaultChainId(): number {
  return getEnvNumber(SDK_ENV_VARS.DEFAULT_CHAIN_ID, DEFAULTS.DEFAULT_CHAIN_ID)
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfigByChainId(chainId: number):
  | {
      rpcUrl: string
      bundlerUrl: string
      paymasterUrl?: string
      stealthServerUrl?: string
      explorerUrl?: string
    }
  | undefined {
  switch (chainId) {
    case 31337: // Anvil
      return getAnvilConfig()
    case 8283: // StableNet Local
      return getLocalConfig()
    case 1337: // Devnet
      return getDevnetConfig()
    case 11155111: // Sepolia
      return getSepoliaConfig()
    case 1: // Mainnet
      return getMainnetConfig()
    default:
      return undefined
  }
}

/**
 * Get service URLs by chain ID (with environment overrides)
 */
export function getServiceUrlsByChainId(chainId: number): Partial<ServiceUrls> | undefined {
  const config = getNetworkConfigByChainId(chainId)
  if (!config) return undefined

  const result: Partial<ServiceUrls> = {
    bundler: config.bundlerUrl,
  }

  if (config.paymasterUrl) {
    result.paymaster = config.paymasterUrl
  }

  if (config.stealthServerUrl) {
    result.stealthServer = config.stealthServerUrl
  }

  return result
}

/**
 * Apply environment overrides to a Network object
 */
export function applyEnvOverrides(network: Network): Network {
  const config = getNetworkConfigByChainId(network.chainId)
  if (!config) return network

  return {
    ...network,
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    paymasterUrl: config.paymasterUrl,
    explorerUrl: config.explorerUrl ?? network.explorerUrl,
  }
}

/**
 * Print environment variable usage help
 */
export function getSDKEnvHelp(): string {
  return `
StableNet SDK Configuration Environment Variables:

Anvil (Local - Chain ID 31337):
  ${SDK_ENV_VARS.ANVIL_RPC_URL}              RPC URL (default: http://127.0.0.1:8545)
  ${SDK_ENV_VARS.ANVIL_BUNDLER_URL}          Bundler URL (default: http://127.0.0.1:4337)
  ${SDK_ENV_VARS.ANVIL_PAYMASTER_URL}        Paymaster URL (default: http://127.0.0.1:4338)
  ${SDK_ENV_VARS.ANVIL_STEALTH_SERVER_URL}   Stealth Server URL (default: http://127.0.0.1:4339)

StableNet Local (Chain ID 8283):
  ${SDK_ENV_VARS.LOCAL_RPC_URL}              RPC URL (default: http://127.0.0.1:8501)
  ${SDK_ENV_VARS.LOCAL_BUNDLER_URL}          Bundler URL (default: http://127.0.0.1:4337)
  ${SDK_ENV_VARS.LOCAL_PAYMASTER_URL}        Paymaster URL (default: http://127.0.0.1:4338)
  ${SDK_ENV_VARS.LOCAL_STEALTH_SERVER_URL}   Stealth Server URL (default: http://127.0.0.1:4339)
  ${SDK_ENV_VARS.LOCAL_EXPLORER_URL}         Explorer URL (default: http://127.0.0.1:3001)
  ${SDK_ENV_VARS.LOCAL_INDEXER_URL}          Indexer URL (default: http://127.0.0.1:8080)

Devnet (Chain ID 1337):
  ${SDK_ENV_VARS.DEVNET_RPC_URL}             RPC URL (default: http://localhost:8545)
  ${SDK_ENV_VARS.DEVNET_BUNDLER_URL}         Bundler URL (default: http://localhost:4337)
  ${SDK_ENV_VARS.DEVNET_PAYMASTER_URL}       Paymaster URL (default: http://localhost:4338)
  ${SDK_ENV_VARS.DEVNET_STEALTH_SERVER_URL}  Stealth Server URL (default: http://localhost:4339)

Sepolia (Chain ID 11155111):
  ${SDK_ENV_VARS.SEPOLIA_RPC_URL}            RPC URL (default: https://rpc.sepolia.org)
  ${SDK_ENV_VARS.SEPOLIA_BUNDLER_URL}        Bundler URL (default: https://bundler.sepolia.stablenet.dev)
  ${SDK_ENV_VARS.SEPOLIA_PAYMASTER_URL}      Paymaster URL (default: https://paymaster.sepolia.stablenet.dev)
  ${SDK_ENV_VARS.SEPOLIA_STEALTH_SERVER_URL} Stealth Server URL (default: https://stealth.sepolia.stablenet.dev)
  ${SDK_ENV_VARS.SEPOLIA_EXPLORER_URL}       Explorer URL (default: https://sepolia.etherscan.io)

Mainnet (Chain ID 1):
  ${SDK_ENV_VARS.MAINNET_RPC_URL}            RPC URL (default: https://eth.llamarpc.com)
  ${SDK_ENV_VARS.MAINNET_BUNDLER_URL}        Bundler URL (default: https://bundler.mainnet.stablenet.dev)
  ${SDK_ENV_VARS.MAINNET_PAYMASTER_URL}      Paymaster URL (default: https://paymaster.mainnet.stablenet.dev)
  ${SDK_ENV_VARS.MAINNET_STEALTH_SERVER_URL} Stealth Server URL (default: https://stealth.mainnet.stablenet.dev)
  ${SDK_ENV_VARS.MAINNET_EXPLORER_URL}       Explorer URL (default: https://etherscan.io)

General:
  ${SDK_ENV_VARS.DEFAULT_CHAIN_ID}           Default chain ID for new wallets (default: 31337)
`.trim()
}
