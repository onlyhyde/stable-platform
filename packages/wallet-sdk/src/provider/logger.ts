/**
 * Namespaced logger factory for wallet-sdk.
 *
 * Each module creates its own logger with a namespace prefix
 * (e.g., [wallet-sdk:Connection]) for easy filtering in dev tools.
 */

let silent = false

export function setLoggerSilent(value: boolean): void {
  silent = value
}

export interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export function createLogger(namespace: string): Logger {
  const prefix = `[wallet-sdk:${namespace}]`

  return {
    debug(...args: unknown[]) {
      if (!silent) console.debug(prefix, ...args)
    },
    info(...args: unknown[]) {
      if (!silent) console.info(prefix, ...args)
    },
    warn(...args: unknown[]) {
      if (!silent) console.warn(prefix, ...args)
    },
    error(...args: unknown[]) {
      if (!silent) console.error(prefix, ...args)
    },
  }
}
