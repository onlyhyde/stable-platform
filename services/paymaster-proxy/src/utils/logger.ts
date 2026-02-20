import pino from 'pino'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  level?: LogLevel
  pretty?: boolean
  name?: string
}

/**
 * Create a structured logger instance using pino
 *
 * @param options - Logger configuration options
 * @returns Configured pino logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger({ level: 'debug', name: 'PaymasterProxy' })
 * logger.info({ requestId: '123' }, 'Processing request')
 * ```
 */
export function createLogger(options: LoggerOptions = {}) {
  const { level = 'info', pretty = true, name = 'paymaster-proxy' } = options

  return pino({
    level,
    base: { service: name, version: '1.0.0' },
    transport: pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Redact sensitive fields
    redact: {
      paths: ['signerPrivateKey', 'privateKey', 'secret', 'password', 'authorization'],
      censor: '[REDACTED]',
    },
  })
}

export type Logger = ReturnType<typeof createLogger>

/**
 * Global logger instance for early initialization logging
 * Use createLogger() for component-specific logging with custom options
 */
let globalLogger: Logger | null = null

/**
 * Get or create the global logger instance
 * Used for logging before component-specific loggers are created
 */
export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger({
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      pretty: process.env.NODE_ENV !== 'production',
    })
  }
  return globalLogger
}

/**
 * Create a child logger with additional context
 *
 * @example
 * ```ts
 * const logger = createLogger()
 * const requestLogger = createChildLogger(logger, { requestId: '123', method: 'pm_getPaymasterData' })
 * requestLogger.info('Processing paymaster request')
 * ```
 */
export function createChildLogger(parent: Logger, context: Record<string, unknown>): Logger {
  return parent.child(context)
}
