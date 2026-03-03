import type { Address } from 'viem'

/**
 * Environment variable names for paymaster-proxy constants
 */
export const PAYMASTER_ENV_VARS = {
  // Server Config
  PORT: 'PAYMASTER_PORT',
  DEBUG: 'PAYMASTER_DEBUG',
  SPONSOR_NAME: 'PAYMASTER_SPONSOR_NAME',

  // Signer Config
  VALIDITY_SECONDS: 'PAYMASTER_VALIDITY_SECONDS',
  CLOCK_SKEW_SECONDS: 'PAYMASTER_CLOCK_SKEW_SECONDS',

  // Policy Defaults
  DEFAULT_MAX_GAS_LIMIT: 'PAYMASTER_DEFAULT_MAX_GAS_LIMIT',
  DEFAULT_MAX_GAS_COST: 'PAYMASTER_DEFAULT_MAX_GAS_COST',
  DEFAULT_DAILY_LIMIT_PER_SENDER: 'PAYMASTER_DEFAULT_DAILY_LIMIT_PER_SENDER',
  DEFAULT_GLOBAL_DAILY_LIMIT: 'PAYMASTER_DEFAULT_GLOBAL_DAILY_LIMIT',

  // Chain Config
  SUPPORTED_CHAIN_IDS: 'PAYMASTER_SUPPORTED_CHAIN_IDS',

  // Multi-Paymaster Addresses
  VERIFYING_PAYMASTER_ADDRESS: 'VERIFYING_PAYMASTER_ADDRESS',
  ERC20_PAYMASTER_ADDRESS: 'ERC20_PAYMASTER_ADDRESS',
  PERMIT2_PAYMASTER_ADDRESS: 'PERMIT2_PAYMASTER_ADDRESS',
  SPONSOR_PAYMASTER_ADDRESS: 'SPONSOR_PAYMASTER_ADDRESS',

  // EntryPoint Allowlist
  SUPPORTED_ENTRY_POINTS: 'SUPPORTED_ENTRY_POINTS',

  // Contract Addresses
  PRICE_ORACLE_ADDRESS: 'PRICE_ORACLE_ADDRESS',
  PERMIT2_CONTRACT_ADDRESS: 'PERMIT2_CONTRACT_ADDRESS',

  // Settlement (Phase 2)
  BUNDLER_RPC_URL: 'BUNDLER_RPC_URL',
  SETTLEMENT_POLL_MS: 'SETTLEMENT_POLL_MS',
  SETTLEMENT_ENABLED: 'SETTLEMENT_ENABLED',

  // Deposit Monitoring
  DEPOSIT_MONITOR_ENABLED: 'PAYMASTER_DEPOSIT_MONITOR_ENABLED',
  DEPOSIT_MONITOR_POLL_MS: 'PAYMASTER_DEPOSIT_MONITOR_POLL_MS',
  DEPOSIT_MIN_THRESHOLD: 'PAYMASTER_DEPOSIT_MIN_THRESHOLD',
  DEPOSIT_REJECT_ON_LOW: 'PAYMASTER_DEPOSIT_REJECT_ON_LOW',

  // Auto-Deposit (Phase 2)
  DEPOSIT_AUTO_ENABLED: 'PAYMASTER_DEPOSIT_AUTO_ENABLED',
  DEPOSIT_AUTO_AMOUNT: 'PAYMASTER_DEPOSIT_AUTO_AMOUNT',
  DEPOSIT_AUTO_COOLDOWN_MS: 'PAYMASTER_DEPOSIT_AUTO_COOLDOWN_MS',

  // Time Range Validation
  MAX_VALIDITY_SECONDS: 'PAYMASTER_MAX_VALIDITY_SECONDS',
  MIN_VALIDITY_SECONDS: 'PAYMASTER_MIN_VALIDITY_SECONDS',

  // Reservation Persistence
  RESERVATION_DATA_DIR: 'PAYMASTER_RESERVATION_DATA_DIR',
} as const

/**
 * Default values
 */
const DEFAULTS = {
  port: 4338,
  debug: false,
  sponsorName: 'StableNet Paymaster',
  validitySeconds: 300, // 5 minutes — shorter window reduces signature replay risk
  clockSkewSeconds: 60, // 1 minute
  maxGasLimit: 5_000_000n,
  maxGasCost: 10n ** 18n, // 1 ETH
  dailyLimitPerSender: 10n ** 17n, // 0.1 ETH
  globalDailyLimit: 10n ** 19n, // 10 ETH
  supportedChainIds: [8283, 1, 11155111, 84532], // stablenet-local, mainnet, sepolia, base-sepolia
} as const

/**
 * Get environment variable as number
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  const num = Number.parseInt(value, 10)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * Get environment variable as bigint
 */
function getEnvBigInt(name: string, defaultValue: bigint): bigint {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  try {
    return BigInt(value)
  } catch {
    return defaultValue
  }
}

/**
 * Get environment variable as boolean
 */
function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  return value === 'true' || value === '1'
}

/**
 * Get environment variable as string
 */
function getEnvString(name: string, defaultValue: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') return defaultValue
  return value
}

/**
 * Get optional environment variable as string
 */
export function getEnvOptional(name: string): string | undefined {
  const value = process.env[name]
  if (value === undefined || value === '') return undefined
  return value
}

/**
 * Parse comma-separated chain IDs
 */
function parseChainIds(name: string, defaultValue: readonly number[]): number[] {
  const value = process.env[name]
  if (value === undefined || value === '') return [...defaultValue]
  return value
    .split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id))
}

/**
 * Parse comma-separated EntryPoint addresses
 * Defaults to ERC-4337 v0.9 EntryPoint
 */
export function parseEntryPoints(): Address[] {
  const DEFAULT_ENTRY_POINT = '0xEf6817fe73741A8F10088f9511c64b666a338A14'
  const value = process.env[PAYMASTER_ENV_VARS.SUPPORTED_ENTRY_POINTS]
  if (value === undefined || value === '') {
    return [DEFAULT_ENTRY_POINT as Address]
  }
  return value
    .split(',')
    .map((addr) => addr.trim() as Address)
    .filter((addr) => /^0x[0-9a-fA-F]{40}$/.test(addr))
}

/**
 * Server configuration
 */
export function getServerConfig() {
  return {
    port: getEnvNumber(PAYMASTER_ENV_VARS.PORT, DEFAULTS.port),
    debug: getEnvBool(PAYMASTER_ENV_VARS.DEBUG, DEFAULTS.debug),
    sponsorName: getEnvString(PAYMASTER_ENV_VARS.SPONSOR_NAME, DEFAULTS.sponsorName),
    supportedChainIds: parseChainIds(
      PAYMASTER_ENV_VARS.SUPPORTED_CHAIN_IDS,
      DEFAULTS.supportedChainIds
    ),
  }
}

/**
 * Signer configuration
 */
export function getSignerConfig() {
  return {
    validitySeconds: getEnvNumber(PAYMASTER_ENV_VARS.VALIDITY_SECONDS, DEFAULTS.validitySeconds),
    clockSkewSeconds: getEnvNumber(
      PAYMASTER_ENV_VARS.CLOCK_SKEW_SECONDS,
      DEFAULTS.clockSkewSeconds
    ),
  }
}

/**
 * Default policy configuration
 */
export function getDefaultPolicyConfig() {
  return {
    maxGasLimit: getEnvBigInt(PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_LIMIT, DEFAULTS.maxGasLimit),
    maxGasCost: getEnvBigInt(PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_COST, DEFAULTS.maxGasCost),
    dailyLimitPerSender: getEnvBigInt(
      PAYMASTER_ENV_VARS.DEFAULT_DAILY_LIMIT_PER_SENDER,
      DEFAULTS.dailyLimitPerSender
    ),
    globalDailyLimit: getEnvBigInt(
      PAYMASTER_ENV_VARS.DEFAULT_GLOBAL_DAILY_LIMIT,
      DEFAULTS.globalDailyLimit
    ),
  }
}

/**
 * Settlement configuration
 */
export function getSettlementConfig() {
  const bundlerRpcUrl = getEnvOptional(PAYMASTER_ENV_VARS.BUNDLER_RPC_URL)
  const settlementEnabled = getEnvOptional(PAYMASTER_ENV_VARS.SETTLEMENT_ENABLED)
  return {
    bundlerRpcUrl,
    settlementPollMs: getEnvNumber(PAYMASTER_ENV_VARS.SETTLEMENT_POLL_MS, 15_000),
    settlementEnabled: settlementEnabled !== undefined
      ? getEnvBool(PAYMASTER_ENV_VARS.SETTLEMENT_ENABLED, true)
      : !!bundlerRpcUrl,
  }
}

/**
 * Deposit monitoring configuration
 */
export function getDepositMonitorConfig() {
  return {
    depositMonitorEnabled: getEnvBool(PAYMASTER_ENV_VARS.DEPOSIT_MONITOR_ENABLED, true),
    depositMonitorPollMs: getEnvNumber(PAYMASTER_ENV_VARS.DEPOSIT_MONITOR_POLL_MS, 30_000),
    depositMinThreshold: getEnvBigInt(PAYMASTER_ENV_VARS.DEPOSIT_MIN_THRESHOLD, 10n ** 16n), // 0.01 ETH
    depositRejectOnLow: getEnvBool(PAYMASTER_ENV_VARS.DEPOSIT_REJECT_ON_LOW, false),
  }
}

/**
 * Time range validation configuration
 */
export function getTimeRangeConfig() {
  return {
    maxValiditySeconds: getEnvNumber(PAYMASTER_ENV_VARS.MAX_VALIDITY_SECONDS, 86_400), // 24 hours
    minValiditySeconds: getEnvNumber(PAYMASTER_ENV_VARS.MIN_VALIDITY_SECONDS, 30), // 30 seconds
  }
}

/**
 * Auto-deposit configuration
 */
export function getAutoDepositConfig() {
  return {
    autoDepositEnabled: getEnvBool(PAYMASTER_ENV_VARS.DEPOSIT_AUTO_ENABLED, false),
    autoDepositAmount: getEnvBigInt(PAYMASTER_ENV_VARS.DEPOSIT_AUTO_AMOUNT, 10n ** 17n), // 0.1 ETH
    autoDepositCooldownMs: getEnvNumber(PAYMASTER_ENV_VARS.DEPOSIT_AUTO_COOLDOWN_MS, 300_000), // 5 minutes
  }
}

/**
 * Reservation persistence configuration
 */
export function getReservationPersistenceConfig() {
  return {
    dataDir: getEnvOptional(PAYMASTER_ENV_VARS.RESERVATION_DATA_DIR),
  }
}

/**
 * Block Number Mode — EIP-4337 flags bit 47.
 * When set, validUntil/validAfter are interpreted as block numbers instead of timestamps.
 * TODO: PoC does not implement block number mode; requires PublicClient.getBlockNumber()
 *       at validation time. Add support when on-chain validation is needed.
 */
export const FLAGS_BLOCK_NUMBER_MODE = 1 << 47

/**
 * Print environment variable usage help
 */
export function getPaymasterEnvHelp(): string {
  return `
Paymaster Proxy Configuration Environment Variables:

Server:
  ${PAYMASTER_ENV_VARS.PORT}                           RPC server port (default: 4338)
  ${PAYMASTER_ENV_VARS.DEBUG}                          Enable debug mode (default: false)
  ${PAYMASTER_ENV_VARS.SPONSOR_NAME}                   Sponsor name in responses (default: StableNet Paymaster)
  ${PAYMASTER_ENV_VARS.SUPPORTED_CHAIN_IDS}            Supported chain IDs, comma-separated (default: 8283,1,11155111,84532)
  ${PAYMASTER_ENV_VARS.SUPPORTED_ENTRY_POINTS}         Supported EntryPoint addresses, comma-separated (default: 0xEf6817fe73741A8F10088f9511c64b666a338A14)

Signer:
  ${PAYMASTER_ENV_VARS.VALIDITY_SECONDS}               Signature validity in seconds (default: 300 = 5 minutes)
  ${PAYMASTER_ENV_VARS.CLOCK_SKEW_SECONDS}             Allowed clock skew in seconds (default: 60)

Policy Defaults:
  ${PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_LIMIT}          Max gas limit per operation (default: 5000000)
  ${PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_COST}           Max gas cost in wei (default: 1000000000000000000 = 1 ETH)
  ${PAYMASTER_ENV_VARS.DEFAULT_DAILY_LIMIT_PER_SENDER} Daily limit per sender in wei (default: 100000000000000000 = 0.1 ETH)
  ${PAYMASTER_ENV_VARS.DEFAULT_GLOBAL_DAILY_LIMIT}     Global daily limit in wei (default: 10000000000000000000 = 10 ETH)

Multi-Paymaster Addresses (optional, overrides PAYMASTER_ADDRESS for specific types):
  ${PAYMASTER_ENV_VARS.VERIFYING_PAYMASTER_ADDRESS}    VerifyingPaymaster contract address
  ${PAYMASTER_ENV_VARS.ERC20_PAYMASTER_ADDRESS}        ERC20Paymaster contract address
  ${PAYMASTER_ENV_VARS.PERMIT2_PAYMASTER_ADDRESS}      Permit2Paymaster contract address
  ${PAYMASTER_ENV_VARS.SPONSOR_PAYMASTER_ADDRESS}      SponsorPaymaster contract address

Contract Addresses (for ERC-20 token support):
  ${PAYMASTER_ENV_VARS.PRICE_ORACLE_ADDRESS}           PriceOracle contract address
  ${PAYMASTER_ENV_VARS.PERMIT2_CONTRACT_ADDRESS}       Permit2 contract address (Uniswap Permit2)

Settlement (receipt-based, Phase 2):
  ${PAYMASTER_ENV_VARS.BUNDLER_RPC_URL}                Bundler RPC URL (enables settlement when set)
  ${PAYMASTER_ENV_VARS.SETTLEMENT_POLL_MS}             Polling interval in ms (default: 15000)
  ${PAYMASTER_ENV_VARS.SETTLEMENT_ENABLED}             Explicitly enable/disable settlement (default: true when BUNDLER_RPC_URL is set)

Deposit Monitoring:
  ${PAYMASTER_ENV_VARS.DEPOSIT_MONITOR_ENABLED}        Enable deposit monitoring (default: true)
  ${PAYMASTER_ENV_VARS.DEPOSIT_MONITOR_POLL_MS}        Polling interval in ms (default: 30000)
  ${PAYMASTER_ENV_VARS.DEPOSIT_MIN_THRESHOLD}          Min deposit threshold in wei (default: 10000000000000000 = 0.01 ETH)
  ${PAYMASTER_ENV_VARS.DEPOSIT_REJECT_ON_LOW}          Reject signing when deposit is low (default: false)

Auto-Deposit:
  ${PAYMASTER_ENV_VARS.DEPOSIT_AUTO_ENABLED}           Enable auto-deposit when balance is low (default: false)
  ${PAYMASTER_ENV_VARS.DEPOSIT_AUTO_AMOUNT}            Auto-deposit amount in wei (default: 100000000000000000 = 0.1 ETH)
  ${PAYMASTER_ENV_VARS.DEPOSIT_AUTO_COOLDOWN_MS}       Cooldown between auto-deposits in ms (default: 300000 = 5 min)

Time Range Validation:
  ${PAYMASTER_ENV_VARS.MAX_VALIDITY_SECONDS}           Max validity window in seconds (default: 86400 = 24h)
  ${PAYMASTER_ENV_VARS.MIN_VALIDITY_SECONDS}           Min validity window in seconds (default: 30)

Reservation Persistence:
  ${PAYMASTER_ENV_VARS.RESERVATION_DATA_DIR}           Directory for reservation JSON persistence (disabled if not set)
`.trim()
}
