const PREFIX = '[wallet-sdk]'

/**
 * Internal logger for wallet-sdk.
 * Outputs to console with a [wallet-sdk] prefix.
 * Can be silenced via `walletSdkLogger.silent = true`.
 */
export const walletSdkLogger = {
  silent: false,

  warn(...args: unknown[]) {
    if (!this.silent) console.warn(PREFIX, ...args)
  },

  error(...args: unknown[]) {
    if (!this.silent) console.error(PREFIX, ...args)
  },
}
