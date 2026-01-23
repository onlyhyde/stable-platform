/**
 * StableNet Wallet Content Script
 *
 * This script runs in the context of web pages and acts as a bridge
 * between the inpage provider and the background service worker.
 */

import type { ExtensionMessage } from '../types'
import { MESSAGE_TYPES } from '../shared/constants'

// Sync MetaMask mode setting before injecting inpage script
syncMetaMaskMode().then(() => {
  // Inject the inpage script into the page
  injectScript()

  // Set up message relay between page and background
  setupMessageRelay()

  // Listen for MetaMask mode changes from background
  listenForModeChanges()
})

/**
 * Sync MetaMask mode from chrome.storage to localStorage
 * This must happen BEFORE the inpage script is injected
 */
async function syncMetaMaskMode(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('stablenet_metamask_mode')
    const enabled = result.stablenet_metamask_mode ?? false

    // Sync to localStorage so inpage script can read it
    // (inpage runs in page context and can't access chrome.storage)
    window.localStorage.setItem('__stablenetAppearAsMM__', JSON.stringify(enabled))
  } catch {
    // If sync fails, use default (false)
    window.localStorage.setItem('__stablenetAppearAsMM__', 'false')
  }
}

/**
 * Inject the inpage script into the page
 */
function injectScript(): void {
  try {
    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('inpage.js')
    script.async = false
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
 * When changed, notify the page that a reload is needed
 */
function listenForModeChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.stablenet_metamask_mode) {
      const newValue = changes.stablenet_metamask_mode.newValue ?? false

      // Update localStorage for next page load
      window.localStorage.setItem('__stablenetAppearAsMM__', JSON.stringify(newValue))

      // Notify the page that MetaMask mode has changed
      // dApps can listen to this custom event if they want to handle it
      window.dispatchEvent(
        new CustomEvent('stablenet:metamaskModeChanged', {
          detail: { enabled: newValue, requiresReload: true },
        })
      )
    }
  })
}
