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
import { PROVIDER_EVENTS } from '../../shared/constants'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('EventBroadcaster')

/**
 * Provider event types (EIP-1193)
 */
export type ProviderEventType =
  | typeof PROVIDER_EVENTS.CONNECT
  | typeof PROVIDER_EVENTS.DISCONNECT
  | typeof PROVIDER_EVENTS.ACCOUNTS_CHANGED
  | typeof PROVIDER_EVENTS.CHAIN_CHANGED

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
  async broadcastToOrigin(
    origin: string,
    event: ProviderEventType,
    data: unknown
  ): Promise<void> {
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
      code: 4900,
      message: 'The provider is disconnected from all chains',
    }
    await this.broadcastToOrigin(origin, PROVIDER_EVENTS.DISCONNECT, error)
  }

  /**
   * Broadcast accounts changed event to a specific origin
   * Only sends accounts that are connected to this specific origin
   */
  async broadcastAccountsChanged(
    origin: string,
    accounts: Address[]
  ): Promise<void> {
    // Validate all addresses before broadcasting
    const validAccounts = accounts.filter(isValidAddress)
    await this.broadcastToOrigin(
      origin,
      PROVIDER_EVENTS.ACCOUNTS_CHANGED,
      validAccounts
    )
  }

  /**
   * Broadcast chain changed event to all connected origins
   * Chain changes affect all connected sites
   */
  async broadcastChainChanged(
    chainId: string,
    connectedOrigins: string[]
  ): Promise<void> {
    // Validate chainId format (should be hex)
    if (
      typeof chainId !== 'string' ||
      !chainId.startsWith('0x')
    ) {
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
  async broadcastAccountsChangedToAll(
    originAccountsMap: Map<string, Address[]>
  ): Promise<void> {
    await Promise.all(
      Array.from(originAccountsMap.entries()).map(([origin, accounts]) =>
        this.broadcastAccountsChanged(origin, accounts)
      )
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

      case PROVIDER_EVENTS.CONNECT:
        // Ensure valid connect info
        if (typeof data !== 'object' || data === null) {
          return { chainId: '0x1' }
        }
        const connectData = data as Record<string, unknown>
        return {
          chainId:
            typeof connectData.chainId === 'string'
              ? connectData.chainId
              : '0x1',
        }

      case PROVIDER_EVENTS.DISCONNECT:
        // Ensure valid error object
        if (typeof data !== 'object' || data === null) {
          return { code: 4900, message: 'Disconnected' }
        }
        const errorData = data as Record<string, unknown>
        return {
          code: typeof errorData.code === 'number' ? errorData.code : 4900,
          message:
            typeof errorData.message === 'string'
              ? errorData.message
              : 'Disconnected',
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
