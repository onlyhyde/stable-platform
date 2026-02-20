/**
 * EIP-2255: Wallet Permissions System
 *
 * This module implements the EIP-2255 standard for managing
 * wallet permissions in a standardized way.
 *
 * @see https://eips.ethereum.org/EIPS/eip-2255
 */

import type { Address, EIP1193Provider } from 'viem'

/**
 * Permission target types
 */
export const PERMISSION_TARGETS = {
  ETH_ACCOUNTS: 'eth_accounts',
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
  WALLET_SWITCH_ETHEREUM_CHAIN: 'wallet_switchEthereumChain',
  WALLET_ADD_ETHEREUM_CHAIN: 'wallet_addEthereumChain',
  // StableNet custom permissions
  WALLET_SIGN_AUTHORIZATION: 'wallet_signAuthorization',
  WALLET_SEND_USER_OPERATION: 'wallet_sendUserOperation',
  WALLET_INSTALL_MODULE: 'wallet_installModule',
  WALLET_CREATE_SESSION_KEY: 'wallet_createSessionKey',
  WALLET_GENERATE_STEALTH_ADDRESS: 'wallet_generateStealthAddress',
} as const

export type PermissionTarget = (typeof PERMISSION_TARGETS)[keyof typeof PERMISSION_TARGETS]

/**
 * Permission caveat types
 */
export interface PermissionCaveat {
  /** Caveat type identifier */
  type: string
  /** Caveat value - interpretation depends on type */
  value: unknown
}

/**
 * Restriction caveats for eth_accounts
 */
export interface AccountsCaveat extends PermissionCaveat {
  type: 'restrictReturnedAccounts'
  value: Address[]
}

/**
 * Chain restriction caveat
 */
export interface ChainCaveat extends PermissionCaveat {
  type: 'restrictChains'
  value: number[]
}

/**
 * Expiry caveat for time-limited permissions
 */
export interface ExpiryCaveat extends PermissionCaveat {
  type: 'expiresAt'
  value: number // Unix timestamp
}

/**
 * A single permission
 */
export interface Permission {
  /** The permission target (method name) */
  parentCapability: PermissionTarget | string
  /** When the permission was granted */
  date: number
  /** Unique permission ID */
  id: string
  /** The invoker (origin) that has this permission */
  invoker: string
  /** Restrictions on the permission */
  caveats?: PermissionCaveat[]
}

/**
 * Permission request for wallet_requestPermissions
 */
export type PermissionRequest = Record<string, Record<string, unknown>>

/**
 * Result of checking a permission
 */
export interface PermissionCheckResult {
  /** Whether the permission is granted */
  granted: boolean
  /** The permission if granted */
  permission?: Permission
  /** Reason if not granted */
  reason?: string
  /** Whether the permission is expired */
  expired?: boolean
}

/**
 * Permission manager for handling wallet permissions
 */
export class PermissionManager {
  private provider: EIP1193Provider
  private cachedPermissions: Permission[] = []
  private lastFetchTime = 0
  private cacheTimeout = 30000 // 30 seconds

  constructor(provider: EIP1193Provider) {
    this.provider = provider
  }

  /**
   * Request permissions from the wallet
   *
   * @example
   * ```typescript
   * const permissions = await manager.requestPermissions({
   *   eth_accounts: {},
   *   wallet_signAuthorization: {},
   * })
   * ```
   */
  async requestPermissions(requests: PermissionRequest): Promise<Permission[]> {
    // biome-ignore lint/suspicious/noExplicitAny: PermissionRequest is wider than viem's strict type
    const permissions = (await this.provider.request({
      method: 'wallet_requestPermissions',
      params: [requests as any],
    })) as Permission[]

    // Update cache
    this.cachedPermissions = permissions
    this.lastFetchTime = Date.now()

    return permissions
  }

  /**
   * Get current permissions
   */
  async getPermissions(forceRefresh = false): Promise<Permission[]> {
    // Use cache if available and not expired
    if (
      !forceRefresh &&
      this.cachedPermissions.length > 0 &&
      Date.now() - this.lastFetchTime < this.cacheTimeout
    ) {
      return this.cachedPermissions
    }

    const permissions = (await this.provider.request({
      method: 'wallet_getPermissions',
    })) as Permission[]

    this.cachedPermissions = permissions
    this.lastFetchTime = Date.now()

    return permissions
  }

  /**
   * Check if a specific permission is granted
   */
  async hasPermission(target: PermissionTarget | string): Promise<PermissionCheckResult> {
    const permissions = await this.getPermissions()
    const permission = permissions.find((p) => p.parentCapability === target)

    if (!permission) {
      return { granted: false, reason: 'Permission not granted' }
    }

    // Check for expiry caveat
    const expiryCaveat = permission.caveats?.find((c) => c.type === 'expiresAt') as
      | ExpiryCaveat
      | undefined
    if (expiryCaveat && expiryCaveat.value < Date.now()) {
      return {
        granted: false,
        permission,
        reason: 'Permission expired',
        expired: true,
      }
    }

    return { granted: true, permission }
  }

  /**
   * Check if eth_accounts permission is granted
   */
  async hasAccountsPermission(): Promise<PermissionCheckResult> {
    return this.hasPermission(PERMISSION_TARGETS.ETH_ACCOUNTS)
  }

  /**
   * Get permitted accounts (if any restrictions apply)
   */
  async getPermittedAccounts(): Promise<Address[] | null> {
    const result = await this.hasAccountsPermission()

    if (!result.granted || !result.permission) {
      return null
    }

    const accountsCaveat = result.permission.caveats?.find(
      (c) => c.type === 'restrictReturnedAccounts'
    ) as AccountsCaveat | undefined

    return accountsCaveat?.value ?? null
  }

  /**
   * Get permitted chains (if any restrictions apply)
   */
  async getPermittedChains(target: PermissionTarget | string): Promise<number[] | null> {
    const result = await this.hasPermission(target)

    if (!result.granted || !result.permission) {
      return null
    }

    const chainCaveat = result.permission.caveats?.find((c) => c.type === 'restrictChains') as
      | ChainCaveat
      | undefined

    return chainCaveat?.value ?? null
  }

  /**
   * Revoke a permission (if supported by wallet)
   */
  async revokePermission(target: PermissionTarget | string): Promise<void> {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic permission target key
      await this.provider.request({
        method: 'wallet_revokePermissions',
        params: [{ [target]: {} } as any],
      })

      // Clear cache
      this.cachedPermissions = this.cachedPermissions.filter((p) => p.parentCapability !== target)
    } catch (_error) {
      // wallet_revokePermissions is not standardized, might not be supported
      throw new Error('Permission revocation not supported by this wallet')
    }
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cachedPermissions = []
    this.lastFetchTime = 0
  }

  /**
   * Request accounts permission (convenience method)
   */
  async requestAccountsPermission(): Promise<Permission[]> {
    return this.requestPermissions({
      [PERMISSION_TARGETS.ETH_ACCOUNTS]: {},
    })
  }

  /**
   * Request StableNet-specific permissions
   */
  async requestStableNetPermissions(options?: {
    authorization?: boolean
    userOperation?: boolean
    modules?: boolean
    sessionKeys?: boolean
    stealth?: boolean
  }): Promise<Permission[]> {
    const requests: PermissionRequest = {
      [PERMISSION_TARGETS.ETH_ACCOUNTS]: {},
    }

    if (options?.authorization) {
      requests[PERMISSION_TARGETS.WALLET_SIGN_AUTHORIZATION] = {}
    }
    if (options?.userOperation) {
      requests[PERMISSION_TARGETS.WALLET_SEND_USER_OPERATION] = {}
    }
    if (options?.modules) {
      requests[PERMISSION_TARGETS.WALLET_INSTALL_MODULE] = {}
    }
    if (options?.sessionKeys) {
      requests[PERMISSION_TARGETS.WALLET_CREATE_SESSION_KEY] = {}
    }
    if (options?.stealth) {
      requests[PERMISSION_TARGETS.WALLET_GENERATE_STEALTH_ADDRESS] = {}
    }

    return this.requestPermissions(requests)
  }
}

/**
 * Create a permission manager for the given provider
 */
export function createPermissionManager(provider: EIP1193Provider): PermissionManager {
  return new PermissionManager(provider)
}

/**
 * Permission request builder for fluent API
 */
export class PermissionRequestBuilder {
  private requests: PermissionRequest = {}

  /**
   * Request eth_accounts permission
   */
  accounts(restrictTo?: Address[]): this {
    this.requests[PERMISSION_TARGETS.ETH_ACCOUNTS] = restrictTo
      ? { restrictReturnedAccounts: restrictTo }
      : {}
    return this
  }

  /**
   * Request personal_sign permission
   */
  personalSign(): this {
    this.requests[PERMISSION_TARGETS.PERSONAL_SIGN] = {}
    return this
  }

  /**
   * Request eth_signTypedData_v4 permission
   */
  signTypedData(): this {
    this.requests[PERMISSION_TARGETS.ETH_SIGN_TYPED_DATA_V4] = {}
    return this
  }

  /**
   * Request eth_sendTransaction permission
   */
  sendTransaction(): this {
    this.requests[PERMISSION_TARGETS.ETH_SEND_TRANSACTION] = {}
    return this
  }

  /**
   * Request wallet_signAuthorization permission (EIP-7702)
   */
  signAuthorization(): this {
    this.requests[PERMISSION_TARGETS.WALLET_SIGN_AUTHORIZATION] = {}
    return this
  }

  /**
   * Request wallet_sendUserOperation permission (EIP-4337)
   */
  sendUserOperation(): this {
    this.requests[PERMISSION_TARGETS.WALLET_SEND_USER_OPERATION] = {}
    return this
  }

  /**
   * Request wallet_installModule permission (ERC-7579)
   */
  installModule(): this {
    this.requests[PERMISSION_TARGETS.WALLET_INSTALL_MODULE] = {}
    return this
  }

  /**
   * Request wallet_createSessionKey permission
   */
  createSessionKey(): this {
    this.requests[PERMISSION_TARGETS.WALLET_CREATE_SESSION_KEY] = {}
    return this
  }

  /**
   * Request wallet_generateStealthAddress permission (EIP-5564)
   */
  generateStealthAddress(): this {
    this.requests[PERMISSION_TARGETS.WALLET_GENERATE_STEALTH_ADDRESS] = {}
    return this
  }

  /**
   * Request a custom permission
   */
  custom(target: string, caveats?: Record<string, unknown>): this {
    this.requests[target] = caveats ?? {}
    return this
  }

  /**
   * Build the permission request
   */
  build(): PermissionRequest {
    return { ...this.requests }
  }
}

/**
 * Create a permission request builder
 *
 * @example
 * ```typescript
 * const request = permissionRequest()
 *   .accounts()
 *   .signAuthorization()
 *   .sendUserOperation()
 *   .build()
 *
 * const permissions = await manager.requestPermissions(request)
 * ```
 */
export function permissionRequest(): PermissionRequestBuilder {
  return new PermissionRequestBuilder()
}
