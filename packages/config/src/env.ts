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

import type { Network } from '@stablenet/types'

/**
 * Chain environment configuration definition
 */
interface ChainEnvDef {
  prefix: string
  defaults: {
    rpcUrl: string
    bundlerUrl: string
    paymasterUrl: string
    stealthServerUrl: string
    explorerUrl?: string
    indexerUrl?: string
  }
}

/**
 * Chain environment definitions
 */
const CHAIN_ENV_DEFS: Record<string, ChainEnvDef> = {
  ANVIL: {
    prefix: 'ANVIL',
    defaults: {
      rpcUrl: 'http://127.0.0.1:8545',
      bundlerUrl: 'http://127.0.0.1:4337',
      paymasterUrl: 'http://127.0.0.1:4338',
      stealthServerUrl: 'http://127.0.0.1:4339',
    },
  },
  LOCAL: {
    prefix: 'LOCAL',
    defaults: {
      rpcUrl: 'http://127.0.0.1:8501',
      bundlerUrl: 'http://127.0.0.1:4337',
      paymasterUrl: 'http://127.0.0.1:4338',
      stealthServerUrl: 'http://127.0.0.1:4339',
      explorerUrl: 'http://127.0.0.1:3001',
      indexerUrl: 'http://127.0.0.1:8080',
    },
  },
  SEPOLIA: {
    prefix: 'SEPOLIA',
    defaults: {
      rpcUrl: 'https://rpc.sepolia.org',
      bundlerUrl: 'https://bundler.sepolia.stablenet.dev',
      paymasterUrl: 'https://paymaster.sepolia.stablenet.dev',
      stealthServerUrl: 'https://stealth.sepolia.stablenet.dev',
      explorerUrl: 'https://sepolia.etherscan.io',
    },
  },
  MAINNET: {
    prefix: 'MAINNET',
    defaults: {
      rpcUrl: 'https://eth.llamarpc.com',
      bundlerUrl: 'https://bundler.mainnet.stablenet.dev',
      paymasterUrl: 'https://paymaster.mainnet.stablenet.dev',
      stealthServerUrl: 'https://stealth.mainnet.stablenet.dev',
      explorerUrl: 'https://etherscan.io',
    },
  },
} as const

/**
 * Environment variable name for default chain ID
 */
const DEFAULT_CHAIN_ID_ENV = 'STABLENET_DEFAULT_CHAIN_ID'
const DEFAULT_CHAIN_ID_VALUE = 8283

/**
 * Chain ID → env def mapping
 */
const CHAIN_ID_TO_ENV: Record<number, string> = {
  31337: 'ANVIL',
  8283: 'LOCAL',
  11155111: 'SEPOLIA',
  1: 'MAINNET',
}

/**
 * Get environment variable with fallback (browser-safe)
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
 * Generic chain config builder — resolves env vars with fallback defaults
 */
function getChainEnvConfig(envKey: string) {
  const def = CHAIN_ENV_DEFS[envKey]
  if (!def) throw new Error(`Unknown chain env key: ${envKey}`)

  const { prefix, defaults } = def
  return {
    rpcUrl: getEnvString(`STABLENET_${prefix}_RPC_URL`, defaults.rpcUrl),
    bundlerUrl: getEnvString(`STABLENET_${prefix}_BUNDLER_URL`, defaults.bundlerUrl),
    paymasterUrl: getEnvString(`STABLENET_${prefix}_PAYMASTER_URL`, defaults.paymasterUrl),
    stealthServerUrl: getEnvString(
      `STABLENET_${prefix}_STEALTH_SERVER_URL`,
      defaults.stealthServerUrl
    ),
    ...(defaults.explorerUrl !== undefined && {
      explorerUrl: getEnvString(`STABLENET_${prefix}_EXPLORER_URL`, defaults.explorerUrl),
    }),
    ...(defaults.indexerUrl !== undefined && {
      indexerUrl: getEnvString(`STABLENET_${prefix}_INDEXER_URL`, defaults.indexerUrl),
    }),
  }
}

/**
 * Get Anvil network configuration from environment
 */
export function getAnvilConfig() {
  return getChainEnvConfig('ANVIL')
}

/**
 * Get StableNet Local/Testnet network configuration from environment
 */
export function getLocalConfig() {
  return getChainEnvConfig('LOCAL')
}

/**
 * Get Sepolia network configuration from environment
 */
export function getSepoliaConfig() {
  return getChainEnvConfig('SEPOLIA')
}

/**
 * Get Mainnet network configuration from environment
 */
export function getMainnetConfig() {
  return getChainEnvConfig('MAINNET')
}

/**
 * Get default chain ID from environment
 */
export function getDefaultChainId(): number {
  return getEnvNumber(DEFAULT_CHAIN_ID_ENV, DEFAULT_CHAIN_ID_VALUE)
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfigByChainId(chainId: number) {
  const envKey = CHAIN_ID_TO_ENV[chainId]
  if (!envKey) return undefined
  return getChainEnvConfig(envKey)
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
  const lines: string[] = ['StableNet SDK Configuration Environment Variables:', '']

  for (const [key, def] of Object.entries(CHAIN_ENV_DEFS)) {
    const { prefix, defaults } = def
    lines.push(`${key} (Chain):`)
    lines.push(`  STABLENET_${prefix}_RPC_URL              RPC URL (default: ${defaults.rpcUrl})`)
    lines.push(
      `  STABLENET_${prefix}_BUNDLER_URL          Bundler URL (default: ${defaults.bundlerUrl})`
    )
    lines.push(
      `  STABLENET_${prefix}_PAYMASTER_URL        Paymaster URL (default: ${defaults.paymasterUrl})`
    )
    lines.push(
      `  STABLENET_${prefix}_STEALTH_SERVER_URL   Stealth Server URL (default: ${defaults.stealthServerUrl})`
    )
    if (defaults.explorerUrl) {
      lines.push(
        `  STABLENET_${prefix}_EXPLORER_URL         Explorer URL (default: ${defaults.explorerUrl})`
      )
    }
    if (defaults.indexerUrl) {
      lines.push(
        `  STABLENET_${prefix}_INDEXER_URL          Indexer URL (default: ${defaults.indexerUrl})`
      )
    }
    lines.push('')
  }

  lines.push('General:')
  lines.push(
    `  ${DEFAULT_CHAIN_ID_ENV}           Default chain ID for new wallets (default: ${DEFAULT_CHAIN_ID_VALUE})`
  )

  return lines.join('\n')
}
