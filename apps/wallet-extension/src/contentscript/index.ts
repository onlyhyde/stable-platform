/**
 * StableNet Wallet Content Script
 *
 * This script runs in the context of web pages and acts as a bridge
 * between the inpage provider and the background service worker.
 *
 * Security: Uses chrome.storage.local instead of window.localStorage
 * to prevent page scripts from reading/modifying wallet settings.
 */

import { MESSAGE_TYPES, RPC_ERRORS } from '../shared/constants'
import { validatePostMessageEnvelope } from '../shared/validation/messageSchema'
import type { ExtensionMessage } from '../types'

// CRITICAL: Inject inpage script SYNCHRONOUSLY at document_start
// to ensure provider is available before any page scripts execute.
// This fixes the race condition where wagmi's EIP-6963 discovery
// could complete before our provider is injected.
injectScript(false) // Inject immediately with default settings
setupMessageRelay()
listenForModeChanges()

// Then asynchronously check MetaMask mode and update if needed
getMetaMaskMode()
  .then((enabled) => {
    if (enabled) {
      // Send message to inpage script to update MetaMask mode
      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: {
            type: 'METAMASK_MODE_CHANGED',
            payload: { enabled: true },
          },
        },
        window.location.origin
      )
    }
  })
  .catch(() => {
    // Ignore errors - script is already injected with default settings
  })

/**
 * Get MetaMask mode from chrome.storage.local
 * SEC-2: Use chrome.storage instead of localStorage for security
 */
async function getMetaMaskMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('stablenet_metamask_mode')
    return (result.stablenet_metamask_mode as boolean | undefined) ?? false
  } catch {
    return false
  }
}

/**
 * Inject the inpage script into the page with configuration
 * SEC-2: Pass settings via data attribute instead of localStorage
 */
function injectScript(metamaskModeEnabled: boolean): void {
  try {
    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('inpage.js')
    script.async = false
    // Pass configuration via data attribute (read-only from page perspective)
    script.dataset.stablenetConfig = JSON.stringify({
      metamaskMode: metamaskModeEnabled,
    })
    ;(document.head || document.documentElement).appendChild(script)
    script.remove()
  } catch {
    // Injection might fail on some pages
  }
}

/**
 * Set up bidirectional message relay
 */
function setupMessageRelay(): void {
  // Listen for messages from the inpage script
  window.addEventListener('message', async (event) => {
    // Only accept messages from the same window
    if (event.source !== window) return

    // Validate message envelope structure (target + well-formed ExtensionMessage)
    const validated = validatePostMessageEnvelope(event.data)
    if (!validated) return

    const message = validated.data

    try {
      // Forward to background - origin is derived from sender.tab.url (SEC-3)
      // Do NOT attach origin here; the background uses chrome.runtime.MessageSender
      const response = await chrome.runtime.sendMessage(message)

      // Send response back to inpage
      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: response,
        },
        window.location.origin
      )
    } catch (error) {
      // Preserve original RPC error code if present (e.g., user rejection = 4001)
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code: number }).code
          : RPC_ERRORS.INTERNAL_ERROR.code
      const errorMessage =
        error instanceof Error ? error.message : RPC_ERRORS.INTERNAL_ERROR.message

      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: {
            type: MESSAGE_TYPES.RPC_RESPONSE,
            id: message.id,
            payload: {
              error: {
                code: errorCode,
                message: errorMessage,
              },
            },
          },
        },
        window.location.origin
      )
    }
  })

  // Listen for messages from background (state updates, events)
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    // Forward to inpage
    window.postMessage(
      {
        target: 'stablenet-inpage',
        data: message,
      },
      window.location.origin
    )
  })
}

/**
 * Listen for MetaMask mode changes from background
 * When changed, notify the inpage script to update dynamically
 * SEC-2: Removed localStorage usage - settings are passed via postMessage only
 */
function listenForModeChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.stablenet_metamask_mode) {
      const newValue = changes.stablenet_metamask_mode.newValue ?? false

      // Send message to inpage script to update dynamically (no page refresh needed)
      // SEC-2: Use postMessage instead of localStorage for secure communication
      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: {
            type: 'METAMASK_MODE_CHANGED',
            payload: { enabled: newValue },
          },
        },
        window.location.origin
      )

      // Also dispatch custom event for dApps that want to listen
      window.dispatchEvent(
        new CustomEvent('stablenet:metamaskModeChanged', {
          detail: { enabled: newValue, requiresReload: false },
        })
      )
    }
  })
}
