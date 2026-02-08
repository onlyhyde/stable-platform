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
} as const

/**
 * Default values
 */
const DEFAULTS = {
  port: 4338,
  debug: false,
  sponsorName: 'StableNet Paymaster',
  validitySeconds: 3600, // 1 hour
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

Signer:
  ${PAYMASTER_ENV_VARS.VALIDITY_SECONDS}               Signature validity in seconds (default: 3600 = 1 hour)
  ${PAYMASTER_ENV_VARS.CLOCK_SKEW_SECONDS}             Allowed clock skew in seconds (default: 60)

Policy Defaults:
  ${PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_LIMIT}          Max gas limit per operation (default: 5000000)
  ${PAYMASTER_ENV_VARS.DEFAULT_MAX_GAS_COST}           Max gas cost in wei (default: 1000000000000000000 = 1 ETH)
  ${PAYMASTER_ENV_VARS.DEFAULT_DAILY_LIMIT_PER_SENDER} Daily limit per sender in wei (default: 100000000000000000 = 0.1 ETH)
  ${PAYMASTER_ENV_VARS.DEFAULT_GLOBAL_DAILY_LIMIT}     Global daily limit in wei (default: 10000000000000000000 = 10 ETH)
`.trim()
}
