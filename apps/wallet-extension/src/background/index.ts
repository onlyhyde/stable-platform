/**
 * StableNet Wallet Background Service Worker
 *
 * This is the main entry point for the Chrome Extension background script.
 * It handles:
 * - RPC requests from dApps
 * - State management
 * - Communication with content scripts and popup
 * - Tab subscription management (Frame feature)
 * - Dynamic icon state (Frame feature)
 * - Auto-lock with idle detection (Frame feature)
 */

import { walletState } from './state/store'
import { handleRpcRequest } from './rpc/handler'
import { accountController } from './controller/accountController'
import { networkController } from './controller/networkController'
import { keyringController } from './keyring'
import { approvalController } from './controllers/approvalController'
import type { ExtensionMessage, JsonRpcRequest } from '../types'
import type { Address, Hex } from 'viem'
import { MESSAGE_TYPES } from '../shared/constants'
import { createLogger } from '../shared/utils/logger'
import { getSecurityConfig, STORAGE_KEYS } from '../config'

const logger = createLogger('Background')

// =============================================================================
// Tab Subscription Management
// =============================================================================

interface TabSubscription {
  tabId: number
  subscriptionId: string
  type: string
}

interface PendingRequest {
  tabId: number
  payloadId: string
  method: string
  params?: unknown
  origin: string
}

// Track subscriptions and pending requests per tab
const tabSubscriptions: Map<string, TabSubscription> = new Map()
const pendingRequests: Map<string, PendingRequest> = new Map()
const tabOrigins: Map<number, string> = new Map()

/**
 * Get origin from URL
 */
function originFromUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const urlObj = new URL(url)
    return urlObj.origin
  } catch {
    return ''
  }
}

/**
 * Unsubscribe all subscriptions for a tab
 */
function unsubscribeTab(tabId: number): void {
  // Remove pending requests for this tab
  for (const [id, request] of pendingRequests.entries()) {
    if (request.tabId === tabId) {
      pendingRequests.delete(id)
    }
  }

  // Remove subscriptions for this tab
  for (const [subId, sub] of tabSubscriptions.entries()) {
    if (sub.tabId === tabId) {
      tabSubscriptions.delete(subId)
    }
  }
}

// =============================================================================
// Dynamic Icon State
// =============================================================================

type IconState = 'connected' | 'locked' | 'disconnected' | 'pending'

const ICONS: Record<IconState, Record<string, string>> = {
  connected: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  locked: {
    '16': 'icons/icon-16-locked.png',
    '32': 'icons/icon-32-locked.png',
    '48': 'icons/icon-48-locked.png',
    '128': 'icons/icon-128-locked.png',
  },
  disconnected: {
    '16': 'icons/icon-16-gray.png',
    '32': 'icons/icon-32-gray.png',
    '48': 'icons/icon-48-gray.png',
    '128': 'icons/icon-128-gray.png',
  },
  pending: {
    '16': 'icons/icon-16-pending.png',
    '32': 'icons/icon-32-pending.png',
    '48': 'icons/icon-48-pending.png',
    '128': 'icons/icon-128-pending.png',
  },
}

let currentIconState: IconState = 'disconnected'

/**
 * Set extension icon based on wallet state
 */
async function setIcon(state: IconState): Promise<void> {
  if (currentIconState === state) return
  currentIconState = state

  try {
    // Try to use the specific icon, fallback to default if not found
    await chrome.action.setIcon({ path: ICONS[state] })
  } catch {
    // Fallback to default icons if state-specific icons don't exist
    try {
      await chrome.action.setIcon({
        path: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png',
        },
      })
    } catch {
      // Silent fail
    }
  }
}

/**
 * Update icon based on current wallet state
 */
async function updateIconState(): Promise<void> {
  const keyringState = await keyringController.getAsyncState()
  const state = walletState.getState()
  const pendingTxCount = state.transactions.pendingTransactions.length

  if (pendingTxCount > 0) {
    await setIcon('pending')
    await chrome.action.setBadgeText({ text: String(pendingTxCount) })
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' })
  } else if (!keyringState.isInitialized) {
    await setIcon('disconnected')
    await chrome.action.setBadgeText({ text: '' })
  } else if (!keyringState.isUnlocked) {
    await setIcon('locked')
    await chrome.action.setBadgeText({ text: '' })
  } else {
    await setIcon('connected')
    await chrome.action.setBadgeText({ text: '' })
  }
}

// =============================================================================
// Auto-Lock with Idle Detection
// =============================================================================

let autoLockMinutes = getSecurityConfig().autoLockMinutes
let lastActivityTime = Date.now()

/**
 * Setup auto-lock alarm
 */
async function setupAutoLockAlarm(): Promise<void> {
  // Load saved auto-lock preference
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.AUTO_LOCK_MINUTES)
    if (stored[STORAGE_KEYS.AUTO_LOCK_MINUTES]) {
      autoLockMinutes = stored[STORAGE_KEYS.AUTO_LOCK_MINUTES]
    }
  } catch {
    // Use default
  }

  // Create periodic idle check alarm (every 30 seconds)
  const existingAlarm = await chrome.alarms.get(STORAGE_KEYS.IDLE_CHECK_ALARM)
  if (!existingAlarm) {
    await chrome.alarms.create(STORAGE_KEYS.IDLE_CHECK_ALARM, {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5,
    })
  }
}

/**
 * Handle idle state change
 */
async function handleIdleStateChange(newState: chrome.idle.IdleState): Promise<void> {
  if (newState === 'active') {
    // User is active, reset activity time
    lastActivityTime = Date.now()
  } else if (newState === 'idle' || newState === 'locked') {
    // User is idle or screen locked, check if we should auto-lock
    await checkAutoLock()
  }
}

/**
 * Check if wallet should be auto-locked
 */
async function checkAutoLock(): Promise<void> {
  const keyringState = await keyringController.getAsyncState()

  // Only auto-lock if wallet is unlocked
  if (!keyringState.isUnlocked) return

  const idleMinutes = (Date.now() - lastActivityTime) / 1000 / 60

  if (idleMinutes >= autoLockMinutes) {
    // Lock the wallet
    keyringController.lock()
    await walletState.setUnlocked(false)
    await updateIconState()

    // Notify all tabs
    await broadcastStateUpdate()
  }
}

/**
 * Update last activity time (called on user interactions)
 */
function updateLastActivity(): void {
  lastActivityTime = Date.now()
}

/**
 * Set auto-lock timeout
 */
async function setAutoLockTimeout(minutes: number): Promise<void> {
  autoLockMinutes = minutes
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_LOCK_MINUTES]: minutes })
}

// =============================================================================
// Tab Event Listeners
// =============================================================================

/**
 * Initialize tab tracking
 */
async function initializeTabTracking(): Promise<void> {
  // Query for all existing tabs and store their origins
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id && tab.url) {
      tabOrigins.set(tab.id, originFromUrl(tab.url))
    }
  }
}

/**
 * Handle tab removed
 */
function handleTabRemoved(tabId: number): void {
  tabOrigins.delete(tabId)
  unsubscribeTab(tabId)
}

/**
 * Handle tab updated (URL change)
 */
function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo
): void {
  if (changeInfo.url) {
    const newOrigin = originFromUrl(changeInfo.url)
    const oldOrigin = tabOrigins.get(tabId)

    if (oldOrigin !== newOrigin) {
      tabOrigins.set(tabId, newOrigin)
      // Origin changed, unsubscribe from old origin
      unsubscribeTab(tabId)
    }
  }
}

/**
 * Handle tab activated
 */
async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
  updateLastActivity()

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    const origin = originFromUrl(tab.url)

    if (origin.startsWith('http') || origin.startsWith('file')) {
      // Request chain ID from the tab to update icon
      chrome.tabs.sendMessage(activeInfo.tabId, {
        type: 'embedded:action',
        action: { type: 'getChainId' },
      }).catch(() => {
        // Tab might not have content script loaded
      })
    }
  } catch {
    // Tab might not exist
  }
}

// =============================================================================
// Message Handling
// =============================================================================

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // Update last activity time on any message
  updateLastActivity()

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
  const origin = message.origin ?? sender.origin ?? originFromUrl(sender.tab?.url) ?? 'unknown'
  const tabId = sender.tab?.id

  switch (message.type) {
    case MESSAGE_TYPES.RPC_REQUEST: {
      const request = message.payload as JsonRpcRequest

      // Track pending request if from a tab
      if (tabId) {
        pendingRequests.set(message.id, {
          tabId,
          payloadId: String(request.id),
          method: request.method,
          params: request.params,
          origin,
        })
      }

      const response = await handleRpcRequest(request, origin)

      // Handle subscription results
      if (request.method === 'eth_subscribe' && response.result && tabId) {
        const subscriptionId = response.result as string
        tabSubscriptions.set(subscriptionId, {
          tabId,
          subscriptionId,
          type: (request.params?.[0] as string) ?? 'unknown',
        })
      } else if (request.method === 'eth_unsubscribe' && request.params) {
        const subIds = Array.isArray(request.params) ? request.params : [request.params]
        for (const subId of subIds) {
          tabSubscriptions.delete(String(subId))
        }
      }

      // Clean up pending request
      pendingRequests.delete(message.id)

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
      const payload = message.payload as { action?: string; chainId?: number; address?: string } | undefined

      // Handle specific actions
      if (payload?.action === 'selectNetwork' && payload.chainId !== undefined) {
        await walletState.selectNetwork(payload.chainId)
        // Broadcast to all tabs
        await broadcastChainChanged(payload.chainId)
      } else if (payload?.action === 'selectAccount' && payload.address) {
        await walletState.selectAccount(payload.address as `0x${string}`)
      }

      // Return current state
      return {
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: message.id,
        payload: walletState.getState(),
      }
    }

    case 'GET_KEYRING_STATE': {
      const keyringState = await keyringController.getAsyncState()
      return {
        type: 'KEYRING_STATE',
        id: message.id,
        payload: keyringState,
      }
    }

    case 'CREATE_NEW_WALLET': {
      const { password } = message.payload as { password: string }
      const { mnemonic, account } = await keyringController.createNewVault(password)

      // Add account to wallet state
      await walletState.addAccount({
        address: account.address,
        name: account.name ?? 'Account 1',
        type: 'eoa',
        keyringType: 'hd',
        index: account.index,
      })
      await walletState.selectAccount(account.address)
      await walletState.setInitialized(true)
      await walletState.setUnlocked(true)

      // Update icon state
      await updateIconState()

      return {
        type: 'WALLET_CREATED',
        id: message.id,
        payload: { mnemonic, address: account.address },
      }
    }

    case 'RESTORE_WALLET': {
      const { password, mnemonic } = message.payload as { password: string; mnemonic: string }
      const account = await keyringController.restoreFromMnemonic(password, mnemonic)

      // Clear existing accounts and add restored one
      await walletState.clearAccounts()
      await walletState.addAccount({
        address: account.address,
        name: account.name ?? 'Account 1',
        type: 'eoa',
        keyringType: 'hd',
        index: account.index,
      })
      await walletState.selectAccount(account.address)
      await walletState.setInitialized(true)
      await walletState.setUnlocked(true)

      // Update icon state
      await updateIconState()

      return {
        type: 'WALLET_RESTORED',
        id: message.id,
        payload: { address: account.address },
      }
    }

    case 'UNLOCK_WALLET': {
      const { password } = message.payload as { password: string }
      await keyringController.unlock(password)
      await walletState.setUnlocked(true)

      // Update last activity and icon
      updateLastActivity()
      await updateIconState()

      return {
        type: 'WALLET_UNLOCKED',
        id: message.id,
        payload: { success: true },
      }
    }

    case 'LOCK_WALLET': {
      keyringController.lock()
      await walletState.setUnlocked(false)

      // Update icon state
      await updateIconState()

      return {
        type: 'WALLET_LOCKED',
        id: message.id,
        payload: { success: true },
      }
    }

    case 'IMPORT_PRIVATE_KEY': {
      const { privateKey } = message.payload as { privateKey: Hex }
      const account = await keyringController.importPrivateKey(privateKey)

      // Add to wallet state
      await walletState.addAccount({
        address: account.address,
        name: account.name ?? 'Imported Account',
        type: 'eoa',
        keyringType: 'simple',
      })

      return {
        type: 'ACCOUNT_IMPORTED',
        id: message.id,
        payload: { address: account.address },
      }
    }

    case 'ADD_HD_ACCOUNT': {
      const account = await keyringController.addHDAccount()
      const accountName = account.name ?? `Account ${(account.index ?? 0) + 1}`

      // Add to wallet state
      await walletState.addAccount({
        address: account.address,
        name: accountName,
        type: 'eoa',
        keyringType: 'hd',
        index: account.index,
      })

      return {
        type: 'ACCOUNT_ADDED',
        id: message.id,
        payload: { address: account.address, name: accountName },
      }
    }

    case 'GET_MNEMONIC': {
      const mnemonic = keyringController.getMnemonic()
      return {
        type: 'MNEMONIC',
        id: message.id,
        payload: { mnemonic },
      }
    }

    case 'SET_AUTO_LOCK_TIMEOUT': {
      const { minutes } = message.payload as { minutes: number }
      await setAutoLockTimeout(minutes)
      return {
        type: 'AUTO_LOCK_TIMEOUT_SET',
        id: message.id,
        payload: { minutes },
      }
    }

    case 'GET_AUTO_LOCK_TIMEOUT': {
      return {
        type: 'AUTO_LOCK_TIMEOUT',
        id: message.id,
        payload: { minutes: autoLockMinutes },
      }
    }

    case 'SET_METAMASK_MODE': {
      const { enabled } = message.payload as { enabled: boolean }
      await chrome.storage.local.set({ stablenet_metamask_mode: enabled })
      return {
        type: 'METAMASK_MODE_SET',
        id: message.id,
        payload: { enabled },
      }
    }

    case 'GET_METAMASK_MODE': {
      const stored = await chrome.storage.local.get('stablenet_metamask_mode')
      return {
        type: 'METAMASK_MODE',
        id: message.id,
        payload: { enabled: stored.stablenet_metamask_mode ?? false },
      }
    }

    case 'GET_APPROVAL': {
      const { approvalId } = message.payload as { approvalId: string }
      const approval = approvalController.getPendingApproval(approvalId)

      // Also send the current wallet accounts for connection approvals
      const state = walletState.getState()
      const accounts = state.accounts.accounts.map((a) => ({
        address: a.address,
        name: a.name,
      }))
      const selectedAccount = state.accounts.selectedAccount

      return {
        type: 'APPROVAL_DATA',
        id: message.id,
        payload: {
          approval,
          accounts,
          selectedAccount,
        },
      }
    }

    case 'APPROVAL_RESPONSE': {
      const { approvalId, approved, data } = message.payload as {
        approvalId: string
        approved: boolean
        data?: { accounts?: Address[]; permissions?: string[] }
      }

      try {
        if (approved) {
          await approvalController.approve(approvalId, data)
        } else {
          await approvalController.reject(approvalId, 'User rejected')
        }

        return {
          type: 'APPROVAL_RESULT',
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'APPROVAL_RESULT',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to process approval',
          },
        }
      }
    }

    case 'ADD_NETWORK': {
      const { network } = message.payload as { network: import('../types').Network }

      // Validate network
      if (!network.name || !network.chainId || !network.rpcUrl) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: { success: false, error: 'Invalid network configuration' },
        }
      }

      // Check for duplicate
      const existingNetworks = walletState.getState().networks.networks
      if (existingNetworks.some((n) => n.chainId === network.chainId)) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: { success: false, error: 'Network with this Chain ID already exists' },
        }
      }

      await walletState.addNetwork(network)

      return {
        type: 'NETWORK_ADDED',
        id: message.id,
        payload: { success: true, network },
      }
    }

    case 'REMOVE_NETWORK': {
      const { chainId } = message.payload as { chainId: number }

      try {
        await walletState.removeNetwork(chainId)

        // Broadcast network change if the removed network was selected
        await broadcastStateUpdate()

        return {
          type: 'NETWORK_REMOVED',
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: { success: false, error: err instanceof Error ? err.message : 'Failed to remove network' },
        }
      }
    }

    case 'SELECT_NETWORK': {
      const { chainId } = message.payload as { chainId: number }

      await walletState.selectNetwork(chainId)

      // Broadcast chainChanged to all connected tabs
      await broadcastChainChanged(chainId)

      return {
        type: 'NETWORK_SELECTED',
        id: message.id,
        payload: { success: true, chainId },
      }
    }

    case 'EXPORT_PRIVATE_KEY': {
      const { address } = message.payload as { address: Address }

      try {
        const privateKey = keyringController.exportPrivateKey(address)
        return {
          type: 'PRIVATE_KEY_EXPORTED',
          id: message.id,
          payload: { success: true, privateKey },
        }
      } catch (err) {
        return {
          type: 'PRIVATE_KEY_ERROR',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to export private key',
          },
        }
      }
    }

    case 'GET_CONNECTED_SITES': {
      const state = walletState.getState()
      return {
        type: 'CONNECTED_SITES',
        id: message.id,
        payload: { sites: state.connections.connectedSites },
      }
    }

    case 'DISCONNECT_SITE': {
      const { origin: siteOrigin } = message.payload as { origin: string }

      await walletState.removeConnectedSite(siteOrigin)

      return {
        type: 'SITE_DISCONNECTED',
        id: message.id,
        payload: { success: true },
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

// =============================================================================
// Broadcast State Updates
// =============================================================================

/**
 * Broadcast state changes to all connected tabs
 */
async function broadcastStateUpdate(): Promise<void> {
  const state = walletState.getState()
  const tabs = await chrome.tabs.query({})

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
}

/**
 * Broadcast chain changed event to all tabs
 */
async function broadcastChainChanged(chainId: number): Promise<void> {
  const chainIdHex = `0x${chainId.toString(16)}`
  const tabs = await chrome.tabs.query({})

  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: `chain-${Date.now()}`,
        payload: {
          chainId: chainIdHex,
        },
      }).catch(() => {
        // Tab might not have content script loaded
      })
    }
  }
}

// =============================================================================
// Alarm Handlers
// =============================================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === STORAGE_KEYS.IDLE_CHECK_ALARM) {
    await checkAutoLock()
  }
})

// =============================================================================
// Idle Detection
// =============================================================================

chrome.idle.onStateChanged.addListener(handleIdleStateChange)

// =============================================================================
// Tab Event Listeners
// =============================================================================

chrome.tabs.onRemoved.addListener(handleTabRemoved)
chrome.tabs.onUpdated.addListener(handleTabUpdated)
chrome.tabs.onActivated.addListener(handleTabActivated)

// =============================================================================
// Installation Handler
// =============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    // Could open onboarding page here
  }
})

// =============================================================================
// Action Click Handler
// =============================================================================

chrome.action.onClicked.addListener(() => {
  // Popup is configured in manifest, this is a fallback
  updateLastActivity()
})

// =============================================================================
// State Change Subscriptions
// =============================================================================

walletState.subscribe(async () => {
  await updateIconState()
  await broadcastStateUpdate()
})

// =============================================================================
// Initialization
// =============================================================================

async function initialize(): Promise<void> {
  // Initialize wallet state
  await walletState.initialize()

  // Initialize keyring controller (restores from session if available)
  await keyringController.initialize()

  // Sync wallet state with keyring state after initialization
  const keyringState = await keyringController.getAsyncState()
  if (keyringState.isUnlocked) {
    await walletState.setUnlocked(true)
  }

  // Initialize tab tracking
  await initializeTabTracking()

  // Setup auto-lock alarm
  await setupAutoLockAlarm()

  // Update icon state
  await updateIconState()

  // Set idle detection threshold (in seconds)
  chrome.idle.setDetectionInterval(60)
}

// Initialize with proper error handling
initialize().catch((error) => {
  logger.error('Initialization failed', error)
  // Continue running - partial functionality may still work
})

// Export controllers for popup communication
export { accountController, networkController, walletState }
