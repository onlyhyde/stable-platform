import { ENTRY_POINT_ADDRESS, getEntryPoint, isChainSupported } from '@stablenet/contracts'
import type { Address, Hex } from 'viem'
import type { BundlerConfig } from '../types'

/**
 * Environment variable names
 */
export const ENV_VARS = {
  ENTRY_POINT: ['BUNDLER_ENTRY_POINT', 'ENTRY_POINT', 'ENTRY_POINT_ADDRESS'],
  PRIVATE_KEY: ['BUNDLER_PRIVATE_KEY', 'PRIVATE_KEY'],
  BENEFICIARY: ['BUNDLER_BENEFICIARY', 'BENEFICIARY'],
  RPC_URL: ['BUNDLER_RPC_URL', 'RPC_URL'],
  CHAIN_ID: ['BUNDLER_CHAIN_ID', 'CHAIN_ID'],
  NATIVE_CURRENCY_SYMBOL: ['BUNDLER_NATIVE_CURRENCY_SYMBOL', 'NATIVE_CURRENCY_SYMBOL'],
  NETWORK: ['BUNDLER_NETWORK', 'NETWORK'],
  PORT: ['BUNDLER_PORT', 'PORT'],
  LOG_LEVEL: ['BUNDLER_LOG_LEVEL', 'LOG_LEVEL'],
  DEBUG: ['BUNDLER_DEBUG', 'DEBUG'],
  MAX_NONCE_GAP: ['BUNDLER_MAX_NONCE_GAP', 'MAX_NONCE_GAP'],
  MIN_VALID_UNTIL_BUFFER: ['BUNDLER_MIN_VALID_UNTIL_BUFFER', 'MIN_VALID_UNTIL_BUFFER'],
  VALIDATE_NONCE_CONTINUITY: ['BUNDLER_VALIDATE_NONCE_CONTINUITY', 'VALIDATE_NONCE_CONTINUITY'],
  MEMPOOL_MAX_NONCE_GAP: ['BUNDLER_MEMPOOL_MAX_NONCE_GAP', 'MEMPOOL_MAX_NONCE_GAP'],
  CORS_ORIGINS: ['BUNDLER_CORS_ORIGINS', 'CORS_ORIGINS'],
  ENABLE_OPCODE_VALIDATION: ['BUNDLER_ENABLE_OPCODE_VALIDATION', 'ENABLE_OPCODE_VALIDATION'],
  BUNDLE_SUBMISSION_STRATEGY: ['BUNDLER_SUBMISSION_STRATEGY', 'BUNDLE_SUBMISSION_STRATEGY'],
  FLASHBOTS_RELAY_URL: ['BUNDLER_FLASHBOTS_RELAY_URL', 'FLASHBOTS_RELAY_URL'],
  FLASHBOTS_AUTH_KEY: ['BUNDLER_FLASHBOTS_AUTH_KEY', 'FLASHBOTS_AUTH_KEY'],
  ENABLE_PROFITABILITY_CHECK: ['BUNDLER_ENABLE_PROFITABILITY_CHECK', 'ENABLE_PROFITABILITY_CHECK'],
  MIN_BUNDLE_PROFIT: ['BUNDLER_MIN_BUNDLE_PROFIT', 'MIN_BUNDLE_PROFIT'],
} as const

/**
 * Get environment variable value with fallback names
 */
function getEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value !== '') {
      return value
    }
  }
  return undefined
}

/**
 * Get environment variable as boolean
 */
function getEnvBool(names: readonly string[]): boolean | undefined {
  const value = getEnv(names)
  if (value === undefined) return undefined
  return value === 'true' || value === '1'
}

/**
 * Get environment variable as number
 */
function getEnvNumber(names: readonly string[]): number | undefined {
  const value = getEnv(names)
  if (value === undefined) return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

/**
 * Parse entry points from environment variable
 * Supports comma-separated list: "0x123,0x456"
 */
function parseEntryPointsFromEnv(): Address[] | undefined {
  const value = getEnv(ENV_VARS.ENTRY_POINT)
  if (!value) return undefined
  return value.split(',').map((addr) => addr.trim() as Address)
}

/**
 * Parse CORS origins from environment variable
 * Supports comma-separated list: "http://localhost:3000,https://app.example.com"
 * Special value "*" allows all origins (not recommended for production)
 */
function parseCorsOriginsFromEnv(): string[] | undefined {
  const value = getEnv(ENV_VARS.CORS_ORIGINS)
  if (!value) return undefined
  if (value === '*') return ['*']
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/**
 * Default CORS origins for development
 * These are common local development ports
 */
export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
] as const

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
export const NETWORK_PRESETS: Record<
  string,
  {
    rpcUrl: string
    entryPoints: Address[]
  }
> = {
  local: {
    rpcUrl: 'http://localhost:8501',
    entryPoints: [isChainSupported(8283) ? getEntryPoint(8283) : ENTRY_POINT_ADDRESS],
  },
  devnet: {
    rpcUrl: 'http://localhost:8545',
    entryPoints: [ENTRY_POINT_ADDRESS],
  },
  sepolia: {
    rpcUrl: 'https://rpc.sepolia.org',
    entryPoints: [ENTRY_POINT_ADDRESS],
  },
  mainnet: {
    rpcUrl: 'https://eth.llamarpc.com',
    entryPoints: [ENTRY_POINT_ADDRESS],
  },
}

/**
 * CLI options interface
 */
export interface CliOptions {
  network?: string
  chainId?: number
  nativeCurrencySymbol?: string
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
  maxNonceGap?: number
  minValidUntilBuffer?: number
  validateNonceContinuity?: boolean
  mempoolMaxNonceGap?: number
  corsOrigins?: string[]
  enableOpcodeValidation?: boolean
  bundleSubmissionStrategy?: string
  flashbotsRelayUrl?: string
  flashbotsAuthKey?: string
  enableProfitabilityCheck?: boolean
  minBundleProfit?: string
}

/**
 * Parse CLI options into bundler config
 * Priority: CLI args > Environment variables > Network presets > Defaults
 */
export function parseConfig(options: CliOptions): BundlerConfig {
  // Network: CLI > env > default
  const network = options.network || getEnv(ENV_VARS.NETWORK) || 'devnet'
  const preset = NETWORK_PRESETS[network]

  // RPC URL: CLI > env > preset
  const rpcUrl = options.rpcUrl || getEnv(ENV_VARS.RPC_URL) || preset?.rpcUrl

  if (!rpcUrl) {
    throw new Error(
      `Unknown network "${network}" and no RPC URL provided. ` +
        `Set --rpc-url or ${ENV_VARS.RPC_URL.join('/')} environment variable.`
    )
  }

  // Chain ID: CLI > env (optional, overrides RPC-reported chainId)
  // Resolved early so it can be used for chain-aware EntryPoint lookup
  const chainId = options.chainId ?? getEnvNumber(ENV_VARS.CHAIN_ID)

  // Entry Points: CLI > env > chain-aware (contracts pkg) > preset
  const entryPoints =
    options.entryPoint?.length && options.entryPoint.length > 0
      ? (options.entryPoint as Address[])
      : parseEntryPointsFromEnv() ||
        (chainId && isChainSupported(chainId)
          ? [getEntryPoint(chainId) as Address]
          : null) ||
        preset?.entryPoints ||
        []

  if (entryPoints.length === 0) {
    throw new Error(
      `At least one entry point address is required. Set --entry-point or ${ENV_VARS.ENTRY_POINT.join('/')} environment variable.`
    )
  }

  // Beneficiary: CLI > env
  const beneficiary = options.beneficiary || getEnv(ENV_VARS.BENEFICIARY)

  if (!beneficiary) {
    throw new Error(
      `Beneficiary address is required. Set --beneficiary or ${ENV_VARS.BENEFICIARY.join('/')} environment variable.`
    )
  }

  // Private Key: CLI > env
  const privateKey = options.privateKey || getEnv(ENV_VARS.PRIVATE_KEY)

  if (!privateKey) {
    throw new Error(
      `Private key is required. Set --private-key or ${ENV_VARS.PRIVATE_KEY.join('/')} environment variable.`
    )
  }

  // Native currency symbol: CLI > env > default (ETH)
  const nativeCurrencySymbol =
    options.nativeCurrencySymbol || getEnv(ENV_VARS.NATIVE_CURRENCY_SYMBOL) || 'ETH'

  // Port: CLI > env > default
  const port = options.port ?? getEnvNumber(ENV_VARS.PORT) ?? DEFAULT_CONFIG.port!

  // Log level: CLI > env > default
  const logLevel =
    (options.logLevel as BundlerConfig['logLevel']) ||
    (getEnv(ENV_VARS.LOG_LEVEL) as BundlerConfig['logLevel']) ||
    DEFAULT_CONFIG.logLevel!

  // Debug: CLI > env > default
  const debug = options.debug ?? getEnvBool(ENV_VARS.DEBUG) ?? DEFAULT_CONFIG.debug!

  // Block debug mode in production unless explicitly overridden
  if (debug && process.env.NODE_ENV === 'production') {
    const forceDebug = process.env.BUNDLER_FORCE_DEBUG === 'true'
    if (!forceDebug) {
      throw new Error(
        'Debug mode is not allowed in production (NODE_ENV=production). ' +
          'Debug mode disables simulation validation, allows all CORS origins, and exposes internal error details. ' +
          'Set BUNDLER_FORCE_DEBUG=true to override (NOT recommended).'
      )
    }
  }

  // Max nonce gap: CLI > env > default (10)
  const maxNonceGapNum = options.maxNonceGap ?? getEnvNumber(ENV_VARS.MAX_NONCE_GAP)
  const maxNonceGap = maxNonceGapNum !== undefined ? BigInt(maxNonceGapNum) : undefined

  // Min validUntil buffer: CLI > env > default (30)
  const minValidUntilBufferNum =
    options.minValidUntilBuffer ?? getEnvNumber(ENV_VARS.MIN_VALID_UNTIL_BUFFER)
  const minValidUntilBuffer =
    minValidUntilBufferNum !== undefined ? BigInt(minValidUntilBufferNum) : undefined

  // Validate nonce continuity: CLI > env > default (false)
  const validateNonceContinuity =
    options.validateNonceContinuity ?? getEnvBool(ENV_VARS.VALIDATE_NONCE_CONTINUITY)

  // Mempool max nonce gap: CLI > env > default (0)
  const mempoolMaxNonceGap =
    options.mempoolMaxNonceGap ?? getEnvNumber(ENV_VARS.MEMPOOL_MAX_NONCE_GAP)

  // CORS origins: CLI > env > default (localhost only, or all in debug mode)
  const corsOrigins = options.corsOrigins ?? parseCorsOriginsFromEnv()

  // Enable opcode validation: CLI > env > default (true)
  const enableOpcodeValidation =
    options.enableOpcodeValidation ?? getEnvBool(ENV_VARS.ENABLE_OPCODE_VALIDATION) ?? true

  // Bundle submission strategy: CLI > env > default (direct)
  const bundleSubmissionStrategy = (options.bundleSubmissionStrategy ||
    getEnv(ENV_VARS.BUNDLE_SUBMISSION_STRATEGY) ||
    'direct') as 'direct' | 'flashbots'

  // Flashbots config: CLI > env
  const flashbotsRelayUrl = options.flashbotsRelayUrl || getEnv(ENV_VARS.FLASHBOTS_RELAY_URL)
  const flashbotsAuthKey = options.flashbotsAuthKey || getEnv(ENV_VARS.FLASHBOTS_AUTH_KEY)

  // Profitability: CLI > env > default (false)
  const enableProfitabilityCheck =
    options.enableProfitabilityCheck ?? getEnvBool(ENV_VARS.ENABLE_PROFITABILITY_CHECK) ?? false

  const minBundleProfitStr = options.minBundleProfit || getEnv(ENV_VARS.MIN_BUNDLE_PROFIT)
  const minBundleProfit = minBundleProfitStr ? BigInt(minBundleProfitStr) : undefined

  return {
    network,
    chainId,
    nativeCurrencySymbol,
    port,
    entryPoints,
    beneficiary: beneficiary as Address,
    rpcUrl,
    privateKey: privateKey as Hex,
    minBalance: options.minBalance ? BigInt(options.minBalance) : DEFAULT_CONFIG.minBalance!,
    bundleInterval: options.bundleInterval ?? DEFAULT_CONFIG.bundleInterval!,
    maxBundleSize: options.maxBundleSize ?? DEFAULT_CONFIG.maxBundleSize!,
    logLevel,
    debug,
    maxNonceGap,
    minValidUntilBuffer,
    validateNonceContinuity,
    mempoolMaxNonceGap,
    corsOrigins,
    enableOpcodeValidation,
    bundleSubmissionStrategy,
    flashbotsRelayUrl,
    flashbotsAuthKey: flashbotsAuthKey as Hex | undefined,
    enableProfitabilityCheck,
    minBundleProfit,
  }
}

/**
 * Print environment variable usage help
 */
export function getEnvHelp(): string {
  return `
Environment Variables:
  ${ENV_VARS.ENTRY_POINT.join(' or ')}     EntryPoint address(es), comma-separated
  ${ENV_VARS.PRIVATE_KEY.join(' or ')}     Private key for signing bundles
  ${ENV_VARS.BENEFICIARY.join(' or ')}     Beneficiary address for bundle fees
  ${ENV_VARS.RPC_URL.join(' or ')}         RPC URL for the chain
  ${ENV_VARS.CHAIN_ID.join(' or ')}         Chain ID (overrides RPC-reported chainId)
  ${ENV_VARS.NETWORK.join(' or ')}         Network name (local, devnet, sepolia, mainnet)
  ${ENV_VARS.PORT.join(' or ')}            RPC server port
  ${ENV_VARS.LOG_LEVEL.join(' or ')}       Log level (debug, info, warn, error)
  ${ENV_VARS.DEBUG.join(' or ')}           Enable debug mode (true/false)
  ${ENV_VARS.MAX_NONCE_GAP.join(' or ')}   Max nonce gap from on-chain (default: 10)
  ${ENV_VARS.MIN_VALID_UNTIL_BUFFER.join(' or ')} Min seconds before validUntil (default: 30)
  ${ENV_VARS.VALIDATE_NONCE_CONTINUITY.join(' or ')} Enable mempool nonce continuity (default: false)
  ${ENV_VARS.MEMPOOL_MAX_NONCE_GAP.join(' or ')} Max nonce gap in mempool (default: 0)
  ${ENV_VARS.CORS_ORIGINS.join(' or ')}    CORS allowed origins, comma-separated (default: localhost only)
  ${ENV_VARS.ENABLE_OPCODE_VALIDATION.join(' or ')} Enable ERC-7562 opcode validation (default: true)
  ${ENV_VARS.BUNDLE_SUBMISSION_STRATEGY.join(' or ')} Bundle submission: direct or flashbots (default: direct)
  ${ENV_VARS.FLASHBOTS_RELAY_URL.join(' or ')} Flashbots relay URL
  ${ENV_VARS.FLASHBOTS_AUTH_KEY.join(' or ')} Flashbots auth key (hex)
  ${ENV_VARS.ENABLE_PROFITABILITY_CHECK.join(' or ')} Enable profitability checks (default: false)
  ${ENV_VARS.MIN_BUNDLE_PROFIT.join(' or ')} Minimum bundle profit in wei (default: 0)

Priority: CLI arguments > Environment variables > Network presets > Defaults
`.trim()
}
