/**
 * PermissionController
 * Manages dApp permissions and access control
 * Persists approved permissions to chrome.storage.local
 * Pending requests are ephemeral (cleared on service worker restart)
 */

import type { Address } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import type {
  Caveat,
  OriginPermissions,
  Permission,
  PermissionControllerOptions,
  PermissionControllerState,
  PermissionRequest,
  PermissionType,
} from './permissionController.types'

const logger = createLogger('PermissionController')

/** Storage key for persisted permission state */
const PERMISSION_STORAGE_KEY = 'stablenet_permissions'

type PermissionEventType =
  | 'permission:requested'
  | 'permission:approved'
  | 'permission:rejected'
  | 'permission:revoked'
  | 'accounts:changed'

type EventHandler = (...args: unknown[]) => void

interface RequestMetadata {
  name?: string
  icon?: string
}

export class PermissionController {
  private state: PermissionControllerState
  private eventHandlers: Map<PermissionEventType, Set<EventHandler>>

  constructor(_options: PermissionControllerOptions) {
    this.state = {
      permissions: {},
      pendingRequests: {},
    }
    this.eventHandlers = new Map()
  }

  /**
   * Initialize controller by restoring persisted permissions from chrome.storage.local.
   * Pending requests are NOT restored (they are ephemeral).
   */
  async initialize(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(PERMISSION_STORAGE_KEY)
      const persisted = stored[PERMISSION_STORAGE_KEY] as
        | Record<string, OriginPermissions>
        | undefined

      if (persisted && typeof persisted === 'object') {
        this.state = {
          permissions: persisted,
          pendingRequests: {},
        }
        logger.info('Restored permissions from storage', {
          origins: Object.keys(persisted).length,
        })
      }
    } catch (error) {
      logger.error('Failed to restore permissions from storage', error)
    }
  }

  /**
   * Persist approved permissions to chrome.storage.local.
   * Only permissions are persisted — pending requests are ephemeral.
   */
  private async persist(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [PERMISSION_STORAGE_KEY]: this.state.permissions,
      })
    } catch (error) {
      logger.error('Failed to persist permissions', error)
    }
  }

  /**
   * Request permissions for an origin
   */
  async requestPermissions(
    origin: string,
    permissions: PermissionType[],
    metadata?: RequestMetadata
  ): Promise<PermissionRequest> {
    const id = this.generateId()

    const request: PermissionRequest = {
      id,
      origin,
      permissions,
      metadata,
      date: Date.now(),
    }

    this.state = {
      ...this.state,
      pendingRequests: { ...this.state.pendingRequests, [id]: request },
    }

    this.emit('permission:requested', request)

    return request
  }

  /**
   * Approve a permission request
   */
  async approvePermissions(requestId: string, accounts: Address[]): Promise<void> {
    const request = this.state.pendingRequests[requestId]
    if (!request) {
      throw new Error('Permission request not found')
    }

    const permissions: Permission[] = request.permissions.map((permType) => {
      const caveats: Caveat[] = []

      // Add account restriction caveat for eth_accounts
      if (permType === 'eth_accounts') {
        caveats.push({
          type: 'restrictToAccounts',
          value: accounts.map((a) => a),
        })
      }

      return {
        id: this.generateId(),
        parentCapability: permType,
        invoker: request.origin,
        caveats,
        date: Date.now(),
      }
    })

    // Store permissions and remove from pending immutably
    const { [requestId]: _removed, ...remainingRequests } = this.state.pendingRequests

    this.state = {
      ...this.state,
      permissions: {
        ...this.state.permissions,
        [request.origin]: {
          origin: request.origin,
          permissions,
          accounts,
          lastUpdated: Date.now(),
        },
      },
      pendingRequests: remainingRequests,
    }

    await this.persist()
    this.emit('permission:approved', request.origin, permissions)
  }

  /**
   * Reject a permission request
   */
  async rejectPermissions(requestId: string): Promise<void> {
    const request = this.state.pendingRequests[requestId]
    if (!request) {
      throw new Error('Permission request not found')
    }

    const origin = request.origin

    // Remove from pending immutably
    const { [requestId]: _removed, ...remainingRequests } = this.state.pendingRequests
    this.state = {
      ...this.state,
      pendingRequests: remainingRequests,
    }

    this.emit('permission:rejected', origin, requestId)
  }

  /**
   * Check if origin has a specific permission
   */
  hasPermission(origin: string, permission: PermissionType): boolean {
    const originPerms = this.state.permissions[origin]
    if (!originPerms) {
      return false
    }

    return originPerms.permissions.some((p) => p.parentCapability === permission)
  }

  /**
   * Revoke a specific permission for an origin
   */
  async revokePermission(origin: string, permission: PermissionType): Promise<void> {
    const originPerms = this.state.permissions[origin]
    if (!originPerms) {
      return
    }

    this.state = {
      ...this.state,
      permissions: {
        ...this.state.permissions,
        [origin]: {
          ...originPerms,
          permissions: originPerms.permissions.filter((p) => p.parentCapability !== permission),
          lastUpdated: Date.now(),
        },
      },
    }

    await this.persist()
    this.emit('permission:revoked', origin, permission)
  }

  /**
   * Revoke all permissions for an origin
   */
  async revokeAllPermissions(origin: string): Promise<void> {
    const originPerms = this.state.permissions[origin]
    if (!originPerms) {
      return
    }

    const { [origin]: _removed, ...remainingPermissions } = this.state.permissions
    this.state = {
      ...this.state,
      permissions: remainingPermissions,
    }

    await this.persist()
    this.emit('accounts:changed', origin, [])
  }

  /**
   * Get all permissions for an origin
   */
  getPermissionsForOrigin(origin: string): OriginPermissions | undefined {
    return this.state.permissions[origin]
  }

  /**
   * Get approved accounts for an origin
   */
  getAccountsForOrigin(origin: string): Address[] {
    const originPerms = this.state.permissions[origin]
    if (!originPerms) {
      return []
    }

    return originPerms.accounts
  }

  /**
   * Update permitted accounts for an origin
   */
  async updateAccountsForOrigin(origin: string, accounts: Address[]): Promise<void> {
    const originPerms = this.state.permissions[origin]
    if (!originPerms) {
      return
    }

    const updatedPermissions = originPerms.permissions.map((p) => {
      if (p.parentCapability !== 'eth_accounts') return p

      return {
        ...p,
        caveats: p.caveats.map((c) =>
          c.type === 'restrictToAccounts' ? { ...c, value: accounts.map((a) => a) } : c
        ),
      }
    })

    this.state = {
      ...this.state,
      permissions: {
        ...this.state.permissions,
        [origin]: {
          ...originPerms,
          accounts,
          permissions: updatedPermissions,
          lastUpdated: Date.now(),
        },
      },
    }

    await this.persist()
    this.emit('accounts:changed', origin, accounts)
  }

  /**
   * Check if origin is connected (has any permissions)
   */
  isConnected(origin: string): boolean {
    const originPerms = this.state.permissions[origin]
    return originPerms !== undefined && originPerms.permissions.length > 0
  }

  /**
   * Get all connected origins
   */
  getConnectedOrigins(): string[] {
    return Object.keys(this.state.permissions)
  }

  /**
   * Get all pending permission requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Object.values(this.state.pendingRequests)
  }

  /**
   * Clear all pending requests by rejecting them
   */
  async clearPendingRequests(): Promise<void> {
    const requests = this.getPendingRequests()
    for (const request of requests) {
      await this.rejectPermissions(request.id)
    }
  }

  /**
   * Get the current state
   */
  getState(): PermissionControllerState {
    return { ...this.state }
  }

  /**
   * Subscribe to permission events
   */
  on(event: PermissionEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Unsubscribe from permission events
   */
  off(event: PermissionEventType, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  // Private methods

  private generateId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `${Date.now()}-${hex}`
  }

  private emit(event: PermissionEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }
}
