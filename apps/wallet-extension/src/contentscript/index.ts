/**
 * StableNet Wallet Content Script
 *
 * This script runs in the context of web pages and acts as a bridge
 * between the inpage provider and the background service worker.
 *
 * Security: Uses chrome.storage.local instead of window.localStorage
 * to prevent page scripts from reading/modifying wallet settings.
 */

import type { ExtensionMessage } from '../types'
import { MESSAGE_TYPES } from '../shared/constants'

// Get MetaMask mode setting and inject inpage script
getMetaMaskMode()
  .then((enabled) => {
    // Inject the inpage script with settings via data attribute
    injectScript(enabled)

    // Set up message relay between page and background
    setupMessageRelay()

    // Listen for MetaMask mode changes from background
    listenForModeChanges()
  })
  .catch(() => {
    // Still inject scripts even if fetch fails, using default settings
    injectScript(false)
    setupMessageRelay()
    listenForModeChanges()
  })

/**
 * Get MetaMask mode from chrome.storage.local
 * SEC-2: Use chrome.storage instead of localStorage for security
 */
async function getMetaMaskMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('stablenet_metamask_mode')
    return result.stablenet_metamask_mode ?? false
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

    // Only handle StableNet provider messages
    if (event.data?.target !== 'stablenet-contentscript') return

    const message = event.data.data as ExtensionMessage

    try {
      // Forward to background
      const response = await chrome.runtime.sendMessage({
        ...message,
        origin: window.location.origin,
      })

      // Send response back to inpage
      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: response,
        },
        window.location.origin
      )
    } catch (error) {
      // Send error response
      window.postMessage(
        {
          target: 'stablenet-inpage',
          data: {
            type: MESSAGE_TYPES.RPC_RESPONSE,
            id: message.id,
            payload: {
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal error',
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
