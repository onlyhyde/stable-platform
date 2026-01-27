import type { LogLevel } from '../utils/logger'

export interface RegistryConfig {
  readonly port: number
  readonly dataDir: string
  readonly watchDir?: string
  readonly apiKey?: string
  readonly logLevel: LogLevel
  readonly pretty: boolean
}

const ENV_VARS = {
  PORT: ['REGISTRY_PORT', 'PORT'],
  DATA_DIR: ['REGISTRY_DATA_DIR'],
  WATCH_DIR: ['REGISTRY_WATCH_DIR'],
  API_KEY: ['REGISTRY_API_KEY'],
  LOG_LEVEL: ['REGISTRY_LOG_LEVEL', 'LOG_LEVEL'],
} as const

function getEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value !== '') {
      return value
    }
  }
  return undefined
}

function getEnvNumber(names: readonly string[]): number | undefined {
  const value = getEnv(names)
  if (value === undefined) return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

export interface CliOptions {
  readonly port?: number
  readonly dataDir?: string
  readonly watchDir?: string
  readonly apiKey?: string
  readonly logLevel?: string
  readonly pretty?: boolean
}

export function parseConfig(options: CliOptions): RegistryConfig {
  return {
    port: options.port ?? getEnvNumber(ENV_VARS.PORT) ?? 4400,
    dataDir: options.dataDir ?? getEnv(ENV_VARS.DATA_DIR) ?? './data',
    watchDir: options.watchDir ?? getEnv(ENV_VARS.WATCH_DIR),
    apiKey: options.apiKey ?? getEnv(ENV_VARS.API_KEY),
    logLevel: (options.logLevel ?? getEnv(ENV_VARS.LOG_LEVEL) ?? 'info') as LogLevel,
    pretty: options.pretty ?? process.env.NODE_ENV !== 'production',
  }
}

export function getEnvHelp(): string {
  return `
Environment Variables:
  ${ENV_VARS.PORT.join(' or ')}          Server port (default: 4400)
  ${ENV_VARS.DATA_DIR.join(' or ')}      Data directory for JSON persistence (default: ./data)
  ${ENV_VARS.WATCH_DIR.join(' or ')}     Foundry broadcast directory to watch
  ${ENV_VARS.API_KEY.join(' or ')}       API key for write operations
  ${ENV_VARS.LOG_LEVEL.join(' or ')}     Log level: debug, info, warn, error (default: info)

Priority: CLI arguments > Environment variables > Defaults
`.trim()
}
