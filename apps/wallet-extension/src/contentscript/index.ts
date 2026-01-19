/**
 * StableNet Wallet Content Script
 *
 * This script runs in the context of web pages and acts as a bridge
 * between the inpage provider and the background service worker.
 */

import type { ExtensionMessage } from '../types'
import { MESSAGE_TYPES } from '../shared/constants'

// Inject the inpage script into the page
injectScript()

// Set up message relay between page and background
setupMessageRelay()

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

// Log that content script is loaded
const hostname = window.location.hostname
if (hostname && hostname !== 'localhost' && !hostname.includes('chrome')) {
  // Content script loaded
}
