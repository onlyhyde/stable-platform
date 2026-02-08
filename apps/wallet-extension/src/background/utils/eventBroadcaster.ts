/**
 * EventBroadcaster - Origin-isolated event broadcasting for dApp communication
 *
 * Implements EIP-1193 provider events with proper origin filtering to prevent
 * privacy leaks (SEC-1) and cross-origin data exposure.
 *
 * @see ARCHITECTURE_ANALYSIS.md - Issue #3 (Privacy Leak)
 * @see TASK_LIST.md - Task 1.1, SEC-1
 */

import type { Address } from 'viem'
import { DEFAULT_VALUES, PROVIDER_EVENTS, RPC_ERRORS } from '../../shared/constants'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('EventBroadcaster')

/**
 * Provider event types (EIP-1193 + StableNet custom)
 */
export type ProviderEventType =
  | typeof PROVIDER_EVENTS.CONNECT
  | typeof PROVIDER_EVENTS.DISCONNECT
  | typeof PROVIDER_EVENTS.ACCOUNTS_CHANGED
  | typeof PROVIDER_EVENTS.CHAIN_CHANGED
  | 'assetsChanged'

/**
 * Provider event message structure
 */
export interface ProviderEventMessage {
  type: 'PROVIDER_EVENT'
  event: ProviderEventType
  data: unknown
  origin: string
  timestamp: number
}

/**
 * Connect event info (EIP-1193)
 */
export interface ConnectInfo {
  chainId: string
}

/**
 * Disconnect error (EIP-1193)
 */
export interface ProviderRpcError {
  code: number
  message: string
}

/**
 * Asset change reason
 */
export type AssetChangeReason =
  | 'token_added'
  | 'token_removed'
  | 'balance_changed'
  | 'chain_switched'

/**
 * Assets changed event data (StableNet custom)
 */
export interface AssetsChangedEventData {
  chainId: number
  account: Address
  reason: AssetChangeReason
  timestamp: number
}

/**
 * Validates an Ethereum address format
 */
function isValidAddress(address: unknown): address is Address {
  if (typeof address !== 'string') return false
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validates origin format (must be http/https)
 */
function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Normalizes origin for consistent comparison
 */
function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin)
    return url.origin.toLowerCase()
  } catch {
    return origin.toLowerCase()
  }
}

/**
 * EventBroadcaster class
 *
 * Handles origin-isolated event broadcasting to connected dApps.
 * Implements security measures:
 * - Origin validation and normalization
 * - Data sanitization per event type
 * - Tab URL verification before sending
 */
class EventBroadcaster {
  /**
   * Broadcast an event to a specific origin only
   * This ensures privacy by never sending one origin's data to another
   */
  async broadcastToOrigin(origin: string, event: ProviderEventType, data: unknown): Promise<void> {
    // Validate origin format
    if (!isValidOrigin(origin)) {
      logger.warn('Invalid origin format', { origin })
      return
    }

    const normalizedOrigin = normalizeOrigin(origin)

    // Get tabs matching this origin
    const tabs = await chrome.tabs.query({ url: `${normalizedOrigin}/*` })

    const message: ProviderEventMessage = {
      type: 'PROVIDER_EVENT',
      event,
      data: this.sanitizeEventData(event, data),
      origin: normalizedOrigin,
      timestamp: Date.now(),
    }

    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue

      // Double-check tab URL matches expected origin (security)
      const tabOrigin = normalizeOrigin(new URL(tab.url).origin)
      if (tabOrigin !== normalizedOrigin) continue

      await chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab might not have content script loaded, ignore
      })
    }

    logger.debug('Event broadcast', { event, origin: normalizedOrigin })
  }

  /**
   * Broadcast connect event to a specific origin
   * Called when user approves connection request
   */
  async broadcastConnect(origin: string, chainId: string): Promise<void> {
    const connectInfo: ConnectInfo = { chainId }
    await this.broadcastToOrigin(origin, PROVIDER_EVENTS.CONNECT, connectInfo)
  }

  /**
   * Broadcast disconnect event to a specific origin
   * Called when user disconnects a site or wallet locks
   */
  async broadcastDisconnect(origin: string): Promise<void> {
    const error: ProviderRpcError = {
      code: RPC_ERRORS.DISCONNECTED.code,
      message: RPC_ERRORS.DISCONNECTED.message,
    }
    await this.broadcastToOrigin(origin, PROVIDER_EVENTS.DISCONNECT, error)
  }

  /**
   * Broadcast accounts changed event to a specific origin
   * Only sends accounts that are connected to this specific origin
   */
  async broadcastAccountsChanged(origin: string, accounts: Address[]): Promise<void> {
    // Validate all addresses before broadcasting
    const validAccounts = accounts.filter(isValidAddress)
    await this.broadcastToOrigin(origin, PROVIDER_EVENTS.ACCOUNTS_CHANGED, validAccounts)
  }

  /**
   * Broadcast chain changed event to all connected origins
   * Chain changes affect all connected sites
   */
  async broadcastChainChanged(chainId: string, connectedOrigins: string[]): Promise<void> {
    // Validate chainId format (should be hex)
    if (typeof chainId !== 'string' || !chainId.startsWith('0x')) {
      logger.warn('Invalid chainId format', { chainId })
      return
    }

    await Promise.all(
      connectedOrigins.map((origin) =>
        this.broadcastToOrigin(origin, PROVIDER_EVENTS.CHAIN_CHANGED, chainId)
      )
    )
  }

  /**
   * Broadcast accounts changed to multiple origins
   * Each origin receives only its own connected accounts
   */
  async broadcastAccountsChangedToAll(originAccountsMap: Map<string, Address[]>): Promise<void> {
    await Promise.all(
      Array.from(originAccountsMap.entries()).map(([origin, accounts]) =>
        this.broadcastAccountsChanged(origin, accounts)
      )
    )
  }

  /**
   * Broadcast assets changed event to all connected origins
   * Called when tokens are added/removed or when significant balance changes occur
   */
  async broadcastAssetsChanged(
    chainId: number,
    account: Address,
    reason: AssetChangeReason,
    connectedOrigins: string[]
  ): Promise<void> {
    if (!isValidAddress(account)) {
      logger.warn('Invalid account address for assetsChanged', { account })
      return
    }

    const eventData: AssetsChangedEventData = {
      chainId,
      account,
      reason,
      timestamp: Date.now(),
    }

    await Promise.all(
      connectedOrigins.map((origin) => this.broadcastToOrigin(origin, 'assetsChanged', eventData))
    )
  }

  /**
   * Sanitize event data based on event type
   * Prevents unexpected data from being broadcast
   */
  private sanitizeEventData(event: ProviderEventType, data: unknown): unknown {
    switch (event) {
      case PROVIDER_EVENTS.ACCOUNTS_CHANGED:
        // Ensure only valid addresses are sent
        if (!Array.isArray(data)) return []
        return data.filter(isValidAddress)

      case PROVIDER_EVENTS.CHAIN_CHANGED:
        // Ensure valid hex chain ID
        if (typeof data !== 'string') return null
        if (!data.startsWith('0x')) return null
        return data

      case PROVIDER_EVENTS.CONNECT: {
        // Ensure valid connect info
        if (typeof data !== 'object' || data === null) {
          return { chainId: DEFAULT_VALUES.CHAIN_ID_HEX }
        }
        const connectData = data as Record<string, unknown>
        return {
          chainId:
            typeof connectData.chainId === 'string'
              ? connectData.chainId
              : DEFAULT_VALUES.CHAIN_ID_HEX,
        }
      }

      case PROVIDER_EVENTS.DISCONNECT: {
        // Ensure valid error object
        if (typeof data !== 'object' || data === null) {
          return { code: RPC_ERRORS.DISCONNECTED.code, message: RPC_ERRORS.DISCONNECTED.message }
        }
        const errorData = data as Record<string, unknown>
        return {
          code: typeof errorData.code === 'number' ? errorData.code : RPC_ERRORS.DISCONNECTED.code,
          message:
            typeof errorData.message === 'string'
              ? errorData.message
              : RPC_ERRORS.DISCONNECTED.message,
        }
      }

      case 'assetsChanged': {
        // Ensure valid assetsChanged event data
        if (typeof data !== 'object' || data === null) {
          return null
        }
        const assetsData = data as Record<string, unknown>
        if (
          typeof assetsData.chainId !== 'number' ||
          !isValidAddress(assetsData.account) ||
          typeof assetsData.reason !== 'string' ||
          typeof assetsData.timestamp !== 'number'
        ) {
          return null
        }
        return {
          chainId: assetsData.chainId,
          account: assetsData.account,
          reason: assetsData.reason,
          timestamp: assetsData.timestamp,
        }
      }

      default:
        return data
    }
  }
}

// Export singleton instance
export const eventBroadcaster = new EventBroadcaster()

// Export class for testing
export { EventBroadcaster }
