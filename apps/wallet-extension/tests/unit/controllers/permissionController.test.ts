/**
 * PermissionController Tests
 * TDD tests for dApp permission management
 */

import { PermissionController } from '../../../src/background/controllers/permissionController'
import type {
  PermissionControllerOptions,
  PermissionType,
} from '../../../src/background/controllers/permissionController.types'
import { TEST_ACCOUNTS, TEST_ORIGINS } from '../../utils/testUtils'

describe('PermissionController', () => {
  let controller: PermissionController
  let mockOptions: PermissionControllerOptions
  const testAddress = TEST_ACCOUNTS.account1.address
  const testAddress2 = TEST_ACCOUNTS.account2.address
  const testOrigin = TEST_ORIGINS.trusted

  beforeEach(() => {
    mockOptions = {
      getSelectedAddress: jest.fn(() => testAddress),
      getAllAddresses: jest.fn(() => [testAddress, testAddress2]),
    }

    controller = new PermissionController(mockOptions)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('requestPermissions', () => {
    it('should create permission request', async () => {
      const permissions: PermissionType[] = ['eth_accounts']

      const request = await controller.requestPermissions(testOrigin, permissions)

      expect(request).toBeDefined()
      expect(request.origin).toBe(testOrigin)
      expect(request.permissions).toContain('eth_accounts')
    })

    it('should generate unique request ID', async () => {
      const permissions: PermissionType[] = ['eth_accounts']

      const request1 = await controller.requestPermissions(testOrigin, permissions)
      const request2 = await controller.requestPermissions(testOrigin, permissions)

      expect(request1.id).not.toBe(request2.id)
    })

    it('should emit permission:requested event', async () => {
      const eventHandler = jest.fn()
      controller.on('permission:requested', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      await controller.requestPermissions(testOrigin, permissions)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: testOrigin,
          permissions: ['eth_accounts'],
        })
      )
    })

    it('should add to pending requests', async () => {
      const permissions: PermissionType[] = ['eth_accounts']

      const request = await controller.requestPermissions(testOrigin, permissions)
      const state = controller.getState()

      expect(state.pendingRequests[request.id]).toBeDefined()
    })

    it('should include metadata if provided', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const metadata = { name: 'Test dApp', icon: 'https://example.com/icon.png' }

      const request = await controller.requestPermissions(testOrigin, permissions, metadata)

      expect(request.metadata?.name).toBe('Test dApp')
      expect(request.metadata?.icon).toBe('https://example.com/icon.png')
    })
  })

  describe('approvePermissions', () => {
    it('should store granted permissions', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)

      await controller.approvePermissions(request.id, [testAddress])

      const originPermissions = controller.getPermissionsForOrigin(testOrigin)
      expect(originPermissions).toBeDefined()
      expect(originPermissions!.accounts).toContain(testAddress)
    })

    it('should emit permission:approved event', async () => {
      const eventHandler = jest.fn()
      controller.on('permission:approved', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      expect(eventHandler).toHaveBeenCalledWith(
        testOrigin,
        expect.arrayContaining([
          expect.objectContaining({
            parentCapability: 'eth_accounts',
          }),
        ])
      )
    })

    it('should remove from pending requests', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)

      await controller.approvePermissions(request.id, [testAddress])

      const state = controller.getState()
      expect(state.pendingRequests[request.id]).toBeUndefined()
    })

    it('should throw if request not found', async () => {
      await expect(controller.approvePermissions('nonexistent', [testAddress])).rejects.toThrow(
        'Permission request not found'
      )
    })

    it('should create permissions with caveats for restricted accounts', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)

      await controller.approvePermissions(request.id, [testAddress])

      const originPermissions = controller.getPermissionsForOrigin(testOrigin)
      const ethAccountsPerm = originPermissions!.permissions.find(
        (p) => p.parentCapability === 'eth_accounts'
      )

      expect(ethAccountsPerm?.caveats).toContainEqual(
        expect.objectContaining({
          type: 'restrictToAccounts',
          value: [testAddress],
        })
      )
    })
  })

  describe('rejectPermissions', () => {
    it('should remove pending request', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)

      await controller.rejectPermissions(request.id)

      const state = controller.getState()
      expect(state.pendingRequests[request.id]).toBeUndefined()
    })

    it('should emit permission:rejected event', async () => {
      const eventHandler = jest.fn()
      controller.on('permission:rejected', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.rejectPermissions(request.id)

      expect(eventHandler).toHaveBeenCalledWith(testOrigin, request.id)
    })

    it('should throw if request not found', async () => {
      await expect(controller.rejectPermissions('nonexistent')).rejects.toThrow(
        'Permission request not found'
      )
    })
  })

  describe('hasPermission', () => {
    it('should return true for granted permission', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      const hasPermission = controller.hasPermission(testOrigin, 'eth_accounts')

      expect(hasPermission).toBe(true)
    })

    it('should return false for denied permission', () => {
      const hasPermission = controller.hasPermission(testOrigin, 'eth_accounts')

      expect(hasPermission).toBe(false)
    })

    it('should return false for unknown origin', () => {
      const hasPermission = controller.hasPermission('https://unknown.com', 'eth_accounts')

      expect(hasPermission).toBe(false)
    })
  })

  describe('revokePermission', () => {
    it('should remove permission', async () => {
      const permissions: PermissionType[] = ['eth_accounts', 'personal_sign']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      await controller.revokePermission(testOrigin, 'eth_accounts')

      expect(controller.hasPermission(testOrigin, 'eth_accounts')).toBe(false)
      expect(controller.hasPermission(testOrigin, 'personal_sign')).toBe(true)
    })

    it('should emit permission:revoked event', async () => {
      const eventHandler = jest.fn()
      controller.on('permission:revoked', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])
      await controller.revokePermission(testOrigin, 'eth_accounts')

      expect(eventHandler).toHaveBeenCalledWith(testOrigin, 'eth_accounts')
    })

    it('should do nothing if permission not found', async () => {
      // Should not throw
      await controller.revokePermission(testOrigin, 'eth_accounts')
    })
  })

  describe('revokeAllPermissions', () => {
    it('should remove all permissions for origin', async () => {
      const permissions: PermissionType[] = ['eth_accounts', 'personal_sign']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      await controller.revokeAllPermissions(testOrigin)

      expect(controller.hasPermission(testOrigin, 'eth_accounts')).toBe(false)
      expect(controller.hasPermission(testOrigin, 'personal_sign')).toBe(false)
    })

    it('should emit accounts:changed event with empty array', async () => {
      const eventHandler = jest.fn()
      controller.on('accounts:changed', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])
      await controller.revokeAllPermissions(testOrigin)

      expect(eventHandler).toHaveBeenCalledWith(testOrigin, [])
    })
  })

  describe('getPermissionsForOrigin', () => {
    it('should return all permissions for origin', async () => {
      const permissions: PermissionType[] = ['eth_accounts', 'personal_sign']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      const originPermissions = controller.getPermissionsForOrigin(testOrigin)

      expect(originPermissions).toBeDefined()
      expect(originPermissions!.permissions.length).toBe(2)
    })

    it('should return undefined for unknown origin', () => {
      const originPermissions = controller.getPermissionsForOrigin('https://unknown.com')

      expect(originPermissions).toBeUndefined()
    })

    it('should apply caveats correctly', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      const originPermissions = controller.getPermissionsForOrigin(testOrigin)

      expect(originPermissions!.accounts).toEqual([testAddress])
    })
  })

  describe('getAccountsForOrigin', () => {
    it('should return approved accounts for origin', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress, testAddress2])

      const accounts = controller.getAccountsForOrigin(testOrigin)

      expect(accounts).toContain(testAddress)
      expect(accounts).toContain(testAddress2)
    })

    it('should return empty array for unknown origin', () => {
      const accounts = controller.getAccountsForOrigin('https://unknown.com')

      expect(accounts).toEqual([])
    })
  })

  describe('updateAccountsForOrigin', () => {
    it('should update permitted accounts', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      await controller.updateAccountsForOrigin(testOrigin, [testAddress2])

      const accounts = controller.getAccountsForOrigin(testOrigin)
      expect(accounts).toEqual([testAddress2])
    })

    it('should emit accounts:changed event', async () => {
      const eventHandler = jest.fn()
      controller.on('accounts:changed', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])
      await controller.updateAccountsForOrigin(testOrigin, [testAddress2])

      expect(eventHandler).toHaveBeenCalledWith(testOrigin, [testAddress2])
    })

    it('should do nothing if origin not connected', async () => {
      // Should not throw
      await controller.updateAccountsForOrigin('https://unknown.com', [testAddress])
    })
  })

  describe('isConnected', () => {
    it('should return true if origin has any permissions', async () => {
      const permissions: PermissionType[] = ['eth_accounts']
      const request = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request.id, [testAddress])

      expect(controller.isConnected(testOrigin)).toBe(true)
    })

    it('should return false if origin has no permissions', () => {
      expect(controller.isConnected(testOrigin)).toBe(false)
    })
  })

  describe('getConnectedOrigins', () => {
    it('should return all connected origins', async () => {
      const permissions: PermissionType[] = ['eth_accounts']

      const request1 = await controller.requestPermissions(testOrigin, permissions)
      await controller.approvePermissions(request1.id, [testAddress])

      const request2 = await controller.requestPermissions(TEST_ORIGINS.untrusted, permissions)
      await controller.approvePermissions(request2.id, [testAddress])

      const origins = controller.getConnectedOrigins()

      expect(origins).toContain(testOrigin)
      expect(origins).toContain(TEST_ORIGINS.untrusted)
    })
  })

  describe('getPendingRequests', () => {
    it('should return all pending permission requests', async () => {
      const permissions: PermissionType[] = ['eth_accounts']

      await controller.requestPermissions(testOrigin, permissions)
      await controller.requestPermissions(TEST_ORIGINS.untrusted, permissions)

      const pending = controller.getPendingRequests()

      expect(pending.length).toBe(2)
    })
  })

  describe('clearPendingRequests', () => {
    it('should reject all pending requests', async () => {
      const eventHandler = jest.fn()
      controller.on('permission:rejected', eventHandler)

      const permissions: PermissionType[] = ['eth_accounts']
      await controller.requestPermissions(testOrigin, permissions)
      await controller.requestPermissions(TEST_ORIGINS.untrusted, permissions)

      await controller.clearPendingRequests()

      const pending = controller.getPendingRequests()
      expect(pending.length).toBe(0)
      expect(eventHandler).toHaveBeenCalledTimes(2)
    })
  })
})
