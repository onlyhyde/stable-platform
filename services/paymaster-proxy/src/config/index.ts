import type { Address, Hex } from 'viem'
import type { PaymasterProxyConfig } from '../types'
import { getServerConfig } from './constants'

/**
 * Environment variable names
 */
const ENV_KEYS = {
  PORT: 'PAYMASTER_PORT',
  PAYMASTER_ADDRESS: 'PAYMASTER_ADDRESS',
  SIGNER_PRIVATE_KEY: 'SIGNER_PRIVATE_KEY',
  RPC_URL: 'RPC_URL',
  SUPPORTED_CHAIN_IDS: 'PAYMASTER_SUPPORTED_CHAIN_IDS',
  DEBUG: 'PAYMASTER_DEBUG',
} as const

/**
 * Get default configuration values from environment
 */
function getDefaults() {
  const serverConfig = getServerConfig()
  return {
    port: serverConfig.port,
    supportedChainIds: serverConfig.supportedChainIds,
    debug: serverConfig.debug,
  }
}

/**
 * Parse comma-separated chain IDs
 */
function parseChainIds(value: string | undefined): number[] {
  if (!value) return getDefaults().supportedChainIds
  return value
    .split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id))
}

/**
 * Validate hex string
 */
function isValidHex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]*$/.test(value)
}

/**
 * Validate address
 */
function isValidAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): PaymasterProxyConfig {
  const defaults = getDefaults()
  const port = Number.parseInt(process.env[ENV_KEYS.PORT] || '', 10) || defaults.port

  const paymasterAddress = process.env[ENV_KEYS.PAYMASTER_ADDRESS]
  if (!paymasterAddress || !isValidAddress(paymasterAddress)) {
    throw new Error(`Invalid or missing ${ENV_KEYS.PAYMASTER_ADDRESS}`)
  }

  const signerPrivateKey = process.env[ENV_KEYS.SIGNER_PRIVATE_KEY]
  if (!signerPrivateKey || !isValidHex(signerPrivateKey)) {
    throw new Error(`Invalid or missing ${ENV_KEYS.SIGNER_PRIVATE_KEY}`)
  }

  const rpcUrl = process.env[ENV_KEYS.RPC_URL]
  if (!rpcUrl) {
    throw new Error(`Missing ${ENV_KEYS.RPC_URL}`)
  }

  const supportedChainIds = parseChainIds(process.env[ENV_KEYS.SUPPORTED_CHAIN_IDS])
  const debug = process.env[ENV_KEYS.DEBUG] === 'true'

  return {
    port,
    paymasterAddress: paymasterAddress as Address,
    signerPrivateKey: signerPrivateKey as Hex,
    rpcUrl,
    supportedChainIds,
    debug,
  }
}

/**
 * Create configuration from CLI arguments
 */
export function createConfig(options: {
  port?: number
  paymasterAddress: string
  signerPrivateKey: string
  rpcUrl: string
  chainIds?: string
  debug?: boolean
}): PaymasterProxyConfig {
  if (!isValidAddress(options.paymasterAddress)) {
    throw new Error('Invalid paymaster address')
  }

  if (!isValidHex(options.signerPrivateKey)) {
    throw new Error('Invalid signer private key')
  }

  const defaults = getDefaults()
  return {
    port: options.port || defaults.port,
    paymasterAddress: options.paymasterAddress as Address,
    signerPrivateKey: options.signerPrivateKey as Hex,
    rpcUrl: options.rpcUrl,
    supportedChainIds: parseChainIds(options.chainIds),
    debug: options.debug || defaults.debug,
  }
}
