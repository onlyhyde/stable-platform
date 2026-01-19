import type { Address, Hex } from 'viem'
import type { PaymasterProxyConfig } from '../types'

/**
 * Environment variable names
 */
const ENV_KEYS = {
  PORT: 'PAYMASTER_PORT',
  PAYMASTER_ADDRESS: 'PAYMASTER_ADDRESS',
  SIGNER_PRIVATE_KEY: 'SIGNER_PRIVATE_KEY',
  RPC_URL: 'RPC_URL',
  SUPPORTED_CHAIN_IDS: 'SUPPORTED_CHAIN_IDS',
  DEBUG: 'DEBUG',
} as const

/**
 * Default configuration values
 */
const DEFAULTS: {
  port: number
  supportedChainIds: number[]
  debug: boolean
} = {
  port: 3001,
  supportedChainIds: [1, 11155111, 84532], // mainnet, sepolia, base-sepolia
  debug: false,
}

/**
 * Parse comma-separated chain IDs
 */
function parseChainIds(value: string | undefined): number[] {
  if (!value) return DEFAULTS.supportedChainIds
  return value.split(',').map((id) => Number.parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id))
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
  const port = Number.parseInt(process.env[ENV_KEYS.PORT] || '', 10) || DEFAULTS.port

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

  return {
    port: options.port || DEFAULTS.port,
    paymasterAddress: options.paymasterAddress as Address,
    signerPrivateKey: options.signerPrivateKey as Hex,
    rpcUrl: options.rpcUrl,
    supportedChainIds: parseChainIds(options.chainIds),
    debug: options.debug || false,
  }
}
