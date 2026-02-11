/**
 * Tests for @stablenet/plugin-modules
 */

import { describe, expect, it } from 'vitest'
import {
  buildBatchInstallModuleCalls,
  buildInstallModuleCall,
  buildUninstallModuleCall,
  ECDSAValidatorAbi,
  // Init data encoders
  encodeECDSAValidatorInitData,
  encodeHealthFactorHookInitData,
  // Actions
  encodeInstallModule,
  encodeLendingExecutorInitData,
  encodeMultiSigValidatorInitData,
  encodePolicyHookInitData,
  encodeSessionKeyExecutorInitData,
  encodeSpendingLimitHookInitData,
  encodeStakingExecutorInitData,
  encodeSwapExecutorInitData,
  encodeUninstallModule,
  encodeWebAuthnValidatorInitData,
  getModuleTypeName,
  IModuleAbi,
  InvalidModuleTypeError,
  // ABIs
  KernelModuleAbi,
  // Types and constants
  MODULE_TYPES,
  ModuleError,
  ModuleInstallationError,
  ModuleNotInstalledError,
  SessionKeyExecutorAbi,
  SpendingLimitHookAbi,
  validateModuleType,
} from '../src'
import { TEST_ADDRESSES, TEST_VALUES } from './setup'

describe('@stablenet/plugin-modules', () => {
  describe('MODULE_TYPES', () => {
    it('should have correct module type values', () => {
      expect(MODULE_TYPES.VALIDATOR).toBe(1n)
      expect(MODULE_TYPES.EXECUTOR).toBe(2n)
      expect(MODULE_TYPES.FALLBACK).toBe(3n)
      expect(MODULE_TYPES.HOOK).toBe(4n)
    })
  })

  describe('ABIs', () => {
    it('should export KernelModuleAbi', () => {
      expect(KernelModuleAbi).toBeDefined()
      expect(Array.isArray(KernelModuleAbi)).toBe(true)
      expect(KernelModuleAbi.length).toBeGreaterThan(0)
    })

    it('should export IModuleAbi', () => {
      expect(IModuleAbi).toBeDefined()
      expect(Array.isArray(IModuleAbi)).toBe(true)
    })

    it('should export ECDSAValidatorAbi', () => {
      expect(ECDSAValidatorAbi).toBeDefined()
      expect(Array.isArray(ECDSAValidatorAbi)).toBe(true)
    })

    it('should export SessionKeyExecutorAbi', () => {
      expect(SessionKeyExecutorAbi).toBeDefined()
      expect(Array.isArray(SessionKeyExecutorAbi)).toBe(true)
    })

    it('should export SpendingLimitHookAbi', () => {
      expect(SpendingLimitHookAbi).toBeDefined()
      expect(Array.isArray(SpendingLimitHookAbi)).toBe(true)
    })
  })

  describe('Error Classes', () => {
    it('should create ModuleError correctly', () => {
      const error = new ModuleError('Test error', 'TEST_CODE', { detail: 'value' })
      expect(error.name).toBe('ModuleError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.details).toEqual({ detail: 'value' })
    })

    it('should create ModuleInstallationError correctly', () => {
      const error = new ModuleInstallationError('Install failed', 'INSTALL_FAILED')
      expect(error.name).toBe('ModuleInstallationError')
      expect(error.message).toBe('Install failed')
    })

    it('should create ModuleNotInstalledError correctly', () => {
      const error = new ModuleNotInstalledError('Module not found', 'NOT_INSTALLED')
      expect(error.name).toBe('ModuleNotInstalledError')
    })

    it('should create InvalidModuleTypeError correctly', () => {
      const error = new InvalidModuleTypeError('Invalid type', 'INVALID_TYPE')
      expect(error.name).toBe('InvalidModuleTypeError')
    })
  })

  describe('encodeInstallModule', () => {
    it('should encode install module call data', () => {
      const callData = encodeInstallModule({
        moduleType: MODULE_TYPES.VALIDATOR,
        module: TEST_ADDRESSES.VALIDATOR,
        initData: TEST_ADDRESSES.OWNER,
      })

      expect(callData).toMatch(/^0x/)
      expect(callData.length).toBeGreaterThan(10)
    })

    it('should encode different module types', () => {
      const validatorData = encodeInstallModule({
        moduleType: MODULE_TYPES.VALIDATOR,
        module: TEST_ADDRESSES.VALIDATOR,
        initData: '0x',
      })

      const executorData = encodeInstallModule({
        moduleType: MODULE_TYPES.EXECUTOR,
        module: TEST_ADDRESSES.EXECUTOR,
        initData: '0x',
      })

      // Different module types should produce different call data
      expect(validatorData).not.toBe(executorData)
    })
  })

  describe('encodeUninstallModule', () => {
    it('should encode uninstall module call data', () => {
      const callData = encodeUninstallModule({
        moduleType: MODULE_TYPES.VALIDATOR,
        module: TEST_ADDRESSES.VALIDATOR,
        deInitData: '0x',
      })

      expect(callData).toMatch(/^0x/)
      expect(callData.length).toBeGreaterThan(10)
    })
  })

  describe('buildInstallModuleCall', () => {
    it('should build install module call', () => {
      const call = buildInstallModuleCall(TEST_ADDRESSES.SMART_ACCOUNT, {
        moduleType: MODULE_TYPES.VALIDATOR,
        module: TEST_ADDRESSES.VALIDATOR,
        initData: TEST_ADDRESSES.OWNER,
      })

      expect(call.to).toBe(TEST_ADDRESSES.SMART_ACCOUNT)
      expect(call.data).toMatch(/^0x/)
      expect(call.value).toBe(0n)
    })
  })

  describe('buildUninstallModuleCall', () => {
    it('should build uninstall module call', () => {
      const call = buildUninstallModuleCall(TEST_ADDRESSES.SMART_ACCOUNT, {
        moduleType: MODULE_TYPES.EXECUTOR,
        module: TEST_ADDRESSES.EXECUTOR,
        deInitData: '0x',
      })

      expect(call.to).toBe(TEST_ADDRESSES.SMART_ACCOUNT)
      expect(call.data).toMatch(/^0x/)
      expect(call.value).toBe(0n)
    })
  })

  describe('buildBatchInstallModuleCalls', () => {
    it('should build batch install calls for validators', () => {
      const calls = buildBatchInstallModuleCalls(TEST_ADDRESSES.SMART_ACCOUNT, {
        validators: [{ address: TEST_ADDRESSES.VALIDATOR, initData: TEST_ADDRESSES.OWNER }],
      })

      expect(calls.length).toBe(1)
      expect(calls[0].to).toBe(TEST_ADDRESSES.SMART_ACCOUNT)
    })

    it('should build batch install calls for multiple module types', () => {
      const calls = buildBatchInstallModuleCalls(TEST_ADDRESSES.SMART_ACCOUNT, {
        validators: [{ address: TEST_ADDRESSES.VALIDATOR, initData: '0x' }],
        executors: [{ address: TEST_ADDRESSES.EXECUTOR, initData: '0x' }],
        hooks: [{ address: TEST_ADDRESSES.HOOK, initData: '0x' }],
      })

      expect(calls.length).toBe(3)
    })

    it('should return empty array for empty batch', () => {
      const calls = buildBatchInstallModuleCalls(TEST_ADDRESSES.SMART_ACCOUNT, {})
      expect(calls.length).toBe(0)
    })
  })

  describe('validateModuleType', () => {
    it('should validate correct module types', () => {
      expect(validateModuleType(1n)).toBe(1n)
      expect(validateModuleType(2n)).toBe(2n)
      expect(validateModuleType(3n)).toBe(3n)
      expect(validateModuleType(4n)).toBe(4n)
    })

    it('should throw for invalid module type', () => {
      expect(() => validateModuleType(0n)).toThrow(InvalidModuleTypeError)
      expect(() => validateModuleType(5n)).toThrow(InvalidModuleTypeError)
      expect(() => validateModuleType(100n)).toThrow(InvalidModuleTypeError)
    })
  })

  describe('getModuleTypeName', () => {
    it('should return correct names', () => {
      expect(getModuleTypeName(MODULE_TYPES.VALIDATOR)).toBe('Validator')
      expect(getModuleTypeName(MODULE_TYPES.EXECUTOR)).toBe('Executor')
      expect(getModuleTypeName(MODULE_TYPES.FALLBACK)).toBe('Fallback')
      expect(getModuleTypeName(MODULE_TYPES.HOOK)).toBe('Hook')
    })
  })

  describe('Validator Init Data Encoders', () => {
    describe('encodeECDSAValidatorInitData', () => {
      it('should encode owner address', () => {
        const initData = encodeECDSAValidatorInitData(TEST_ADDRESSES.OWNER)
        expect(initData).toBe(TEST_ADDRESSES.OWNER.toLowerCase())
      })
    })

    describe('encodeWebAuthnValidatorInitData', () => {
      it('should encode WebAuthn config', () => {
        const initData = encodeWebAuthnValidatorInitData({
          pubKeyX: 12345n,
          pubKeyY: 67890n,
          authenticatorId: '0xaabbccdd',
        })

        expect(initData).toMatch(/^0x/)
        // Should contain pubKeyX, pubKeyY, length, and authenticatorId
        expect(initData.length).toBeGreaterThan(130)
      })
    })

    describe('encodeMultiSigValidatorInitData', () => {
      it('should encode MultiSig config', () => {
        const initData = encodeMultiSigValidatorInitData({
          signers: [TEST_ADDRESSES.OWNER, TEST_ADDRESSES.SESSION_KEY],
          threshold: 2,
        })

        expect(initData).toMatch(/^0x/)
        // Should contain threshold, signerCount, and signers
        expect(initData.length).toBeGreaterThan(130)
      })
    })
  })

  describe('Executor Init Data Encoders', () => {
    describe('encodeSessionKeyExecutorInitData', () => {
      it('should return empty init data', () => {
        const initData = encodeSessionKeyExecutorInitData()
        expect(initData).toBe('0x')
      })
    })

    describe('encodeSwapExecutorInitData', () => {
      it('should encode swap config', () => {
        const initData = encodeSwapExecutorInitData({
          maxSlippageBps: 100,
          dailyLimit: TEST_VALUES.TEN_ETH,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64 + 64) // 0x + 2 * 32 bytes
      })
    })

    describe('encodeLendingExecutorInitData', () => {
      it('should encode lending config', () => {
        const initData = encodeLendingExecutorInitData({
          maxLtv: 8000,
          minHealthFactor: TEST_VALUES.HEALTH_FACTOR_1_2,
          dailyBorrowLimit: TEST_VALUES.TEN_ETH,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64 + 64 + 64) // 0x + 3 * 32 bytes
      })
    })

    describe('encodeStakingExecutorInitData', () => {
      it('should encode staking config', () => {
        const initData = encodeStakingExecutorInitData({
          maxStakePerPool: TEST_VALUES.TEN_ETH,
          dailyStakeLimit: TEST_VALUES.ONE_ETH,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64 + 64)
      })
    })
  })

  describe('Hook Init Data Encoders', () => {
    describe('encodeSpendingLimitHookInitData', () => {
      it('should encode spending limit config', () => {
        const initData = encodeSpendingLimitHookInitData({
          token: TEST_ADDRESSES.TOKEN,
          limit: TEST_VALUES.ONE_ETH,
          period: TEST_VALUES.ONE_DAY,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64 + 64 + 64)
      })
    })

    describe('encodeHealthFactorHookInitData', () => {
      it('should encode health factor config', () => {
        const initData = encodeHealthFactorHookInitData({
          minHealthFactor: TEST_VALUES.HEALTH_FACTOR_1_5,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64)
      })
    })

    describe('encodePolicyHookInitData', () => {
      it('should encode policy hook config', () => {
        const initData = encodePolicyHookInitData({
          maxValue: TEST_VALUES.ONE_ETH,
          dailyLimit: TEST_VALUES.TEN_ETH,
        })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBe(2 + 64 + 64)
      })
    })
  })
})
