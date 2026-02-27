import { describe, expect, it } from 'vitest'
import type { UserOperation } from '../../src/types'
import { RpcError } from '../../src/types'
import { FormatValidator, type FormatValidatorConfig } from '../../src/validation/formatValidator'
import { VALIDATION_CONSTANTS } from '../../src/validation/types'

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
        preVerificationGas: 400000n,
        verificationGasLimit: 400000n,
        callGasLimit: 29_500_000n, // Total > 30M but each field individually within limits
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/total gas/)
    })
  })

  describe('helper methods', () => {
    it('validateSignatureFormat should return true for valid signature', () => {
      const result = validator.validateSignatureFormat(('0x' + '00'.repeat(65)) as `0x${string}`)
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

  describe('data length bounds checking', () => {
    it('should reject callData exceeding maximum length', () => {
      const oversizedCallData = ('0x' +
        'ab'.repeat(VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH)) as `0x${string}`
      const invalidOp: UserOperation = {
        ...validUserOp,
        callData: oversizedCallData,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/callData too large/)
    })

    it('should accept callData within maximum length', () => {
      // 1KB of callData (well within 50KB limit)
      const validCallData = ('0x' + 'ab'.repeat(1024)) as `0x${string}`
      const validOp: UserOperation = {
        ...validUserOp,
        callData: validCallData,
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })

    it('should reject factoryData exceeding maximum length', () => {
      const oversizedFactoryData = ('0x' +
        'ab'.repeat(VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH)) as `0x${string}`
      const invalidOp: UserOperation = {
        ...validUserOp,
        factory: '0x1234567890123456789012345678901234567890',
        factoryData: oversizedFactoryData,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/factoryData too large/)
    })

    it('should reject paymasterData exceeding maximum length', () => {
      const oversizedPaymasterData = ('0x' +
        'ab'.repeat(VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH)) as `0x${string}`
      const invalidOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
        paymasterData: oversizedPaymasterData,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/paymasterData too large/)
    })

    it('should reject signature exceeding maximum length', () => {
      // Create a signature that exceeds the 2KB max (VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH)
      const oversizedSignature = ('0x' +
        'ab'.repeat(VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH)) as `0x${string}`
      const invalidOp: UserOperation = {
        ...validUserOp,
        signature: oversizedSignature,
      }
      expect(() => validator.validate(invalidOp)).toThrow(RpcError)
      expect(() => validator.validate(invalidOp)).toThrow(/signature too large/)
    })

    it('should accept signature within bounds', () => {
      // 65 bytes is the minimum, 2KB is the maximum
      const validSignature = ('0x' + '00'.repeat(65)) as `0x${string}`
      const validOp: UserOperation = {
        ...validUserOp,
        signature: validSignature,
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })

    it('should accept larger but valid signature (for aggregators)', () => {
      // 256 bytes signature (valid for some aggregator schemes)
      const validSignature = ('0x' + '00'.repeat(256)) as `0x${string}`
      const validOp: UserOperation = {
        ...validUserOp,
        signature: validSignature,
      }
      expect(() => validator.validate(validOp)).not.toThrow()
    })
  })

  describe('Per-entity calldata limits (configurable)', () => {
    it('should use default limits when no config (backwards compatible)', () => {
      const defaultValidator = new FormatValidator()
      // Should not throw for reasonable data
      expect(() => defaultValidator.validate(validUserOp)).not.toThrow()
    })

    it('should accept custom maxCalldataLength', () => {
      const config: FormatValidatorConfig = {
        maxCalldataLength: 1000, // 1000 hex chars = ~499 bytes
      }
      const customValidator = new FormatValidator(config)

      // Data within limit should pass
      const smallOp: UserOperation = {
        ...validUserOp,
        callData: ('0x' + 'ab'.repeat(400)) as `0x${string}`, // 802 chars
      }
      expect(() => customValidator.validate(smallOp)).not.toThrow()
    })

    it('should accept custom maxFactoryDataLength', () => {
      const config: FormatValidatorConfig = {
        maxFactoryDataLength: 500,
      }
      const customValidator = new FormatValidator(config)

      // Data within limit should pass
      const validOp: UserOperation = {
        ...validUserOp,
        factory: '0x1234567890123456789012345678901234567890',
        factoryData: ('0x' + 'ab'.repeat(200)) as `0x${string}`, // 402 chars
      }
      expect(() => customValidator.validate(validOp)).not.toThrow()
    })

    it('should accept custom maxPaymasterDataLength', () => {
      const config: FormatValidatorConfig = {
        maxPaymasterDataLength: 500,
      }
      const customValidator = new FormatValidator(config)

      const validOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
        paymasterData: ('0x' + 'ab'.repeat(200)) as `0x${string}`, // 402 chars
      }
      expect(() => customValidator.validate(validOp)).not.toThrow()
    })

    it('should reject callData exceeding custom limit', () => {
      const config: FormatValidatorConfig = {
        maxCalldataLength: 100, // Very tight limit
      }
      const customValidator = new FormatValidator(config)

      const oversizedOp: UserOperation = {
        ...validUserOp,
        callData: ('0x' + 'ab'.repeat(100)) as `0x${string}`, // 202 chars > 100
      }
      expect(() => customValidator.validate(oversizedOp)).toThrow(RpcError)
      expect(() => customValidator.validate(oversizedOp)).toThrow(/callData too large/)
    })

    it('should reject factoryData exceeding custom limit', () => {
      const config: FormatValidatorConfig = {
        maxFactoryDataLength: 100,
      }
      const customValidator = new FormatValidator(config)

      const oversizedOp: UserOperation = {
        ...validUserOp,
        factory: '0x1234567890123456789012345678901234567890',
        factoryData: ('0x' + 'ab'.repeat(100)) as `0x${string}`, // 202 chars > 100
      }
      expect(() => customValidator.validate(oversizedOp)).toThrow(RpcError)
      expect(() => customValidator.validate(oversizedOp)).toThrow(/factoryData too large/)
    })

    it('should reject paymasterData exceeding custom limit', () => {
      const config: FormatValidatorConfig = {
        maxPaymasterDataLength: 100,
      }
      const customValidator = new FormatValidator(config)

      const oversizedOp: UserOperation = {
        ...validUserOp,
        paymaster: '0x1234567890123456789012345678901234567890',
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
        paymasterData: ('0x' + 'ab'.repeat(100)) as `0x${string}`, // 202 chars > 100
      }
      expect(() => customValidator.validate(oversizedOp)).toThrow(RpcError)
      expect(() => customValidator.validate(oversizedOp)).toThrow(/paymasterData too large/)
    })

    it('should allow data within custom limits', () => {
      const config: FormatValidatorConfig = {
        maxCalldataLength: 500,
        maxFactoryDataLength: 300,
        maxPaymasterDataLength: 200,
      }
      const customValidator = new FormatValidator(config)

      const validOp: UserOperation = {
        ...validUserOp,
        callData: ('0x' + 'ab'.repeat(200)) as `0x${string}`, // 402 chars < 500
      }
      expect(() => customValidator.validate(validOp)).not.toThrow()
    })
  })
})
