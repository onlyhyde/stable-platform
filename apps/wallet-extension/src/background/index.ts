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

// Buffer polyfill for browser/service worker environment
// Must be imported before any other modules that depend on Node.js Buffer
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import type { Address, Hex } from 'viem'
import { getSecurityConfig, STORAGE_KEYS } from '../config'
import { loadDefaultNetworks, MESSAGE_TYPES } from '../shared/constants'
import { AuditEventType, auditLogger } from '../shared/security/auditLogger'
import { originFromUrl, resolveOrigin } from '../shared/security/originVerifier'
import { createLogger } from '../shared/utils/logger'
import { validateExtensionMessage } from '../shared/validation/messageSchema'
import type { ExtensionMessage, JsonRpcRequest, MessageType, Network } from '../types'
import { accountController } from './controller/accountController'
import { networkController } from './controller/networkController'
import { approvalController } from './controllers/approvalController'
import { keyringController } from './keyring'
import { handleRpcRequest } from './rpc/handler'
import { createIndexerClient, type IndexerClient } from './services/IndexerClient'
import { transactionWatcher } from './services/transactionWatcher'
import { walletState } from './state/store'
import { eventBroadcaster } from './utils/eventBroadcaster'

const logger = createLogger('Background')

/**
 * Recursively convert non-JSON-serializable values for message passing.
 * chrome.runtime.sendMessage uses JSON serialization which cannot handle
 * BigInt, Date, Map, Set, etc.
 */
function sanitizeForMessage(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString()
  if (obj instanceof Date) return obj.toISOString()
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForMessage)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeForMessage(value)
    }
    return result
  }
  return obj
}

// =============================================================================
// Indexer Client Management
// =============================================================================

let currentIndexerClient: IndexerClient | null = null
let currentIndexerChainId: number | null = null

/**
 * Get or create IndexerClient for the current network
 */
function getIndexerClient(): IndexerClient | null {
  const state = walletState.getState()
  const selectedChainId = state.networks.selectedChainId
  const network = state.networks.networks.find((n: Network) => n.chainId === selectedChainId)

  if (!network?.indexerUrl) {
    return null
  }

  // Reuse existing client if network hasn't changed
  if (currentIndexerClient && currentIndexerChainId === selectedChainId) {
    return currentIndexerClient
  }

  // Create new client for the network
  currentIndexerClient = createIndexerClient(network.indexerUrl)
  currentIndexerChainId = selectedChainId

  return currentIndexerClient
}

/**
 * Format token balance with decimals
 */
function formatTokenBalance(balance: string, decimals: number): string {
  if (balance === '0') return '0'

  const bn = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = bn / divisor
  const remainder = bn % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '')

  return `${whole}.${trimmed}`
}

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
 * Recursively convert BigInt values to strings for JSON-safe serialization.
 * Chrome extension messaging uses JSON serialization, which does not support BigInt.
 */
function serializeBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return String(obj) as unknown as T
  if (Array.isArray(obj)) return obj.map(serializeBigInts) as unknown as T
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value)
    }
    return result as T
  }
  return obj
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
      autoLockMinutes = stored[STORAGE_KEYS.AUTO_LOCK_MINUTES] as number
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
async function handleIdleStateChange(newState: 'active' | 'idle' | 'locked'): Promise<void> {
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
function handleTabUpdated(tabId: number, changeInfo: { url?: string }): void {
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
async function handleTabActivated(activeInfo: { tabId: number; windowId: number }): Promise<void> {
  updateLastActivity()

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    const origin = originFromUrl(tab.url)

    if (origin.startsWith('http') || origin.startsWith('file')) {
      // Request chain ID from the tab to update icon
      chrome.tabs
        .sendMessage(activeInfo.tabId, {
          type: 'embedded:action',
          action: { type: 'getChainId' },
        })
        .catch(() => {
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
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Validate message structure before processing
  const validated = validateExtensionMessage(message)
  if (!validated) {
    sendResponse({
      type: MESSAGE_TYPES.RPC_RESPONSE,
      id: 'unknown',
      payload: {
        error: {
          code: -32600,
          message: 'Invalid message format',
        },
      },
    })
    return true
  }

  // Update last activity time on any message
  updateLastActivity()

  handleMessage(validated, sender)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: validated.id,
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
 *
 * Security: Origin is derived only from trusted sources (sender.tab.url or sender.origin)
 * Never trust message.origin as it can be spoofed by malicious content scripts (SEC-3)
 *
 * @see TASK_LIST.md - SEC-3
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionMessage> {
  // SEC-3: Derive origin from sender (chrome.tabs API), never from message.origin
  const resolved = resolveOrigin(sender)
  const origin = resolved.origin
  const tabId = resolved.tabId

  if (!resolved.isExtension && !resolved.isValidExternal) {
    logger.warn('Invalid origin format', { origin, messageType: message.type })
  }

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

      const response = await handleRpcRequest(request, origin, resolved.isExtension)

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
        payload: sanitizeForMessage(response),
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

      // Request user approval via popup (matching handler.ts pattern)
      try {
        const result = await approvalController.requestConnect(origin)

        await walletState.addConnectedSite({
          origin,
          accounts: result.accounts,
          permissions: result.permissions,
          connectedAt: Date.now(),
        })

        return {
          type: MESSAGE_TYPES.CONNECT_RESPONSE,
          id: message.id,
          payload: { accounts: result.accounts },
        }
      } catch {
        // User rejected the connection request
        return {
          type: MESSAGE_TYPES.CONNECT_RESPONSE,
          id: message.id,
          payload: {
            accounts: [],
            error: 'User rejected the connection request',
          },
        }
      }
    }

    case MESSAGE_TYPES.DISCONNECT: {
      // Broadcast disconnect event before removing (EIP-1193)
      await eventBroadcaster.broadcastDisconnect(origin)

      await walletState.removeConnectedSite(origin)

      return {
        type: MESSAGE_TYPES.RPC_RESPONSE,
        id: message.id,
        payload: { success: true },
      }
    }

    case MESSAGE_TYPES.STATE_UPDATE: {
      const payload = message.payload as
        | { action?: string; chainId?: number; address?: string }
        | undefined

      // Handle specific actions
      if (payload?.action === 'selectNetwork' && payload.chainId !== undefined) {
        await walletState.selectNetwork(payload.chainId)
        // Broadcast to all tabs
        await broadcastChainChanged(payload.chainId)
      } else if (payload?.action === 'selectAccount' && payload.address) {
        const newSelectedAccount = payload.address as `0x${string}`
        await walletState.selectAccount(newSelectedAccount)

        // Broadcast accountsChanged to all connected sites (Task 1.5)
        // Each site receives their connected accounts with the new selection first
        const state = walletState.getState()
        for (const site of state.connections.connectedSites) {
          // Only broadcast if the selected account is connected to this site
          // Otherwise, send the same account list (order unchanged)
          let accountsForOrigin = [...site.accounts]
          if (accountsForOrigin.includes(newSelectedAccount)) {
            accountsForOrigin = [
              newSelectedAccount,
              ...accountsForOrigin.filter((a) => a !== newSelectedAccount),
            ]
          }
          await eventBroadcaster.broadcastAccountsChanged(site.origin, accountsForOrigin)
        }
      }

      // Return current state (sanitize BigInt for message serialization)
      return {
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: message.id,
        payload: sanitizeForMessage(walletState.getState()),
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
      const { password } = message.payload as { password?: string }

      // Password is required for mnemonic access (SEC-8)
      if (!password) {
        return {
          type: 'MNEMONIC_ERROR',
          id: message.id,
          payload: { error: 'Password is required to view recovery phrase' },
        }
      }

      try {
        const mnemonic = await keyringController.getMnemonicWithPassword(password)
        const selectedAddress = walletState.getState().accounts.selectedAccount ?? 'unknown'
        auditLogger.logAccount(AuditEventType.MNEMONIC_VIEWED, selectedAddress).catch(() => {})
        return {
          type: 'MNEMONIC',
          id: message.id,
          payload: { mnemonic },
        }
      } catch (error) {
        return {
          type: 'MNEMONIC_ERROR',
          id: message.id,
          payload: { error: (error as Error).message },
        }
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

      // Serialize BigInt values to strings for JSON-safe messaging.
      // Approval objects (TransactionApprovalRequest, AuthorizationApprovalRequest)
      // contain bigint fields that cannot be serialized by chrome.runtime.sendMessage.
      return {
        type: 'APPROVAL_DATA',
        id: message.id,
        payload: {
          approval: serializeBigInts(approval),
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
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to remove network',
          },
        }
      }
    }

    case 'UPDATE_NETWORK': {
      const { chainId, updates } = message.payload as {
        chainId: number
        updates: Partial<import('../types').Network>
      }

      // Prevent chainId modification
      if (updates.chainId !== undefined && updates.chainId !== chainId) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: { success: false, error: 'Cannot change chain ID' },
        }
      }

      // Validate that network exists
      const existing = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      if (!existing) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: { success: false, error: 'Network not found' },
        }
      }

      try {
        // Remove chainId from updates to satisfy Omit<Network, 'chainId'>
        const { chainId: _ignored, ...safeUpdates } = updates
        await walletState.updateNetwork(chainId, safeUpdates)
        await broadcastStateUpdate()

        return {
          type: 'NETWORK_UPDATED',
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'NETWORK_ERROR',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update network',
          },
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
      const { address, password } = message.payload as { address: Address; password?: string }

      // Password is required for private key export (SEC-8)
      if (!password) {
        return {
          type: 'PRIVATE_KEY_ERROR',
          id: message.id,
          payload: {
            success: false,
            error: 'Password is required to export private key',
          },
        }
      }

      try {
        const privateKey = await keyringController.exportPrivateKeyWithPassword(address, password)
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

      // Broadcast disconnect event before removing (EIP-1193)
      await eventBroadcaster.broadcastDisconnect(siteOrigin)

      await walletState.removeConnectedSite(siteOrigin)

      return {
        type: 'SITE_DISCONNECTED',
        id: message.id,
        payload: { success: true },
      }
    }

    case 'GET_TOKEN_BALANCES': {
      const { address } = message.payload as { address: Address }

      const indexerClient = getIndexerClient()
      if (!indexerClient) {
        return {
          type: 'TOKEN_BALANCES',
          id: message.id,
          payload: {
            success: false,
            error: 'Indexer not configured for this network',
            balances: [],
          },
        }
      }

      try {
        const rawBalances = await indexerClient.getTokenBalances(address, 'ERC20')

        const balances = rawBalances
          .filter((b) => BigInt(b.balance) > 0n)
          .map((b) => ({
            address: b.address,
            symbol: b.symbol ?? 'UNKNOWN',
            name: b.name ?? 'Unknown Token',
            decimals: b.decimals ?? 18,
            balance: b.balance,
            formattedBalance: formatTokenBalance(b.balance, b.decimals ?? 18),
          }))

        return {
          type: 'TOKEN_BALANCES',
          id: message.id,
          payload: { success: true, balances },
        }
      } catch (err) {
        return {
          type: 'TOKEN_BALANCES',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch token balances',
            balances: [],
          },
        }
      }
    }

    case 'GET_TRANSACTION_HISTORY': {
      const { address, limit = 50, offset = 0 } = message.payload as {
        address: Address
        limit?: number
        offset?: number
      }

      const indexerClient = getIndexerClient()
      if (!indexerClient) {
        return {
          type: 'TRANSACTION_HISTORY',
          id: message.id,
          payload: {
            success: false,
            error: 'Indexer not configured for this network',
            transactions: [],
            tokenTransfers: [],
          },
        }
      }

      try {
        // Fetch native transactions and token transfers in parallel
        const [txResult, transfers] = await Promise.all([
          indexerClient.getTransactionsByAddress(address, limit, offset),
          indexerClient.getAllERC20Transfers(address, limit),
        ])

        const normalizedAddress = address.toLowerCase()

        // Map native transactions
        const transactions = txResult.nodes.map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          gasPrice: tx.gasPrice,
          gasUsed: tx.gasUsed,
          blockNumber: tx.blockNumber,
          timestamp: tx.timestamp,
          status: tx.status === 1 ? 'success' : tx.status === 0 ? 'failed' : 'pending',
          direction: tx.from.toLowerCase() === normalizedAddress ? 'out' : 'in',
        }))

        // Map token transfers
        const tokenTransfers = transfers.map((t) => ({
          contractAddress: t.contractAddress,
          from: t.from,
          to: t.to,
          value: t.value,
          formattedValue: formatTokenBalance(t.value, 18), // Default to 18 decimals
          symbol: 'TOKEN', // Would need token metadata lookup
          transactionHash: t.transactionHash,
          blockNumber: t.blockNumber,
          timestamp: t.timestamp,
          direction: t.from.toLowerCase() === normalizedAddress ? 'out' : 'in',
        }))

        return {
          type: 'TRANSACTION_HISTORY',
          id: message.id,
          payload: { success: true, transactions, tokenTransfers },
        }
      } catch (err) {
        return {
          type: 'TRANSACTION_HISTORY',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch transaction history',
            transactions: [],
            tokenTransfers: [],
          },
        }
      }
    }

    case 'CHECK_INDEXER_STATUS': {
      const indexerClient = getIndexerClient()

      if (!indexerClient) {
        return {
          type: 'INDEXER_STATUS',
          id: message.id,
          payload: { available: false, configured: false },
        }
      }

      try {
        const available = await indexerClient.isAvailable()
        return {
          type: 'INDEXER_STATUS',
          id: message.id,
          payload: { available, configured: true },
        }
      } catch {
        return {
          type: 'INDEXER_STATUS',
          id: message.id,
          payload: { available: false, configured: true },
        }
      }
    }

    // ==========================================================================
    // Asset Management Messages
    // ==========================================================================

    case 'GET_ASSETS': {
      const { chainId, account } = message.payload as { chainId: number; account: Address }

      const tokens = walletState.getTokensForChain(chainId)

      // Get balances for all tokens
      const tokensWithBalances = tokens.map((token) => {
        const balance =
          walletState.getCachedBalance(chainId, account, token.address as Address) || '0'
        return {
          ...token,
          balance,
          formattedBalance: formatTokenBalance(balance, token.decimals),
        }
      })

      return {
        type: 'ASSETS',
        id: message.id,
        payload: { tokens: tokensWithBalances },
      }
    }

    case 'ADD_TOKEN': {
      const { chainId, token } = message.payload as {
        chainId: number
        token: {
          address: Address
          symbol?: string
          name?: string
          decimals?: number
          logoURI?: string
        }
      }

      try {
        // Add token to wallet state
        const newToken = {
          address: token.address.toLowerCase() as Address,
          symbol: token.symbol ?? 'UNKNOWN',
          name: token.name ?? 'Unknown Token',
          decimals: token.decimals ?? 18,
          chainId,
          logoURI: token.logoURI,
          isVisible: true,
          addedAt: Date.now(),
        }

        await walletState.addToken(chainId, newToken)

        // Broadcast assetsChanged event
        const state = walletState.getState()
        const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
        await eventBroadcaster.broadcastAssetsChanged(
          chainId,
          state.accounts.selectedAccount ?? ('' as Address),
          'token_added',
          connectedOrigins
        )

        return {
          type: 'TOKEN_ADDED',
          id: message.id,
          payload: { success: true, token: newToken },
        }
      } catch (err) {
        return {
          type: 'TOKEN_ADDED',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to add token',
          },
        }
      }
    }

    case 'REMOVE_TOKEN': {
      const { chainId, address } = message.payload as { chainId: number; address: Address }

      try {
        await walletState.removeToken(chainId, address)

        // Broadcast assetsChanged event
        const state = walletState.getState()
        const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
        await eventBroadcaster.broadcastAssetsChanged(
          chainId,
          state.accounts.selectedAccount ?? ('' as Address),
          'token_removed',
          connectedOrigins
        )

        return {
          type: 'TOKEN_REMOVED',
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'TOKEN_REMOVED',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to remove token',
          },
        }
      }
    }

    case 'SET_TOKEN_VISIBILITY': {
      const { chainId, address, isVisible } = message.payload as {
        chainId: number
        address: Address
        isVisible: boolean
      }

      try {
        await walletState.setTokenVisibility(chainId, address, isVisible)

        return {
          type: 'TOKEN_VISIBILITY_SET',
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'TOKEN_VISIBILITY_SET',
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update token visibility',
          },
        }
      }
    }

    case 'GET_TOKEN_PRICES': {
      try {
        const { handleGetTokenPrices } = await import('./services/tokenPriceService')
        const symbols = (message as ExtensionMessage<{ symbols?: string[] }>).payload?.symbols
        const prices = await handleGetTokenPrices(symbols)
        return { type: 'TOKEN_PRICES' as const, id: message.id, payload: { prices } }
      } catch {
        return { type: 'TOKEN_PRICES' as const, id: message.id, payload: { prices: {} } }
      }
    }

    // ==========================================================================
    // Ledger Hardware Wallet Messages
    // ==========================================================================

    case MESSAGE_TYPES.LEDGER_CONNECT: {
      try {
        await keyringController.connectLedger()
        return {
          type: 'LEDGER_CONNECTED' as MessageType,
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'LEDGER_ERROR' as MessageType,
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to connect Ledger',
          },
        }
      }
    }

    case MESSAGE_TYPES.LEDGER_DISCONNECT: {
      try {
        await keyringController.disconnectLedger()
        return {
          type: 'LEDGER_DISCONNECTED' as MessageType,
          id: message.id,
          payload: { success: true },
        }
      } catch (err) {
        return {
          type: 'LEDGER_ERROR' as MessageType,
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to disconnect Ledger',
          },
        }
      }
    }

    case MESSAGE_TYPES.LEDGER_DISCOVER_ACCOUNTS: {
      const { startIndex = 0, count = 5 } =
        (message.payload as {
          startIndex?: number
          count?: number
        }) ?? {}

      try {
        const accounts = await keyringController.discoverLedgerAccounts(startIndex, count)
        return {
          type: 'LEDGER_ACCOUNTS_DISCOVERED' as MessageType,
          id: message.id,
          payload: { success: true, accounts },
        }
      } catch (err) {
        return {
          type: 'LEDGER_ERROR' as MessageType,
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to discover accounts',
          },
        }
      }
    }

    case MESSAGE_TYPES.LEDGER_ADD_ACCOUNT: {
      const { account } = message.payload as {
        account: { address: Address; path: string; index: number }
      }

      try {
        await keyringController.addLedgerAccount(account)

        // Add to wallet state
        await walletState.addAccount({
          address: account.address,
          name: `Ledger ${account.index + 1}`,
          type: 'eoa',
          keyringType: 'hardware',
        })

        return {
          type: 'LEDGER_ACCOUNT_ADDED' as MessageType,
          id: message.id,
          payload: { success: true, address: account.address },
        }
      } catch (err) {
        return {
          type: 'LEDGER_ERROR' as MessageType,
          id: message.id,
          payload: {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to add Ledger account',
          },
        }
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
 * Broadcast state changes to all connected sites
 * Uses origin-based filtering to prevent privacy leaks (SEC-1)
 *
 * @see TASK_LIST.md - Task 1.4, SEC-1
 */
async function broadcastStateUpdate(): Promise<void> {
  const state = walletState.getState()
  const selectedAccount = state.accounts.selectedAccount

  // Broadcast accountsChanged to each connected site with their specific accounts
  // This fixes SEC-1: Privacy leak where all accounts were sent to all origins
  for (const site of state.connections.connectedSites) {
    // Get accounts for this origin, with selected account first if connected
    let accountsForOrigin = [...site.accounts]
    if (selectedAccount && accountsForOrigin.includes(selectedAccount)) {
      accountsForOrigin = [
        selectedAccount,
        ...accountsForOrigin.filter((a) => a !== selectedAccount),
      ]
    }

    await eventBroadcaster.broadcastAccountsChanged(site.origin, accountsForOrigin)
  }
}

/**
 * Broadcast chain changed event to all connected sites
 * Uses eventBroadcaster for consistent origin-based messaging
 */
async function broadcastChainChanged(chainId: number): Promise<void> {
  const chainIdHex = `0x${chainId.toString(16)}`
  const state = walletState.getState()

  // Get all connected origins
  const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)

  // Broadcast to all connected sites
  await eventBroadcaster.broadcastChainChanged(chainIdHex, connectedOrigins)
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

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First time installation - initialize with defaults from networks.json
    await walletState.initialize()
    const defaults = await loadDefaultNetworks()
    await walletState.mergeDefaultNetworks(defaults)
  } else if (details.reason === 'update') {
    // Extension update - run migrations and merge new default networks
    await walletState.initialize()
    const defaults = await loadDefaultNetworks()
    await walletState.mergeDefaultNetworks(defaults)
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

let uiNotifyTimer: ReturnType<typeof setTimeout> | undefined

walletState.subscribe(async () => {
  await updateIconState()
  await broadcastStateUpdate()

  // Push state change to extension UI (popup / side panel)
  clearTimeout(uiNotifyTimer)
  uiNotifyTimer = setTimeout(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        id: `bg-push-${Date.now()}`,
        payload: {},
      })
    } catch {
      // No extension views open — expected when popup is closed
    }
  }, 100)
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

  // Start transaction watcher for receipt polling
  transactionWatcher.start()

  // Update icon state
  await updateIconState()

  // Set idle detection threshold (in seconds)
  chrome.idle.setDetectionInterval(60)

  // Keep popup as the default action click behavior
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

  // Create context menu for opening Side Panel
  chrome.contextMenus.create({
    id: 'open-side-panel',
    title: 'StableNet Wallet: Side Panel',
    contexts: ['page'],
  })
}

// =============================================================================
// Context Menu Handler (Side Panel)
// =============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-side-panel' && tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})

// =============================================================================
// Keyboard Shortcut Handler (Side Panel)
// =============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-side-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }
})

// Initialize with proper error handling
initialize().catch((error) => {
  logger.error('Initialization failed', error)
  // Continue running - partial functionality may still work
})

// Export controllers for popup communication
export { accountController, networkController, walletState }
