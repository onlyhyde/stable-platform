import pino from 'pino'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Create a logger instance
 */
export function createLogger(level: LogLevel = 'info', pretty = true) {
  return pino({
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
  })
}

export type Logger = ReturnType<typeof createLogger>
