/**
 * PermissionController
 * Manages dApp permissions and access control
 */

import type { Address } from 'viem'
import type {
  Caveat,
  OriginPermissions,
  Permission,
  PermissionControllerOptions,
  PermissionControllerState,
  PermissionRequest,
  PermissionType,
} from './permissionController.types'

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
  private options: PermissionControllerOptions

  constructor(options: PermissionControllerOptions) {
    this.options = options
    this.state = {
      permissions: {},
      pendingRequests: {},
    }
    this.eventHandlers = new Map()
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

    this.state.pendingRequests[id] = request

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

    // Store permissions
    this.state.permissions[request.origin] = {
      origin: request.origin,
      permissions,
      accounts,
      lastUpdated: Date.now(),
    }

    // Remove from pending
    delete this.state.pendingRequests[requestId]

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

    // Remove from pending
    delete this.state.pendingRequests[requestId]

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

    originPerms.permissions = originPerms.permissions.filter(
      (p) => p.parentCapability !== permission
    )
    originPerms.lastUpdated = Date.now()

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

    delete this.state.permissions[origin]

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

    originPerms.accounts = accounts
    originPerms.lastUpdated = Date.now()

    // Update the eth_accounts caveat
    const ethAccountsPerm = originPerms.permissions.find(
      (p) => p.parentCapability === 'eth_accounts'
    )
    if (ethAccountsPerm) {
      const accountCaveat = ethAccountsPerm.caveats.find((c) => c.type === 'restrictToAccounts')
      if (accountCaveat) {
        accountCaveat.value = accounts.map((a) => a)
      }
    }

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
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
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
