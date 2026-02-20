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
 * @param level - Log level (debug, info, warn, error)
 * @param pretty - Whether to use pretty printing (default: true)
 * @returns Configured pino logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger('debug', true)
 * logger.info({ userOp: '0x...' }, 'Processing UserOperation')
 * ```
 */
export function createLogger(level: LogLevel = 'info', pretty = true) {
  return pino({
    level,
    base: { service: 'bundler', version: '1.0.0' },
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
      paths: ['privateKey', 'secret', 'password', 'authorization', 'mnemonic'],
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
    globalLogger = createLogger(
      (process.env.LOG_LEVEL as LogLevel) || 'info',
      process.env.NODE_ENV !== 'production'
    )
  }
  return globalLogger
}

/**
 * Create a child logger with additional context
 *
 * @example
 * ```ts
 * const logger = createLogger()
 * const opLogger = createChildLogger(logger, { userOpHash: '0x123...', sender: '0xabc...' })
 * opLogger.info('UserOperation validated')
 * ```
 */
export function createChildLogger(parent: Logger, context: Record<string, unknown>): Logger {
  return parent.child(context)
}
