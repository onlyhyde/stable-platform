import { describe, it, expect } from 'vitest'
import { FormatValidator } from '../../src/validation/formatValidator'
import type { UserOperation } from '../../src/types'
import { RpcError } from '../../src/types'

describe('FormatValidator', () => {
  const validator = new FormatValidator()

  // Valid UserOperation for testing
  const validUserOp: UserOperation = {
    sender: '0x1234567890123456789012345678901234567890',
    nonce: 0n,
    callData: '0x',
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n, // 1 gwei
    maxPriorityFeePerGas: 100000000n, // 0.1 gwei
    signature: '0x' + '00'.repeat(65), // 65 bytes minimum
  }

  describe('validate', () => {
    it('should pass for valid UserOperation', () => {
      expect(() => validator.validate(validUserOp)).not.toThrow()
    })

    it('should reject invalid sender address', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        sender: '0xinvalid' as `0x${string}`,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject negative nonce', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        nonce: -1n,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject callGasLimit below minimum', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        callGasLimit: 1000n, // Below 9000
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject verificationGasLimit below minimum', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        verificationGasLimit: 5000n, // Below 10000
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject preVerificationGas below minimum', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        preVerificationGas: 10000n, // Below 21000
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject zero maxFeePerGas', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        maxFeePerGas: 0n,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })

    it('should reject signature too short', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        signature: '0x1234', // Too short
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
    })
  })

  describe('gas relationship validation', () => {
    it('should reject maxPriorityFeePerGas > maxFeePerGas', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 2000000000n, // Greater than maxFeePerGas
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/maxPriorityFeePerGas/)
    })

    it('should allow maxPriorityFeePerGas == maxFeePerGas', () => {
      const validOp: UserOperation = {
        ...validUserOp,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })
  })

  describe('factory validation', () => {
    it('should pass with both factory and factoryData', () => {
      const validOp: UserOperation = {
        ...validUserOp,
        factory: '0x1234567890123456789012345678901234567890',
        factoryData: '0x1234',
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })

    it('should reject factory without factoryData', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        factory: '0x1234567890123456789012345678901234567890',
        factoryData: undefined,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/factory.*factoryData/)
    })

    it('should reject factoryData without factory', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        factory: undefined,
        factoryData: '0x1234',
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/factoryData.*factory/)
    })
  })

  describe('paymaster validation', () => {
    it('should pass with all paymaster fields', () => {
      const validOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
        paymasterData: '0x1234',
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })

    it('should reject paymaster without verification gas', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: 30000n,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/paymasterVerificationGasLimit/)
    })

    it('should reject paymaster without post-op gas', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: undefined,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/paymasterPostOpGasLimit/)
    })

    it('should reject paymaster gas limits without paymaster', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        paymaster: undefined,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/without paymaster/)
    })

    it('should reject paymasterData without paymaster', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        paymaster: undefined,
        paymasterData: '0x1234',
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/paymasterData.*without paymaster/)
    })
  })

  describe('gas limits validation', () => {
    it('should reject total gas exceeding maximum', () => {
      const invalidOp: UserOperation = {
        ...validUserOp,
        preVerificationGas: 10000000n,
        verificationGasLimit: 10000000n,
        callGasLimit: 15000000n, // Total > 30M
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/total gas/)
    })
  })

  describe('helper methods', () => {
    it('validateSignatureFormat should return true for valid signature', () => {
      const result = validator.validateSignatureFormat('0x' + '00'.repeat(65) as `0x${string}`)
      expect(result).toBe(true)
    })

    it('validateSignatureFormat should return false for short signature', () => {
      const result = validator.validateSignatureFormat('0x1234' as `0x${string}`)
      expect(result).toBe(false)
    })

    it('validateAddressFormat should return true for valid address', () => {
      const result = validator.validateAddressFormat('0x1234567890123456789012345678901234567890')
      expect(result).toBe(true)
    })

    it('validateAddressFormat should return false for invalid address', () => {
      const result = validator.validateAddressFormat('0xinvalid')
      expect(result).toBe(false)
    })

    it('validateHexFormat should return true for valid hex', () => {
      const result = validator.validateHexFormat('0x1234abcd')
      expect(result).toBe(true)
    })

    it('validateHexFormat should return false for invalid hex', () => {
      const result = validator.validateHexFormat('not-hex')
      expect(result).toBe(false)
    })
  })
})
