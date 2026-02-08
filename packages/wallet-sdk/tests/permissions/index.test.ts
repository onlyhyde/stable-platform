import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_TARGETS, PermissionManager, permissionRequest } from '../../src/permissions'
import type { EIP1193Provider } from '../../src/types'
import { createMockProvider } from '../setup'

describe('PermissionManager', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let manager: PermissionManager

  beforeEach(() => {
    mockProvider = createMockProvider()
    manager = new PermissionManager(mockProvider as unknown as EIP1193Provider)
  })

  describe('requestPermissions', () => {
    it('should request permissions and cache result', async () => {
      const permissions = await manager.requestPermissions({
        eth_accounts: {},
      })

      expect(permissions).toHaveLength(1)
      expect(permissions[0].parentCapability).toBe('eth_accounts')
    })
  })

  describe('getPermissions', () => {
    it('should fetch permissions from provider', async () => {
      const permissions = await manager.getPermissions()
      expect(permissions).toHaveLength(1)
    })

    it('should use cache on subsequent calls', async () => {
      const requestSpy = vi.spyOn(mockProvider, 'request')

      await manager.getPermissions() // First call - fetches
      await manager.getPermissions() // Second call - should use cache

      // wallet_getPermissions should only be called once
      const permCalls = requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'wallet_getPermissions'
      )
      expect(permCalls).toHaveLength(1)
    })

    it('should force refresh when requested', async () => {
      const requestSpy = vi.spyOn(mockProvider, 'request')

      await manager.getPermissions()
      await manager.getPermissions(true) // force refresh

      const permCalls = requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'wallet_getPermissions'
      )
      expect(permCalls).toHaveLength(2)
    })
  })

  describe('hasPermission', () => {
    it('should return granted for existing permission', async () => {
      const result = await manager.hasPermission('eth_accounts')
      expect(result.granted).toBe(true)
      expect(result.permission).toBeDefined()
    })

    it('should return not granted for missing permission', async () => {
      const result = await manager.hasPermission('eth_sendTransaction')
      expect(result.granted).toBe(false)
      expect(result.reason).toBe('Permission not granted')
    })

    it('should detect expired permissions', async () => {
      const expiredPermissions = [
        {
          parentCapability: 'eth_accounts',
          date: Date.now() - 100000,
          id: 'perm-expired',
          invoker: 'https://example.com',
          caveats: [
            {
              type: 'expiresAt',
              value: Date.now() - 1000, // expired
            },
          ],
        },
      ]

      // Override both getPermissions and requestPermissions
      const expiredProvider = createMockProvider({
        wallet_getPermissions: expiredPermissions,
        wallet_requestPermissions: expiredPermissions,
      })

      const expiredManager = new PermissionManager(expiredProvider as unknown as EIP1193Provider)
      const result = await expiredManager.hasPermission('eth_accounts')
      expect(result.granted).toBe(false)
      expect(result.expired).toBe(true)
    })
  })

  describe('hasAccountsPermission', () => {
    it('should check for eth_accounts permission', async () => {
      const result = await manager.hasAccountsPermission()
      expect(result.granted).toBe(true)
    })
  })

  describe('clearCache', () => {
    it('should clear cached permissions', async () => {
      await manager.getPermissions()
      manager.clearCache()

      // Next call should fetch again
      const requestSpy = vi.spyOn(mockProvider, 'request')
      await manager.getPermissions()
      const permCalls = requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'wallet_getPermissions'
      )
      expect(permCalls).toHaveLength(1)
    })
  })

  describe('revokePermission', () => {
    it('should request permission revocation', async () => {
      // The default mock already supports wallet_revokePermissions
      await manager.requestPermissions({ eth_accounts: {} })

      // Should not throw since mock returns null for wallet_revokePermissions
      await expect(manager.revokePermission('eth_accounts')).resolves.not.toThrow()
    })
  })
})

describe('PermissionRequestBuilder', () => {
  it('should build empty request by default', () => {
    const request = permissionRequest().build()
    expect(request).toEqual({})
  })

  it('should build accounts request', () => {
    const request = permissionRequest().accounts().build()
    expect(request).toHaveProperty(PERMISSION_TARGETS.ETH_ACCOUNTS)
  })

  it('should build accounts with restrictions', () => {
    const accounts = ['0x1234' as `0x${string}`]
    const request = permissionRequest().accounts(accounts).build()
    expect(request[PERMISSION_TARGETS.ETH_ACCOUNTS]).toEqual({
      restrictReturnedAccounts: accounts,
    })
  })

  it('should chain multiple permissions', () => {
    const request = permissionRequest()
      .accounts()
      .personalSign()
      .signTypedData()
      .sendTransaction()
      .build()

    expect(Object.keys(request)).toHaveLength(4)
    expect(request).toHaveProperty(PERMISSION_TARGETS.ETH_ACCOUNTS)
    expect(request).toHaveProperty(PERMISSION_TARGETS.PERSONAL_SIGN)
    expect(request).toHaveProperty(PERMISSION_TARGETS.ETH_SIGN_TYPED_DATA_V4)
    expect(request).toHaveProperty(PERMISSION_TARGETS.ETH_SEND_TRANSACTION)
  })

  it('should support StableNet-specific permissions', () => {
    const request = permissionRequest()
      .signAuthorization()
      .sendUserOperation()
      .installModule()
      .createSessionKey()
      .generateStealthAddress()
      .build()

    expect(Object.keys(request)).toHaveLength(5)
  })

  it('should support custom permissions', () => {
    const request = permissionRequest().custom('custom_method', { foo: 'bar' }).build()

    expect(request).toHaveProperty('custom_method')
    expect(request.custom_method).toEqual({ foo: 'bar' })
  })
})
