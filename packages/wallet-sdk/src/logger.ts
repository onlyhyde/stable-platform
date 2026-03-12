/**
 * Legacy logger export for backward compatibility.
 * New code should use createLogger() from ./provider/logger.ts instead.
 */
import { createLogger, setLoggerSilent } from './provider/logger'

const logger = createLogger('SDK')

export const walletSdkLogger = {
  get silent() {
    return false
  },
  set silent(value: boolean) {
    setLoggerSilent(value)
  },

  warn(...args: unknown[]) {
    logger.warn(...args)
  },

  error(...args: unknown[]) {
    logger.error(...args)
  },
}
