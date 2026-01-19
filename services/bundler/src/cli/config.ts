import type { Address, Hex } from 'viem'
import type { BundlerConfig } from '../types'

/**
 * Default bundler configuration
 */
export const DEFAULT_CONFIG: Partial<BundlerConfig> = {
  port: 4337,
  minBalance: 100000000000000000n, // 0.1 ETH
  bundleInterval: 1000,
  maxBundleSize: 10,
  logLevel: 'info',
  debug: false,
}

/**
 * Network presets
 */
export const NETWORK_PRESETS: Record<string, {
  rpcUrl: string
  entryPoints: Address[]
}> = {
  devnet: {
    rpcUrl: 'http://localhost:8545',
    entryPoints: ['0x0000000071727De22E5E9d8BAf0edAc6f37da032'],
  },
  sepolia: {
    rpcUrl: 'https://rpc.sepolia.org',
    entryPoints: ['0x0000000071727De22E5E9d8BAf0edAc6f37da032'],
  },
  mainnet: {
    rpcUrl: 'https://eth.llamarpc.com',
    entryPoints: ['0x0000000071727De22E5E9d8BAf0edAc6f37da032'],
  },
}

/**
 * CLI options interface
 */
export interface CliOptions {
  network?: string
  port?: number
  entryPoint?: string[]
  beneficiary?: string
  rpcUrl?: string
  privateKey?: string
  minBalance?: string
  bundleInterval?: number
  maxBundleSize?: number
  logLevel?: string
  debug?: boolean
}

/**
 * Parse CLI options into bundler config
 */
export function parseConfig(options: CliOptions): BundlerConfig {
  const network = options.network || 'devnet'
  const preset = NETWORK_PRESETS[network]

  if (!preset && !options.rpcUrl) {
    throw new Error(
      `Unknown network "${network}". Use --rpc-url to specify a custom RPC URL.`
    )
  }

  const rpcUrl = options.rpcUrl || preset?.rpcUrl || ''
  const entryPoints = options.entryPoint?.length
    ? (options.entryPoint as Address[])
    : preset?.entryPoints || []

  if (entryPoints.length === 0) {
    throw new Error('At least one entry point address is required.')
  }

  if (!options.beneficiary) {
    throw new Error('Beneficiary address is required.')
  }

  if (!options.privateKey) {
    throw new Error('Private key is required.')
  }

  return {
    network,
    port: options.port ?? DEFAULT_CONFIG.port!,
    entryPoints,
    beneficiary: options.beneficiary as Address,
    rpcUrl,
    privateKey: options.privateKey as Hex,
    minBalance: options.minBalance
      ? BigInt(options.minBalance)
      : DEFAULT_CONFIG.minBalance!,
    bundleInterval: options.bundleInterval ?? DEFAULT_CONFIG.bundleInterval!,
    maxBundleSize: options.maxBundleSize ?? DEFAULT_CONFIG.maxBundleSize!,
    logLevel: (options.logLevel as BundlerConfig['logLevel']) ??
      DEFAULT_CONFIG.logLevel!,
    debug: options.debug ?? DEFAULT_CONFIG.debug!,
  }
}
