/**
 * Structured logger for wallet extension
 * Only logs in development mode to prevent information leakage in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const isDev = process.env.NODE_ENV === 'development'

/**
 * Creates a namespaced logger for a specific component/module
 * @param namespace - The component or module name (e.g., 'GasFeeController', 'Background')
 */
export function createLogger(namespace: string) {
  const formatMessage = (level: LogLevel, message: string, context?: LogContext): string => {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}${contextStr}`
  }

  return {
    /**
     * Debug level logging - for detailed debugging information
     * Only logged in development mode
     */
    debug(message: string, context?: LogContext): void {
      if (isDev) {
        console.debug(formatMessage('debug', message, context))
      }
    },

    /**
     * Info level logging - for general information
     * Only logged in development mode
     */
    info(message: string, context?: LogContext): void {
      if (isDev) {
        console.info(formatMessage('info', message, context))
      }
    },

    /**
     * Warn level logging - for warnings
     * Only logged in development mode
     */
    warn(message: string, context?: LogContext): void {
      if (isDev) {
        console.warn(formatMessage('warn', message, context))
      }
    },

    /**
     * Error level logging - for errors
     * Only logged in development mode to prevent information leakage
     * Consider using error reporting service in production
     */
    error(message: string, error?: unknown, context?: LogContext): void {
      if (isDev) {
        const errorContext =
          error instanceof Error
            ? { ...context, errorMessage: error.message, errorStack: error.stack }
            : { ...context, error }
        console.error(formatMessage('error', message, errorContext))
      }
    },
  }
}

/**
 * Default logger for one-off logging needs
 * Prefer createLogger() for components with multiple log statements
 */
export const logger = createLogger('App')
