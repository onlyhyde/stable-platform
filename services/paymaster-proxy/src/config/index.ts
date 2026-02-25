import type { Address, Hex } from 'viem'
import type { PaymasterAddresses, PaymasterProxyConfig } from '../types'
import { PAYMASTER_ENV_VARS, getEnvOptional, getServerConfig, getSettlementConfig, parseEntryPoints } from './constants'
import { resolveContractAddresses } from './contracts'

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
 * Build paymaster addresses map.
 * Priority: ENV override > @stablenet/contracts > PAYMASTER_ADDRESS fallback
 */
function buildPaymasterAddresses(
  supportedChainIds: number[],
  fallbackAddress: Address | undefined
): PaymasterAddresses {
  // Resolve from @stablenet/contracts using first supported chain
  const firstChainId = supportedChainIds[0]
  const resolved = firstChainId !== undefined
    ? resolveContractAddresses(firstChainId)
    : null

  const envVerifying = parseOptionalAddress(PAYMASTER_ENV_VARS.VERIFYING_PAYMASTER_ADDRESS)
  const envErc20 = parseOptionalAddress(PAYMASTER_ENV_VARS.ERC20_PAYMASTER_ADDRESS)
  const envPermit2 = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_PAYMASTER_ADDRESS)
  const envSponsor = parseOptionalAddress(PAYMASTER_ENV_VARS.SPONSOR_PAYMASTER_ADDRESS)

  const addresses: PaymasterAddresses = {}

  // verifying: ENV > contracts > PAYMASTER_ADDRESS fallback
  addresses.verifying = envVerifying ?? resolved?.verifying ?? fallbackAddress

  // erc20: ENV > contracts
  const erc20 = envErc20 ?? resolved?.erc20
  if (erc20) addresses.erc20 = erc20

  // permit2: ENV > contracts
  const permit2 = envPermit2 ?? resolved?.permit2
  if (permit2) addresses.permit2 = permit2

  // sponsor: ENV > contracts > verifying fallback
  addresses.sponsor = envSponsor ?? resolved?.sponsor ?? addresses.verifying

  return addresses
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): PaymasterProxyConfig {
  const defaults = getDefaults()
  const port = Number.parseInt(process.env[ENV_KEYS.PORT] || '', 10) || defaults.port
  const supportedChainIds = parseChainIds(process.env[ENV_KEYS.SUPPORTED_CHAIN_IDS])

  // Resolve from @stablenet/contracts for first supported chain
  const firstChain = supportedChainIds[0]
  const resolved = firstChain !== undefined
    ? resolveContractAddresses(firstChain)
    : null

  // PAYMASTER_ADDRESS is now optional if @stablenet/contracts can resolve
  const paymasterAddressEnv = process.env[ENV_KEYS.PAYMASTER_ADDRESS]
  const fallbackAddress = paymasterAddressEnv && isValidAddress(paymasterAddressEnv)
    ? (paymasterAddressEnv as Address)
    : undefined

  // Determine the canonical paymaster address (verifying)
  const paymasterAddress = fallbackAddress ?? resolved?.verifying
  if (!paymasterAddress) {
    throw new Error(
      `Missing paymaster address: set ${ENV_KEYS.PAYMASTER_ADDRESS} or ensure chain is supported by @stablenet/contracts`
    )
  }

  const signerPrivateKey = process.env[ENV_KEYS.SIGNER_PRIVATE_KEY]
  if (!signerPrivateKey || !isValidHex(signerPrivateKey)) {
    throw new Error(`Invalid or missing ${ENV_KEYS.SIGNER_PRIVATE_KEY}`)
  }

  const rpcUrl = process.env[ENV_KEYS.RPC_URL]
  if (!rpcUrl) {
    throw new Error(`Missing ${ENV_KEYS.RPC_URL}`)
  }

  const debug = process.env[ENV_KEYS.DEBUG] === 'true'

  const paymasterAddresses = buildPaymasterAddresses(supportedChainIds, fallbackAddress)

  // oracle: ENV > contracts
  const oracleAddress = parseOptionalAddress(PAYMASTER_ENV_VARS.PRICE_ORACLE_ADDRESS)
    ?? resolved?.oracle

  // permit2 contract: ENV > contracts
  const permit2Address = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_CONTRACT_ADDRESS)
    ?? resolved?.permit2Contract

  const settlement = getSettlementConfig()

  return {
    port,
    paymasterAddress,
    paymasterAddresses,
    signerPrivateKey: signerPrivateKey as Hex,
    rpcUrl,
    supportedChainIds,
    debug,
    supportedEntryPoints: validateEntryPoints(parseEntryPoints()),
    oracleAddress,
    permit2Address,
    bundlerRpcUrl: settlement.bundlerRpcUrl,
    settlementPollMs: settlement.settlementPollMs,
    settlementEnabled: settlement.settlementEnabled,
  }
}

/**
 * Validate that at least one EntryPoint is configured (boot-time check)
 */
function validateEntryPoints(entryPoints: Address[]): Address[] {
  if (entryPoints.length === 0) {
    throw new Error(
      `No valid EntryPoint addresses configured. Set ${PAYMASTER_ENV_VARS.SUPPORTED_ENTRY_POINTS} with comma-separated addresses.`
    )
  }
  return entryPoints
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
  const supportedChainIds = parseChainIds(options.chainIds)
  const defaultAddress = options.paymasterAddress as Address
  const paymasterAddresses = buildPaymasterAddresses(supportedChainIds, defaultAddress)

  // Resolve from @stablenet/contracts for first supported chain
  const firstChain = supportedChainIds[0]
  const resolved = firstChain !== undefined
    ? resolveContractAddresses(firstChain)
    : null

  const oracleAddress = parseOptionalAddress(PAYMASTER_ENV_VARS.PRICE_ORACLE_ADDRESS)
    ?? resolved?.oracle
  const permit2Address = parseOptionalAddress(PAYMASTER_ENV_VARS.PERMIT2_CONTRACT_ADDRESS)
    ?? resolved?.permit2Contract

  return {
    port: options.port || defaults.port,
    paymasterAddress: defaultAddress,
    paymasterAddresses,
    signerPrivateKey: options.signerPrivateKey as Hex,
    rpcUrl: options.rpcUrl,
    supportedChainIds,
    debug: options.debug || defaults.debug,
    supportedEntryPoints: validateEntryPoints(parseEntryPoints()),
    oracleAddress,
    permit2Address,
  }
}
