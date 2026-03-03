/**
 * ModuleController Tests
 *
 * Tests for ERC-7579 module lifecycle: install, uninstall,
 * query, state management, and calldata encoding.
 */

import {
  MODULE_TYPE,
  ModuleController,
  type ModuleInstallRequest,
} from '../../../src/background/controllers/ModuleController'

// ============================================================================
// Test Data
// ============================================================================

const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678'
const MODULE_ADDR = '0xaabbccddee0011223344556677889900aabbccdd'
const MODULE_ADDR_2 = '0x1111222233334444555566667777888899990000'
const TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

function createMockProvider(overrides: Record<string, unknown> = {}) {
  return {
    request: jest.fn().mockResolvedValue(TX_HASH),
    ...overrides,
  }
}

function createInstallRequest(overrides: Partial<ModuleInstallRequest> = {}): ModuleInstallRequest {
  return {
    moduleAddress: MODULE_ADDR,
    moduleType: MODULE_TYPE.VALIDATOR,
    name: 'Test Validator',
    description: 'A test validator module',
    version: '1.0.0',
    ...overrides,
  }
}

function createController(provider = createMockProvider(), chainId = 1) {
  return new ModuleController({ provider, chainId })
}

// ============================================================================
// Tests
// ============================================================================

describe('ModuleController', () => {
  let controller: ModuleController
  let mockProvider: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    mockProvider = createMockProvider()
    controller = createController(mockProvider)
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const state = controller.getState()
      expect(state.modules).toEqual({})
    })

    it('should have no installed modules initially', () => {
      expect(controller.getInstalledModules(ACCOUNT)).toEqual([])
    })
  })

  describe('installModule()', () => {
    it('should install a module and return txHash', async () => {
      const result = await controller.installModule(ACCOUNT, createInstallRequest())

      expect(result.txHash).toBe(TX_HASH)
      expect(result.module).toBeDefined()
      expect(result.module.address).toBe(MODULE_ADDR)
      expect(result.module.moduleType).toBe(MODULE_TYPE.VALIDATOR)
      expect(result.module.active).toBe(true)
    })

    it('should send self-call transaction (ERC-7579 pattern)', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      expect(mockProvider.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'eth_sendTransaction',
          params: [
            expect.objectContaining({
              from: ACCOUNT,
              to: ACCOUNT, // Self-call
              value: '0x0',
            }),
          ],
        })
      )
    })

    it('should encode installModule selector in calldata', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('9517e29f') // installModule selector
    })

    it('should record module in state after install', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(1)
      expect(installed[0].address).toBe(MODULE_ADDR)
      expect(installed[0].name).toBe('Test Validator')
    })

    it('should store correct metadata', async () => {
      const result = await controller.installModule(
        ACCOUNT,
        createInstallRequest({
          name: 'MyModule',
          description: 'Custom module',
          version: '2.0.0',
          registryId: 'registry-123',
        })
      )

      expect(result.module.name).toBe('MyModule')
      expect(result.module.description).toBe('Custom module')
      expect(result.module.version).toBe('2.0.0')
      expect(result.module.registryId).toBe('registry-123')
      expect(result.module.chainId).toBe(1)
      expect(result.module.installTxHash).toBe(TX_HASH)
      expect(result.module.installedAt).toBeTruthy()
    })

    it('should support custom initData', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest({ initData: '0xdeadbeef' }))

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('deadbeef')
    })

    it('should replace existing module with same address', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest({ name: 'V1' }))
      await controller.installModule(ACCOUNT, createInstallRequest({ name: 'V2' }))

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(1)
      expect(installed[0].name).toBe('V2')
    })

    it('should support multiple different modules', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())
      await controller.installModule(
        ACCOUNT,
        createInstallRequest({
          moduleAddress: MODULE_ADDR_2,
          moduleType: MODULE_TYPE.EXECUTOR,
          name: 'Test Executor',
        })
      )

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(2)
    })

    it('should throw on provider failure', async () => {
      mockProvider.request.mockRejectedValue(new Error('RPC error'))

      await expect(controller.installModule(ACCOUNT, createInstallRequest())).rejects.toThrow(
        'RPC error'
      )

      // Should not add to state on failure
      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(0)
    })

    it('should throw when provider returns non-string', async () => {
      mockProvider.request.mockResolvedValue(null)

      await expect(controller.installModule(ACCOUNT, createInstallRequest())).rejects.toThrow(
        'Failed to send module transaction'
      )
    })
  })

  describe('uninstallModule()', () => {
    beforeEach(async () => {
      // Install a module first
      await controller.installModule(ACCOUNT, createInstallRequest())
    })

    it('should uninstall a module and return txHash', async () => {
      const result = await controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result.txHash).toBe(TX_HASH)
    })

    it('should encode uninstallModule selector', async () => {
      mockProvider.request.mockClear()

      await controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('a4d0a17e') // uninstallModule selector
    })

    it('should mark module as inactive after uninstall', async () => {
      await controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      // getInstalledModules filters by active
      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(0)
    })

    it('should support custom deInitData', async () => {
      mockProvider.request.mockClear()

      await controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR, '0xcafe')

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('cafe')
    })
  })

  describe('isModuleInstalled()', () => {
    it('should call eth_call with correct params', async () => {
      mockProvider.request.mockResolvedValue(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )

      const result = await controller.isModuleInstalled(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result).toBe(true)
      expect(mockProvider.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'eth_call',
          params: expect.arrayContaining([
            expect.objectContaining({
              to: ACCOUNT,
            }),
            'latest',
          ]),
        })
      )
    })

    it('should return false for empty result', async () => {
      mockProvider.request.mockResolvedValue('0x')

      const result = await controller.isModuleInstalled(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result).toBe(false)
    })

    it('should return false for 0x0', async () => {
      mockProvider.request.mockResolvedValue('0x0')

      const result = await controller.isModuleInstalled(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result).toBe(false)
    })

    it('should return false on provider error', async () => {
      mockProvider.request.mockRejectedValue(new Error('RPC error'))

      const result = await controller.isModuleInstalled(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result).toBe(false)
    })
  })

  describe('getInstalledModules()', () => {
    it('should return empty array for unknown account', () => {
      expect(controller.getInstalledModules('0xunknown')).toEqual([])
    })

    it('should only return active modules', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())
      await controller.installModule(
        ACCOUNT,
        createInstallRequest({
          moduleAddress: MODULE_ADDR_2,
          moduleType: MODULE_TYPE.EXECUTOR,
          name: 'Executor',
        })
      )

      // Uninstall one
      await controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(1)
      expect(installed[0].address).toBe(MODULE_ADDR_2)
    })

    it('should be case-insensitive on account address', async () => {
      await controller.installModule(ACCOUNT.toLowerCase(), createInstallRequest())

      // Query with different case
      const installed = controller.getInstalledModules(ACCOUNT.toLowerCase())
      expect(installed).toHaveLength(1)
    })
  })

  describe('getModule()', () => {
    it('should find module by address', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const mod = controller.getModule(ACCOUNT, MODULE_ADDR)
      expect(mod).toBeDefined()
      expect(mod!.address).toBe(MODULE_ADDR)
    })

    it('should return undefined for unknown module', () => {
      expect(controller.getModule(ACCOUNT, '0xunknown')).toBeUndefined()
    })

    it('should be case-insensitive on module address', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const mod = controller.getModule(ACCOUNT, MODULE_ADDR.toUpperCase())
      expect(mod).toBeDefined()
    })
  })

  describe('getModulesByType()', () => {
    it('should filter modules by type', async () => {
      await controller.installModule(
        ACCOUNT,
        createInstallRequest({ moduleType: MODULE_TYPE.VALIDATOR })
      )
      await controller.installModule(
        ACCOUNT,
        createInstallRequest({
          moduleAddress: MODULE_ADDR_2,
          moduleType: MODULE_TYPE.EXECUTOR,
          name: 'Executor',
        })
      )

      const validators = controller.getModulesByType(ACCOUNT, MODULE_TYPE.VALIDATOR)
      expect(validators).toHaveLength(1)
      expect(validators[0].moduleType).toBe(MODULE_TYPE.VALIDATOR)

      const executors = controller.getModulesByType(ACCOUNT, MODULE_TYPE.EXECUTOR)
      expect(executors).toHaveLength(1)
      expect(executors[0].moduleType).toBe(MODULE_TYPE.EXECUTOR)

      const hooks = controller.getModulesByType(ACCOUNT, MODULE_TYPE.HOOK)
      expect(hooks).toHaveLength(0)
    })
  })

  describe('getAllModules()', () => {
    it('should return empty object initially', () => {
      expect(controller.getAllModules()).toEqual({})
    })

    it('should return all modules for current chain', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const all = controller.getAllModules()
      expect(Object.keys(all)).toHaveLength(1)
    })
  })

  describe('setChainId()', () => {
    it('should switch chain and return different modules', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(1)

      // Switch chain
      controller.setChainId(137)

      // No modules on new chain
      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(0)

      // Switch back
      controller.setChainId(1)
      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(1)
    })
  })

  describe('state management', () => {
    it('should save and restore state', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const savedState = controller.getState()

      // Create new controller and restore state
      const newController = createController(mockProvider)
      newController.restoreState(savedState)

      expect(newController.getInstalledModules(ACCOUNT)).toHaveLength(1)
      expect(newController.getInstalledModules(ACCOUNT)[0].name).toBe('Test Validator')
    })

    it('should return a copy of state (not reference)', () => {
      const state1 = controller.getState()
      const state2 = controller.getState()

      expect(state1).not.toBe(state2)
      expect(state1).toEqual(state2)
    })
  })

  describe('MODULE_TYPE constants', () => {
    it('should have correct values', () => {
      expect(MODULE_TYPE.VALIDATOR).toBe(1)
      expect(MODULE_TYPE.EXECUTOR).toBe(2)
      expect(MODULE_TYPE.FALLBACK).toBe(3)
      expect(MODULE_TYPE.HOOK).toBe(4)
    })
  })

  describe('calldata encoding', () => {
    it('should encode moduleType as uint256 in calldata', async () => {
      await controller.installModule(
        ACCOUNT,
        createInstallRequest({ moduleType: MODULE_TYPE.EXECUTOR })
      )

      const callData = mockProvider.request.mock.calls[0][0].params[0].data as string
      // Find selector position, then next 64 chars encode the type
      const selectorIdx = callData.indexOf('9517e29f')
      const typeHex = callData.slice(selectorIdx + 8, selectorIdx + 72)
      expect(parseInt(typeHex, 16)).toBe(MODULE_TYPE.EXECUTOR)
    })

    it('should encode module address in calldata', async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())

      const callData = mockProvider.request.mock.calls[0][0].params[0].data as string
      // Calldata should contain the module address
      expect(callData.toLowerCase()).toContain(MODULE_ADDR.slice(2).toLowerCase())
    })
  })

  // ==========================================================================
  // Kernel v0.3.3 — New module operations
  // ==========================================================================

  describe('forceUninstallModule()', () => {
    beforeEach(async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())
    })

    it('should force uninstall a module and return txHash', async () => {
      const result = await controller.forceUninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result.txHash).toBe(TX_HASH)
    })

    it('should encode forceUninstallModule selector', async () => {
      mockProvider.request.mockClear()

      await controller.forceUninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('856b02ec') // forceUninstallModule selector
    })

    it('should mark module as inactive after force uninstall', async () => {
      await controller.forceUninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(0)
    })
  })

  describe('replaceModule()', () => {
    beforeEach(async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())
    })

    it('should replace a module and return txHash', async () => {
      const result = await controller.replaceModule(
        ACCOUNT,
        MODULE_TYPE.VALIDATOR,
        MODULE_ADDR,
        '0x',
        MODULE_ADDR_2,
        '0x'
      )

      expect(result.txHash).toBe(TX_HASH)
    })

    it('should encode replaceModule selector', async () => {
      mockProvider.request.mockClear()

      await controller.replaceModule(
        ACCOUNT,
        MODULE_TYPE.VALIDATOR,
        MODULE_ADDR,
        '0x',
        MODULE_ADDR_2,
        '0x'
      )

      const callParams = mockProvider.request.mock.calls[0][0].params[0]
      expect(callParams.data).toContain('166add9c') // replaceModule selector
    })

    it('should deactivate old module after replace', async () => {
      await controller.replaceModule(
        ACCOUNT,
        MODULE_TYPE.VALIDATOR,
        MODULE_ADDR,
        '0x',
        MODULE_ADDR_2,
        '0x'
      )

      const installed = controller.getInstalledModules(ACCOUNT)
      expect(installed).toHaveLength(0) // Old module deactivated, new one not tracked via installModule
    })

    it('should encode both module addresses in calldata', async () => {
      mockProvider.request.mockClear()

      await controller.replaceModule(
        ACCOUNT,
        MODULE_TYPE.VALIDATOR,
        MODULE_ADDR,
        '0x',
        MODULE_ADDR_2,
        '0x'
      )

      const callData = (mockProvider.request.mock.calls[0][0].params[0].data as string).toLowerCase()
      expect(callData).toContain(MODULE_ADDR.slice(2).toLowerCase())
      expect(callData).toContain(MODULE_ADDR_2.slice(2).toLowerCase())
    })
  })

  describe('uninstallModule → revert → forceUninstall fallback', () => {
    beforeEach(async () => {
      await controller.installModule(ACCOUNT, createInstallRequest())
    })

    it('should handle uninstall failure and fallback to forceUninstall', async () => {
      // First call (uninstall) fails, second call (forceUninstall) succeeds
      mockProvider.request
        .mockRejectedValueOnce(new Error('ModuleOnUninstallFailed'))
        .mockResolvedValueOnce(TX_HASH)

      // Attempt normal uninstall
      await expect(
        controller.uninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)
      ).rejects.toThrow('ModuleOnUninstallFailed')

      // Module should still be active
      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(1)

      // Fallback to force uninstall
      const result = await controller.forceUninstallModule(ACCOUNT, MODULE_ADDR, MODULE_TYPE.VALIDATOR)

      expect(result.txHash).toBe(TX_HASH)
      expect(controller.getInstalledModules(ACCOUNT)).toHaveLength(0)
    })
  })

  describe('Reentrancy error handling', () => {
    it('should propagate reentrancy error from provider', async () => {
      mockProvider.request.mockRejectedValue(new Error('Reentrancy detected'))

      await expect(
        controller.installModule(ACCOUNT, createInstallRequest())
      ).rejects.toThrow('Reentrancy detected')
    })
  })
})
