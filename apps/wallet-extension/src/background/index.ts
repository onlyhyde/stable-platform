/**
 * StableNet Wallet Background Service Worker
 *
 * This is the main entry point for the Chrome Extension background script.
 * It handles:
 * - RPC requests from dApps
 * - State management
 * - Communication with content scripts and popup
 */

import { walletState } from './state/store'
import { handleRpcRequest } from './rpc/handler'
import { accountController } from './controller/accountController'
import { networkController } from './controller/networkController'
import type { ExtensionMessage, JsonRpcRequest } from '../types'
import { MESSAGE_TYPES } from '../shared/constants'

// Initialize state on startup
walletState.initialize().catch(() => {
  // Silent initialization error
})

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: message.id,
        payload: {
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        },
      })
    })

  // Return true to indicate async response
  return true
})

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionMessage> {
  const origin = message.origin ?? sender.origin ?? 'unknown'

  switch (message.type) {
    case MESSAGE_TYPES.RPC_REQUEST: {
      const request = message.payload as JsonRpcRequest
      const response = await handleRpcRequest(request, origin)

      return {
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: message.id,
        payload: response,
      }
    }

    case MESSAGE_TYPES.CONNECT_REQUEST: {
      // Handle connection request from popup or content script
      const accounts = walletState.getState().accounts.accounts.map((a) => a.address)

      if (accounts.length === 0) {
        return {
          type: MESSAGE_TYPES.CONNECT_RESPONSE,
          id: message.id,
          payload: { accounts: [], error: 'No accounts available' },
        }
      }

      // Auto-approve connection (in production, show popup for user approval)
      await walletState.addConnectedSite({
        origin,
        accounts,
        permissions: ['eth_accounts'],
        connectedAt: Date.now(),
      })

      return {
        type: MESSAGE_TYPES.CONNECT_RESPONSE,
        id: message.id,
        payload: { accounts },
      }
    }

    case MESSAGE_TYPES.DISCONNECT: {
      await walletState.removeConnectedSite(origin)

      return {
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: message.id,
        payload: { success: true },
      }
    }

    case MESSAGE_TYPES.STATE_UPDATE: {
      // Return current state
      return {
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: message.id,
        payload: walletState.getState(),
      }
    }

    default:
      return {
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: message.id,
        payload: {
          error: {
            code: -32600,
            message: 'Unknown message type',
          },
        },
      }
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    // Could open onboarding page here
  }
})

/**
 * Handle popup opened
 */
chrome.action.onClicked.addListener(() => {
  // Popup is configured in manifest, this is a fallback
})

/**
 * Broadcast state changes to all connected tabs
 */
walletState.subscribe((state) => {
  // Broadcast to all connected sites
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.STATE_UPDATE,
          id: `state-${Date.now()}`,
          payload: {
            chainId: networkController.getChainIdHex(),
            accounts: state.connections.connectedSites.flatMap((s) => s.accounts),
          },
        }).catch(() => {
          // Tab might not have content script loaded
        })
      }
    }
  })
})

// Export controllers for popup communication
export { accountController, networkController, walletState }
