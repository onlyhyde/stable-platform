import pino from 'pino'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function createLogger(level: LogLevel = 'info', pretty = true) {
  return pino({
    name: 'registry',
    level,
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
    redact: {
      paths: ['apiKey', 'secret', 'password', 'authorization'],
      censor: '[REDACTED]',
    },
  })
}

export type Logger = ReturnType<typeof createLogger>

let globalLogger: Logger | null = null

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger(
      (process.env.LOG_LEVEL as LogLevel) || 'info',
      process.env.NODE_ENV !== 'production'
    )
  }
  return globalLogger
}
