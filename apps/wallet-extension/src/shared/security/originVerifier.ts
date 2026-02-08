/**
 * Origin Verifier (SEC-3)
 *
 * Centralizes origin verification for Chrome extension messaging.
 * Origin is derived from chrome.runtime.MessageSender, NEVER from
 * message.origin which can be spoofed by malicious content scripts.
 *
 * Priority:
 * 1. sender.tab.url - Content script messages (most common for dApps)
 * 2. sender.origin  - Popup and extension page messages
 * 3. 'extension'    - Internal messages without explicit origin
 */

/**
 * Resolved origin with metadata
 */
export interface ResolvedOrigin {
  /** The resolved origin string (e.g., 'https://example.com' or 'extension') */
  origin: string

  /** Whether this is an internal extension message */
  isExtension: boolean

  /** The tab ID if available */
  tabId?: number

  /** Whether the origin is a valid external origin (http/https) */
  isValidExternal: boolean
}

/**
 * Extract origin from a URL string.
 * Returns empty string for invalid URLs.
 */
export function originFromUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    // Node.js returns 'null' for non-standard protocols (chrome-extension://)
    // Chrome browser handles them correctly, so fallback to protocol + host
    if (parsed.origin === 'null' && parsed.protocol && parsed.host) {
      return `${parsed.protocol}//${parsed.host}`
    }
    return parsed.origin
  } catch {
    return ''
  }
}

/**
 * Resolve the trusted origin from a Chrome extension MessageSender.
 *
 * This is the ONLY correct way to determine message origin.
 * Never trust message.origin or any field inside the message payload.
 */
export function resolveOrigin(sender: chrome.runtime.MessageSender): ResolvedOrigin {
  let origin: string
  let isExtension = false
  const tabId = sender.tab?.id

  if (sender.tab?.url) {
    // Content script: derive origin from the tab's actual URL (chrome.tabs API)
    const tabOrigin = originFromUrl(sender.tab.url)

    // Approval popup windows (chrome.windows.create) have sender.tab set
    // with chrome-extension:// URLs - treat as internal
    if (tabOrigin.startsWith('chrome-extension://')) {
      origin = 'extension'
      isExtension = true
    } else {
      origin = tabOrigin
    }
  } else if (sender.origin) {
    // Popup and extension pages have chrome-extension:// origin
    if (sender.origin.startsWith('chrome-extension://')) {
      origin = 'extension'
      isExtension = true
    } else {
      origin = sender.origin
    }
  } else {
    // No origin info - treat as internal extension message
    origin = 'extension'
    isExtension = true
  }

  // Validate origin format for external requests
  const isValidExternal =
    !isExtension && (origin.startsWith('http://') || origin.startsWith('https://'))

  if (!isExtension && !isValidExternal) {
    origin = 'unknown'
  }

  return { origin, isExtension, tabId, isValidExternal }
}

/**
 * Check if a resolved origin should be allowed to make RPC requests.
 * Extension pages are always allowed. External origins must be http(s).
 */
export function isOriginAllowed(resolved: ResolvedOrigin): boolean {
  return resolved.isExtension || resolved.isValidExternal
}
