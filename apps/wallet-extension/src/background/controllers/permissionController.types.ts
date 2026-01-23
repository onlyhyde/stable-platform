/**
 * PermissionController Types
 * Manages dApp permissions and access control
 */

import type { Address } from 'viem'

/**
 * Permission types that can be requested
 */
export type PermissionType =
  | 'eth_accounts'
  | 'eth_chainId'
  | 'eth_sendTransaction'
  | 'personal_sign'
  | 'eth_signTypedData_v4'

/**
 * Caveat type for restricting permissions
 */
export interface Caveat {
  type: 'restrictToAccounts' | 'restrictToChains'
  value: string[]
}

/**
 * A single permission grant
 */
export interface Permission {
  id: string
  parentCapability: PermissionType
  invoker: string // origin
  caveats: Caveat[]
  date: number
}

/**
 * Permission request from a dApp
 */
export interface PermissionRequest {
  id: string
  origin: string
  permissions: PermissionType[]
  metadata?: {
    name?: string
    icon?: string
  }
  date: number
}

/**
 * Permissions granted to a specific origin
 */
export interface OriginPermissions {
  origin: string
  permissions: Permission[]
  accounts: Address[]
  lastUpdated: number
}

/**
 * Permission controller state
 */
export interface PermissionControllerState {
  permissions: Record<string, OriginPermissions>
  pendingRequests: Record<string, PermissionRequest>
}

/**
 * Permission controller events
 */
export type PermissionControllerEvent =
  | { type: 'permission:requested'; request: PermissionRequest }
  | { type: 'permission:approved'; origin: string; permissions: Permission[] }
  | { type: 'permission:rejected'; origin: string; requestId: string }
  | { type: 'permission:revoked'; origin: string; permission: PermissionType }
  | { type: 'accounts:changed'; origin: string; accounts: Address[] }

/**
 * Permission controller options
 */
export interface PermissionControllerOptions {
  getSelectedAddress: () => Address | null
  getAllAddresses: () => Address[]
}
