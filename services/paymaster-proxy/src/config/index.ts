import type { Address, Hex } from 'viem'
import type { PaymasterAddresses, PaymasterProxyConfig } from '../types'
import { PAYMASTER_ENV_VARS, getEnvOptional, getServerConfig } from './constants'

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
 * Parse optional address from env
 */
function parseOptionalAddress(envName: string): Address | undefined {
  const value = getEnvOptional(envName)
  if (!value) return undefined
  if (!isValidAddress(value)) {
    console.warn(`[paymaster-proxy] Invalid address for ${envName}: ${value}, ignoring`)
    return undefined
  }
  return value as Address
}

/**
 * Build paymaster addresses map from environment
 */
function buildPaymasterAddresses(defaultAddress: Address): PaymasterAddresses {
  const addresses: PaymasterAddresses = {}

  const verifying = parseOptionalAddress(PAYMASTER_ENV_VARS.VERIFYING_PAYMASTER_ADDRESS)
  const erc20 = parseOptionalAddress(PAYMASTER_ENV_VARS.ERC20_PAYMASTER_ADDRESS)
  const permit2 = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_PAYMASTER_ADDRESS)
  const sponsor = parseOptionalAddress(PAYMASTER_ENV_VARS.SPONSOR_PAYMASTER_ADDRESS)

  // Backward compat: PAYMASTER_ADDRESS is the default verifying paymaster
  addresses.verifying = verifying ?? defaultAddress

  if (erc20) addresses.erc20 = erc20
  if (permit2) addresses.permit2 = permit2

  // Sponsor defaults to verifying address if not set separately
  addresses.sponsor = sponsor ?? addresses.verifying

  return addresses
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

  const paymasterAddresses = buildPaymasterAddresses(paymasterAddress as Address)
  const oracleAddress = parseOptionalAddress(PAYMASTER_ENV_VARS.PRICE_ORACLE_ADDRESS)
  const permit2Address = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_CONTRACT_ADDRESS)

  return {
    port,
    paymasterAddress: paymasterAddress as Address,
    paymasterAddresses,
    signerPrivateKey: signerPrivateKey as Hex,
    rpcUrl,
    supportedChainIds,
    debug,
    oracleAddress,
    permit2Address,
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
  const defaultAddress = options.paymasterAddress as Address
  const paymasterAddresses = buildPaymasterAddresses(defaultAddress)
  const oracleAddress = parseOptionalAddress(PAYMASTER_ENV_VARS.PRICE_ORACLE_ADDRESS)
  const permit2Address = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_CONTRACT_ADDRESS)

  return {
    port: options.port || defaults.port,
    paymasterAddress: defaultAddress,
    paymasterAddresses,
    signerPrivateKey: options.signerPrivateKey as Hex,
    rpcUrl: options.rpcUrl,
    supportedChainIds: parseChainIds(options.chainIds),
    debug: options.debug || defaults.debug,
    oracleAddress,
    permit2Address,
  }
}
