/**
 * Chrome Extension messaging utilities with timeout protection.
 *
 * chrome.runtime.sendMessage can hang forever if the background service worker
 * fails to call sendResponse (e.g. BigInt serialization failure, crash, etc.).
 * These helpers wrap every message call with a timeout to guarantee the UI
 * never gets stuck in a loading state.
 */

/** Timeout for state sync operations (popup open, background sync) */
export const SYNC_TIMEOUT_MS = 10_000

/** Timeout for transaction-related operations (send, sign, approve) */
export const TX_TIMEOUT_MS = 60_000

/**
 * Send a chrome.runtime message with a timeout guarantee.
 * Rejects with an Error if the background does not respond within `timeoutMs`.
 */
export function sendMessageWithTimeout<T>(message: unknown, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Message timed out'))
    }, timeoutMs)

    chrome.runtime
      .sendMessage(message)
      .then((response) => {
        clearTimeout(timer)
        resolve(response as T)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}
