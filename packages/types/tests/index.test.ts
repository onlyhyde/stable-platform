import { describe, expect, it } from 'vitest'
import {
  BUNDLER_ERROR_CODES,
  CALL_TYPE,
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  EXEC_MODE,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
  MODULE_TYPE,
} from '../src'

describe('Constants', () => {
  describe('Entry Point', () => {
    it('should have correct EntryPoint address (v0.9)', () => {
      expect(ENTRY_POINT_ADDRESS).toBe('0xEf6817fe73741A8F10088f9511c64b666a338A14')
    })

    it('should be a valid Ethereum address', () => {
      expect(ENTRY_POINT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should have deprecated ENTRY_POINT_V07_ADDRESS with v0.7 address', () => {
      expect(ENTRY_POINT_V07_ADDRESS).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    })
  })

  describe('Kernel Factory', () => {
    it('should have correct Kernel v3.1 factory address', () => {
      expect(KERNEL_V3_1_FACTORY_ADDRESS).toBe('0x6723b44Abeec4E71eBE3232BD5B455805baDD22f')
    })

    it('should be a valid Ethereum address', () => {
      expect(KERNEL_V3_1_FACTORY_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  describe('ECDSA Validator', () => {
    it('should have correct ECDSA validator address', () => {
      expect(ECDSA_VALIDATOR_ADDRESS).toBe('0xd9AB5096a832b9ce79914329DAEE236f8Eea0390')
    })

    it('should be a valid Ethereum address', () => {
      expect(ECDSA_VALIDATOR_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  describe('Kernel Addresses', () => {
    it('should have Kernel v3.1 implementation address', () => {
      expect(KERNEL_ADDRESSES.KERNEL_V3_1).toBe('0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27')
    })

    it('should have Kernel v3.0 implementation address', () => {
      expect(KERNEL_ADDRESSES.KERNEL_V3_0).toBe('0xd3082872F8B06073A021b4602e022d5A070d7cfC')
    })

    it('should have valid Ethereum addresses for all implementations', () => {
      Object.values(KERNEL_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })
  })

  describe('Module Type', () => {
    it('should have correct VALIDATOR type', () => {
      expect(MODULE_TYPE.VALIDATOR).toBe(1n)
    })

    it('should have correct EXECUTOR type', () => {
      expect(MODULE_TYPE.EXECUTOR).toBe(2n)
    })

    it('should have correct FALLBACK type', () => {
      expect(MODULE_TYPE.FALLBACK).toBe(3n)
    })

    it('should have correct HOOK type', () => {
      expect(MODULE_TYPE.HOOK).toBe(4n)
    })

    it('should have all types as bigint', () => {
      Object.values(MODULE_TYPE).forEach((value) => {
        expect(typeof value).toBe('bigint')
      })
    })
  })

  describe('Exec Mode', () => {
    it('should have correct DEFAULT mode', () => {
      expect(EXEC_MODE.DEFAULT).toBe('0x00')
    })

    it('should have correct TRY mode', () => {
      expect(EXEC_MODE.TRY).toBe('0x01')
    })

    it('should have correct DELEGATE mode', () => {
      expect(EXEC_MODE.DELEGATE).toBe('0xff')
    })

    it('should have valid hex strings for all modes', () => {
      Object.values(EXEC_MODE).forEach((value) => {
        expect(value).toMatch(/^0x[a-fA-F0-9]{2}$/)
      })
    })
  })

  describe('Call Type', () => {
    it('should have correct SINGLE type', () => {
      expect(CALL_TYPE.SINGLE).toBe('0x00')
    })

    it('should have correct BATCH type', () => {
      expect(CALL_TYPE.BATCH).toBe('0x01')
    })

    it('should have correct DELEGATE type', () => {
      expect(CALL_TYPE.DELEGATE).toBe('0xff')
    })

    it('should have valid hex strings for all types', () => {
      Object.values(CALL_TYPE).forEach((value) => {
        expect(value).toMatch(/^0x[a-fA-F0-9]{2}$/)
      })
    })
  })

  describe('Bundler Error Codes', () => {
    it('should have standard JSON-RPC error codes', () => {
      expect(BUNDLER_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
      expect(BUNDLER_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
      expect(BUNDLER_ERROR_CODES.INVALID_PARAMS).toBe(-32602)
      expect(BUNDLER_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
    })

    it('should have ERC-4337 specific error codes', () => {
      expect(BUNDLER_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT).toBe(-32500)
      expect(BUNDLER_ERROR_CODES.REJECTED_BY_PAYMASTER).toBe(-32501)
      expect(BUNDLER_ERROR_CODES.BANNED_OPCODE).toBe(-32502)
      expect(BUNDLER_ERROR_CODES.SHORT_DEADLINE).toBe(-32503)
      expect(BUNDLER_ERROR_CODES.BANNED_OR_THROTTLED).toBe(-32504)
      expect(BUNDLER_ERROR_CODES.STAKE_OR_DELAY_TOO_LOW).toBe(-32505)
      expect(BUNDLER_ERROR_CODES.UNSUPPORTED_AGGREGATOR).toBe(-32506)
      expect(BUNDLER_ERROR_CODES.INVALID_SIGNATURE).toBe(-32507)
    })

    it('should have all error codes as numbers', () => {
      Object.values(BUNDLER_ERROR_CODES).forEach((value) => {
        expect(typeof value).toBe('number')
      })
    })

    it('should have all error codes as negative numbers (error convention)', () => {
      Object.values(BUNDLER_ERROR_CODES).forEach((value) => {
        expect(value).toBeLessThan(0)
      })
    })
  })
})

describe('Package Exports', () => {
  it('should export all constants', async () => {
    const exports = await import('../src')

    expect(exports.ENTRY_POINT_V07_ADDRESS).toBeDefined()
    expect(exports.KERNEL_V3_1_FACTORY_ADDRESS).toBeDefined()
    expect(exports.ECDSA_VALIDATOR_ADDRESS).toBeDefined()
    expect(exports.KERNEL_ADDRESSES).toBeDefined()
    expect(exports.MODULE_TYPE).toBeDefined()
    expect(exports.EXEC_MODE).toBeDefined()
    expect(exports.CALL_TYPE).toBeDefined()
    expect(exports.BUNDLER_ERROR_CODES).toBeDefined()
  })

  it('should export type-only modules without runtime errors', async () => {
    // These should not throw when imported
    const exports = await import('../src')

    // Just verify the module loaded without errors
    expect(exports).toBeDefined()
  })
})
