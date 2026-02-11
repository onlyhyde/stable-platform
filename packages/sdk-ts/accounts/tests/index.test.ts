import type { Call, Validator } from '@stablenet/sdk-types'
import { CALL_TYPE, EXEC_MODE, MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  calculateSalt,
  encodeBatchCalls,
  encodeExecutionMode,
  encodeKernelExecuteCallData,
  encodeRootValidator,
  encodeSingleCall,
} from '../src/kernel/utils'

describe('Kernel Utils', () => {
  describe('encodeExecutionMode', () => {
    it('should encode single call mode correctly', () => {
      const mode = encodeExecutionMode(CALL_TYPE.SINGLE)

      // First byte should be 00 (single), second byte 00 (default)
      expect(mode.startsWith('0x00')).toBe(true)
      // Should be 32 bytes (64 hex chars + 0x)
      expect(mode.length).toBe(66)
    })

    it('should encode batch call mode correctly', () => {
      const mode = encodeExecutionMode(CALL_TYPE.BATCH)

      // First byte should be 01 (batch)
      expect(mode.startsWith('0x01')).toBe(true)
      expect(mode.length).toBe(66)
    })

    it('should encode delegate call mode correctly', () => {
      const mode = encodeExecutionMode(CALL_TYPE.DELEGATE)

      // First byte should be ff (delegate)
      expect(mode.startsWith('0xff')).toBe(true)
      expect(mode.length).toBe(66)
    })

    it('should encode try exec mode correctly', () => {
      const mode = encodeExecutionMode(CALL_TYPE.SINGLE, EXEC_MODE.TRY)

      // First byte 00 (single), second byte 01 (try)
      expect(mode.startsWith('0x0001')).toBe(true)
    })

    it('should encode delegate exec mode correctly', () => {
      const mode = encodeExecutionMode(CALL_TYPE.SINGLE, EXEC_MODE.DELEGATE)

      // First byte 00 (single), second byte ff (delegate exec mode)
      expect(mode.startsWith('0x00ff')).toBe(true)
    })

    it('should encode default exec mode when not specified', () => {
      const mode = encodeExecutionMode(CALL_TYPE.SINGLE)

      // Second byte should be 00 (default)
      expect(mode.slice(0, 6)).toBe('0x0000')
    })
  })

  describe('encodeSingleCall', () => {
    it('should encode a simple call', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 0n,
        data: '0x' as Hex,
      }

      const encoded = encodeSingleCall(call)

      expect(encoded).toMatch(/^0x/)
      // Should contain the target address
      expect(encoded.toLowerCase()).toContain('1234567890123456789012345678901234567890')
    })

    it('should encode a call with value', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 1000000000000000000n, // 1 ETH in wei
        data: '0x' as Hex,
      }

      const encoded = encodeSingleCall(call)

      expect(encoded).toMatch(/^0x/)
      // Should contain the value (0xde0b6b3a7640000 = 1 ETH)
      expect(encoded.toLowerCase()).toContain('de0b6b3a7640000')
    })

    it('should encode a call with calldata', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 0n,
        data: '0xabcdef12' as Hex,
      }

      const encoded = encodeSingleCall(call)

      expect(encoded).toMatch(/^0x/)
      // Should contain the calldata
      expect(encoded.toLowerCase()).toContain('abcdef12')
    })

    it('should handle missing value as 0', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
      }

      const encoded = encodeSingleCall(call)

      expect(encoded).toMatch(/^0x/)
    })

    it('should handle missing data as 0x', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 0n,
      }

      const encoded = encodeSingleCall(call)

      expect(encoded).toMatch(/^0x/)
    })
  })

  describe('encodeBatchCalls', () => {
    it('should encode multiple calls', () => {
      const calls: Call[] = [
        {
          to: '0x1111111111111111111111111111111111111111' as Address,
          value: 100n,
          data: '0xaabbccdd' as Hex,
        },
        {
          to: '0x2222222222222222222222222222222222222222' as Address,
          value: 200n,
          data: '0x11223344' as Hex,
        },
      ]

      const encoded = encodeBatchCalls(calls)

      expect(encoded).toMatch(/^0x/)
      // Should contain both addresses
      expect(encoded.toLowerCase()).toContain('1111111111111111111111111111111111111111')
      expect(encoded.toLowerCase()).toContain('2222222222222222222222222222222222222222')
    })

    it('should encode empty calls array', () => {
      const calls: Call[] = []

      const encoded = encodeBatchCalls(calls)

      expect(encoded).toMatch(/^0x/)
    })

    it('should encode calls with missing optional fields', () => {
      const calls: Call[] = [
        {
          to: '0x1234567890123456789012345678901234567890' as Address,
        },
        {
          to: '0xabcdef0123456789abcdef0123456789abcdef01' as Address,
          value: 0n,
        },
      ]

      const encoded = encodeBatchCalls(calls)

      expect(encoded).toMatch(/^0x/)
    })
  })

  describe('encodeKernelExecuteCallData', () => {
    it('should encode a single call', () => {
      const call: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 0n,
        data: '0x' as Hex,
      }

      const encoded = encodeKernelExecuteCallData(call)

      expect(encoded).toMatch(/^0x/)
      // Should be encoded as execute function call
      expect(encoded.length).toBeGreaterThan(10)
    })

    it('should encode an array with single call', () => {
      const calls: Call[] = [
        {
          to: '0x1234567890123456789012345678901234567890' as Address,
          value: 0n,
          data: '0x' as Hex,
        },
      ]

      const encoded = encodeKernelExecuteCallData(calls)

      expect(encoded).toMatch(/^0x/)
    })

    it('should encode batch calls', () => {
      const calls: Call[] = [
        {
          to: '0x1111111111111111111111111111111111111111' as Address,
          value: 0n,
          data: '0x' as Hex,
        },
        {
          to: '0x2222222222222222222222222222222222222222' as Address,
          value: 0n,
          data: '0x' as Hex,
        },
      ]

      const encoded = encodeKernelExecuteCallData(calls)

      expect(encoded).toMatch(/^0x/)
    })

    it('should throw error for empty calls array', () => {
      const calls: Call[] = []

      expect(() => encodeKernelExecuteCallData(calls)).toThrow('At least one call is required')
    })

    it('should produce different encodings for single vs batch', () => {
      const singleCall: Call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: 0n,
        data: '0x' as Hex,
      }

      const batchCalls: Call[] = [
        {
          to: '0x1234567890123456789012345678901234567890' as Address,
          value: 0n,
          data: '0x' as Hex,
        },
        {
          to: '0x1234567890123456789012345678901234567890' as Address,
          value: 0n,
          data: '0x' as Hex,
        },
      ]

      const singleEncoded = encodeKernelExecuteCallData(singleCall)
      const batchEncoded = encodeKernelExecuteCallData(batchCalls)

      expect(singleEncoded).not.toBe(batchEncoded)
    })
  })

  describe('encodeRootValidator', () => {
    it('should encode validator with module type prefix', () => {
      const mockValidator: Validator = {
        address: '0x1234567890123456789012345678901234567890' as Address,
        type: MODULE_TYPE.VALIDATOR,
        getInitData: async () => '0x' as Hex,
        signHash: async () => '0x' as Hex,
      }

      const encoded = encodeRootValidator(mockValidator)

      expect(encoded).toMatch(/^0x/)
      // Should be 21 bytes (42 hex chars + 0x = 44 chars)
      expect(encoded.length).toBe(44)
      // First byte should be module type (0x01 for validator)
      expect(encoded.slice(0, 4)).toBe('0x01')
      // Rest should be the address
      expect(encoded.toLowerCase()).toContain('1234567890123456789012345678901234567890')
    })
  })

  describe('calculateSalt', () => {
    it('should calculate salt for index 0', () => {
      const salt = calculateSalt(0n)

      expect(salt).toMatch(/^0x/)
      // Should be 32 bytes (64 hex chars + 0x = 66 chars)
      expect(salt.length).toBe(66)
      // For index 0, salt should be all zeros
      expect(salt).toBe('0x' + '0'.repeat(64))
    })

    it('should calculate salt for index 1', () => {
      const salt = calculateSalt(1n)

      expect(salt).toMatch(/^0x/)
      expect(salt.length).toBe(66)
      // Last byte should be 01
      expect(salt.endsWith('01')).toBe(true)
    })

    it('should calculate different salts for different indices', () => {
      const salt0 = calculateSalt(0n)
      const salt1 = calculateSalt(1n)
      const salt100 = calculateSalt(100n)

      expect(salt0).not.toBe(salt1)
      expect(salt1).not.toBe(salt100)
      expect(salt0).not.toBe(salt100)
    })

    it('should handle large index values', () => {
      const largeIndex = 2n ** 64n
      const salt = calculateSalt(largeIndex)

      expect(salt).toMatch(/^0x/)
      expect(salt.length).toBe(66)
    })
  })
})

describe('Kernel ABIs', () => {
  it('should export KernelAccountAbi', async () => {
    const { KernelAccountAbi } = await import('../src/kernel/abi')

    expect(Array.isArray(KernelAccountAbi)).toBe(true)
    expect(KernelAccountAbi.length).toBeGreaterThan(0)

    // Check execute function exists
    const executeFunc = KernelAccountAbi.find((item) => item.name === 'execute')
    expect(executeFunc).toBeDefined()
  })

  it('should export KernelFactoryAbi', async () => {
    const { KernelFactoryAbi } = await import('../src/kernel/abi')

    expect(Array.isArray(KernelFactoryAbi)).toBe(true)

    // Check createAccount and getAddress functions exist
    const createAccountFunc = KernelFactoryAbi.find((item) => item.name === 'createAccount')
    const getAddressFunc = KernelFactoryAbi.find((item) => item.name === 'getAddress')

    expect(createAccountFunc).toBeDefined()
    expect(getAddressFunc).toBeDefined()
  })

  it('should export EntryPointAbi', async () => {
    const { EntryPointAbi } = await import('../src/kernel/abi')

    expect(Array.isArray(EntryPointAbi)).toBe(true)

    // Check getNonce function exists
    const getNonceFunc = EntryPointAbi.find((item) => item.name === 'getNonce')
    expect(getNonceFunc).toBeDefined()
  })
})

describe('Package exports', () => {
  it('should export all functions from index', async () => {
    const exports = await import('../src/index')

    // Functions
    expect(typeof exports.toKernelSmartAccount).toBe('function')
    expect(typeof exports.encodeExecutionMode).toBe('function')
    expect(typeof exports.encodeSingleCall).toBe('function')
    expect(typeof exports.encodeBatchCalls).toBe('function')
    expect(typeof exports.encodeKernelExecuteCallData).toBe('function')
    expect(typeof exports.encodeKernelInitializeData).toBe('function')
    expect(typeof exports.encodeRootValidator).toBe('function')
    expect(typeof exports.calculateSalt).toBe('function')
  })

  it('should export ABIs', async () => {
    const exports = await import('../src/index')

    expect(exports.KernelAccountAbi).toBeDefined()
    expect(exports.KernelFactoryAbi).toBeDefined()
    expect(exports.EntryPointAbi).toBeDefined()
  })

  it('should export constants', async () => {
    const exports = await import('../src/index')

    expect(exports.ENTRY_POINT_V07_ADDRESS).toBeDefined()
    expect(exports.KERNEL_V3_1_FACTORY_ADDRESS).toBeDefined()
    expect(exports.KERNEL_ADDRESSES).toBeDefined()
    expect(exports.MODULE_TYPE).toBeDefined()
    expect(exports.EXEC_MODE).toBeDefined()
    expect(exports.CALL_TYPE).toBeDefined()
  })
})
