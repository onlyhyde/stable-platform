import { describe, expect, it } from 'vitest'
import {
  // Account
  ACCOUNT_TYPE,
  type Account,
  // Bundler
  BUNDLER_ERROR_CODES,
  // Constants & Execution Mode
  CALL_TYPE,
  // Network
  CHAIN_IDS,
  canInstallModules,
  decodeExecutionMode,
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  EXEC_MODE,
  EXEC_TYPE,
  type ExecutionMode,
  encodeExecutionMode,
  // Transaction
  GAS_PAYMENT_TYPE,
  getAvailableTransactionModes,
  getDefaultCurrency,
  getDefaultTransactionMode,
  // Module
  getModuleTypeName,
  // Validation
  isBlockNumberMode,
  isEIP7702Mode,
  isEOAMode,
  isERC20Gas,
  isExecutor,
  isFallback,
  isHook,
  // Token
  isNativeToken,
  isPolicy,
  isSigner,
  isSmartAccountMode,
  isSponsoredGas,
  isValidationFailed,
  isValidator,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
  KEYRING_TYPE,
  MODULE_STATUS,
  MODULE_TYPE,
  NATIVE_ETH_SENTINEL_ADDRESS,
  NATIVE_TOKEN_ADDRESS,
  // RPC
  PROVIDER_EVENTS,
  packValidationData,
  RPC_ERROR_CODES,
  RpcError,
  SIG_VALIDATION_FAILED,
  SIG_VALIDATION_SUCCESS,
  supportsSmartAccount,
  TRANSACTION_MODE,
  unpackValidationData,
  VALIDITY_BLOCK_MODE_FLAG,
  type ValidationData,
} from '../src'

// ============================================================================
// Constants Tests
// ============================================================================

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

  describe('Exec Mode (deprecated)', () => {
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

  describe('Exec Type', () => {
    it('should have correct DEFAULT type', () => {
      expect(EXEC_TYPE.DEFAULT).toBe('0x00')
    })

    it('should have correct TRY type', () => {
      expect(EXEC_TYPE.TRY).toBe('0x01')
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
    const exports = await import('../src')
    expect(exports).toBeDefined()
  })
})

// ============================================================================
// EIP-7579 Execution Mode Tests
// ============================================================================

describe('encodeExecutionMode / decodeExecutionMode', () => {
  it('should encode a standard single-call mode', () => {
    const mode: ExecutionMode = {
      callType: CALL_TYPE.SINGLE,
      execType: EXEC_TYPE.DEFAULT,
      modeSelector: '0x00000000',
      modePayload: '0x00',
    }
    const encoded = encodeExecutionMode(mode)
    expect(encoded).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(encoded).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
  })

  it('should encode a batch-call with try execution', () => {
    const mode: ExecutionMode = {
      callType: CALL_TYPE.BATCH,
      execType: EXEC_TYPE.TRY,
      modeSelector: '0x00000000',
      modePayload: '0x00',
    }
    const encoded = encodeExecutionMode(mode)
    expect(encoded.startsWith('0x0101')).toBe(true)
  })

  it('should encode a delegate call mode', () => {
    const mode: ExecutionMode = {
      callType: CALL_TYPE.DELEGATE,
      execType: EXEC_TYPE.DEFAULT,
      modeSelector: '0x00000000',
      modePayload: '0x00',
    }
    const encoded = encodeExecutionMode(mode)
    expect(encoded.startsWith('0xff00')).toBe(true)
  })

  it('should roundtrip encode/decode correctly', () => {
    const original: ExecutionMode = {
      callType: CALL_TYPE.BATCH,
      execType: EXEC_TYPE.TRY,
      modeSelector: '0xdeadbeef',
      modePayload: '0x0000000000000000000000000000000000000000000000000001',
    }
    const encoded = encodeExecutionMode(original)
    const decoded = decodeExecutionMode(encoded)

    expect(decoded.callType).toBe(original.callType)
    expect(decoded.execType).toBe(original.execType)
    expect(decoded.modeSelector).toBe(original.modeSelector)
  })

  it('should always produce exactly 66-char hex (0x + 64)', () => {
    const mode: ExecutionMode = {
      callType: CALL_TYPE.SINGLE,
      execType: EXEC_TYPE.DEFAULT,
      modeSelector: '0x00000000',
      modePayload: '0x00',
    }
    const encoded = encodeExecutionMode(mode)
    expect(encoded.length).toBe(66)
  })

  it('should truncate oversized modeSelector to 4 bytes', () => {
    const mode: ExecutionMode = {
      callType: CALL_TYPE.SINGLE,
      execType: EXEC_TYPE.DEFAULT,
      modeSelector: '0xdeadbeef11' as `0x${string}`,
      modePayload: '0x00',
    }
    const encoded = encodeExecutionMode(mode)
    // Should still be valid bytes32
    expect(encoded.length).toBe(66)
  })

  it('should decode a zero-filled bytes32', () => {
    const decoded = decodeExecutionMode(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
    expect(decoded.callType).toBe('0x00')
    expect(decoded.execType).toBe('0x00')
    expect(decoded.modeSelector).toBe('0x00000000')
  })
})

// ============================================================================
// ValidationData Tests
// ============================================================================

describe('ValidationData packing', () => {
  it('should pack and unpack a simple validation result', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: 0n,
      validAfter: 0n,
    }
    const packed = packValidationData(data)
    expect(packed).toBe(0n)

    const unpacked = unpackValidationData(packed)
    expect(unpacked.authorizer.toLowerCase()).toBe(data.authorizer.toLowerCase())
    expect(unpacked.validUntil).toBe(0n)
    expect(unpacked.validAfter).toBe(0n)
  })

  it('should pack SIG_VALIDATION_FAILED correctly', () => {
    const data: ValidationData = {
      authorizer: SIG_VALIDATION_FAILED,
      validUntil: 0n,
      validAfter: 0n,
    }
    const packed = packValidationData(data)
    expect(packed).toBe(1n << 96n)
  })

  it('should roundtrip with timestamps', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: 1700000000n,
      validAfter: 1600000000n,
    }
    const packed = packValidationData(data)
    const unpacked = unpackValidationData(packed)

    expect(unpacked.validUntil).toBe(data.validUntil)
    expect(unpacked.validAfter).toBe(data.validAfter)
  })

  it('should roundtrip with a real aggregator address', () => {
    const aggregator = '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390'
    const data: ValidationData = {
      authorizer: aggregator,
      validUntil: 999999n,
      validAfter: 100000n,
    }
    const packed = packValidationData(data)
    const unpacked = unpackValidationData(packed)

    // Should produce checksummed address
    expect(unpacked.authorizer).toBe(aggregator)
  })

  it('should produce checksummed Address from unpackValidationData', () => {
    const data: ValidationData = {
      authorizer: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390',
      validUntil: 0n,
      validAfter: 0n,
    }
    const packed = packValidationData(data)
    const unpacked = unpackValidationData(packed)

    // Verify it matches checksummed format (mixed case)
    expect(unpacked.authorizer).toMatch(/^0x[a-fA-F0-9]{40}$/)
    // Verify it's not all-lowercase (checksummed)
    expect(unpacked.authorizer).not.toBe(unpacked.authorizer.toLowerCase())
  })

  it('should mask validUntil/validAfter to 48 bits', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: 0xffffffffffffn + 1n, // 49-bit value
      validAfter: 0xffffffffffffn + 1n,
    }
    const packed = packValidationData(data)
    const unpacked = unpackValidationData(packed)

    // Should be masked to 48 bits (overflow truncated)
    expect(unpacked.validUntil).toBe(0n)
    expect(unpacked.validAfter).toBe(0n)
  })
})

describe('SIG_VALIDATION constants', () => {
  it('SIG_VALIDATION_SUCCESS should be zero address', () => {
    expect(SIG_VALIDATION_SUCCESS).toBe('0x0000000000000000000000000000000000000000')
  })

  it('SIG_VALIDATION_FAILED should be address(1)', () => {
    expect(SIG_VALIDATION_FAILED).toBe('0x0000000000000000000000000000000000000001')
  })

  it('should have Address type (string), not bigint', () => {
    expect(typeof SIG_VALIDATION_SUCCESS).toBe('string')
    expect(typeof SIG_VALIDATION_FAILED).toBe('string')
  })
})

describe('isValidationFailed', () => {
  it('should return true for SIG_VALIDATION_FAILED authorizer', () => {
    const data: ValidationData = {
      authorizer: SIG_VALIDATION_FAILED,
      validUntil: 0n,
      validAfter: 0n,
    }
    expect(isValidationFailed(data)).toBe(true)
  })

  it('should return false for SIG_VALIDATION_SUCCESS authorizer', () => {
    const data: ValidationData = {
      authorizer: SIG_VALIDATION_SUCCESS,
      validUntil: 0n,
      validAfter: 0n,
    }
    expect(isValidationFailed(data)).toBe(false)
  })

  it('should return false for aggregator address', () => {
    const data: ValidationData = {
      authorizer: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390',
      validUntil: 0n,
      validAfter: 0n,
    }
    expect(isValidationFailed(data)).toBe(false)
  })
})

describe('isBlockNumberMode', () => {
  it('should return true when both fields have bit 47 set', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: VALIDITY_BLOCK_MODE_FLAG | 100n,
      validAfter: VALIDITY_BLOCK_MODE_FLAG | 50n,
    }
    expect(isBlockNumberMode(data)).toBe(true)
  })

  it('should return false when only validAfter has bit 47 set', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: 100n,
      validAfter: VALIDITY_BLOCK_MODE_FLAG | 50n,
    }
    expect(isBlockNumberMode(data)).toBe(false)
  })

  it('should return false for timestamp mode', () => {
    const data: ValidationData = {
      authorizer: '0x0000000000000000000000000000000000000000',
      validUntil: 1700000000n,
      validAfter: 1600000000n,
    }
    expect(isBlockNumberMode(data)).toBe(false)
  })
})

// ============================================================================
// Account Utility Tests
// ============================================================================

describe('Account utilities', () => {
  const eoaAccount: Account = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test EOA',
    type: 'eoa',
  }

  const smartAccount: Account = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Smart',
    type: 'smart',
    isDeployed: true,
  }

  const delegatedAccount: Account = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Delegated',
    type: 'delegated',
    isDeployed: true,
  }

  describe('getAvailableTransactionModes', () => {
    it('should return EOA and EIP7702 for EOA accounts', () => {
      const modes = getAvailableTransactionModes(eoaAccount)
      expect(modes).toContain(TRANSACTION_MODE.EOA)
      expect(modes).toContain(TRANSACTION_MODE.EIP7702)
      expect(modes).not.toContain(TRANSACTION_MODE.SMART_ACCOUNT)
    })

    it('should return EOA and SMART_ACCOUNT for delegated accounts', () => {
      const modes = getAvailableTransactionModes(delegatedAccount)
      expect(modes).toContain(TRANSACTION_MODE.EOA)
      expect(modes).toContain(TRANSACTION_MODE.SMART_ACCOUNT)
    })

    it('should return only SMART_ACCOUNT for smart accounts', () => {
      const modes = getAvailableTransactionModes(smartAccount)
      expect(modes).toEqual([TRANSACTION_MODE.SMART_ACCOUNT])
    })
  })

  describe('getDefaultTransactionMode', () => {
    it('should return EOA for EOA accounts', () => {
      expect(getDefaultTransactionMode(eoaAccount)).toBe(TRANSACTION_MODE.EOA)
    })

    it('should return SMART_ACCOUNT for smart accounts', () => {
      expect(getDefaultTransactionMode(smartAccount)).toBe(TRANSACTION_MODE.SMART_ACCOUNT)
    })

    it('should return SMART_ACCOUNT for delegated accounts', () => {
      expect(getDefaultTransactionMode(delegatedAccount)).toBe(TRANSACTION_MODE.SMART_ACCOUNT)
    })
  })

  describe('supportsSmartAccount', () => {
    it('should return false for EOA', () => {
      expect(supportsSmartAccount(eoaAccount)).toBe(false)
    })

    it('should return true for smart account', () => {
      expect(supportsSmartAccount(smartAccount)).toBe(true)
    })

    it('should return true for delegated account', () => {
      expect(supportsSmartAccount(delegatedAccount)).toBe(true)
    })
  })

  describe('canInstallModules', () => {
    it('should return false for EOA', () => {
      expect(canInstallModules(eoaAccount)).toBe(false)
    })

    it('should return true for deployed smart account', () => {
      expect(canInstallModules(smartAccount)).toBe(true)
    })

    it('should return false for undeployed smart account', () => {
      const undeployed: Account = { ...smartAccount, isDeployed: false }
      expect(canInstallModules(undeployed)).toBe(false)
    })

    it('should return false when isDeployed is undefined', () => {
      const noDeployInfo: Account = {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test',
        type: 'smart',
      }
      expect(canInstallModules(noDeployInfo)).toBe(false)
    })
  })

  describe('ACCOUNT_TYPE constants', () => {
    it('should have correct values', () => {
      expect(ACCOUNT_TYPE.EOA).toBe('eoa')
      expect(ACCOUNT_TYPE.SMART).toBe('smart')
      expect(ACCOUNT_TYPE.DELEGATED).toBe('delegated')
    })
  })

  describe('KEYRING_TYPE constants', () => {
    it('should have correct values', () => {
      expect(KEYRING_TYPE.HD).toBe('hd')
      expect(KEYRING_TYPE.SIMPLE).toBe('simple')
      expect(KEYRING_TYPE.HARDWARE).toBe('hardware')
    })
  })
})

// ============================================================================
// Module Type Guard Tests
// ============================================================================

describe('Module type guards', () => {
  it('isValidator should identify VALIDATOR type', () => {
    expect(isValidator(MODULE_TYPE.VALIDATOR)).toBe(true)
    expect(isValidator(MODULE_TYPE.EXECUTOR)).toBe(false)
  })

  it('isExecutor should identify EXECUTOR type', () => {
    expect(isExecutor(MODULE_TYPE.EXECUTOR)).toBe(true)
    expect(isExecutor(MODULE_TYPE.VALIDATOR)).toBe(false)
  })

  it('isHook should identify HOOK type', () => {
    expect(isHook(MODULE_TYPE.HOOK)).toBe(true)
    expect(isHook(MODULE_TYPE.VALIDATOR)).toBe(false)
  })

  it('isFallback should identify FALLBACK type', () => {
    expect(isFallback(MODULE_TYPE.FALLBACK)).toBe(true)
    expect(isFallback(MODULE_TYPE.HOOK)).toBe(false)
  })

  it('isPolicy should identify POLICY type', () => {
    expect(isPolicy(MODULE_TYPE.POLICY)).toBe(true)
    expect(isPolicy(MODULE_TYPE.VALIDATOR)).toBe(false)
  })

  it('isSigner should identify SIGNER type', () => {
    expect(isSigner(MODULE_TYPE.SIGNER)).toBe(true)
    expect(isSigner(MODULE_TYPE.VALIDATOR)).toBe(false)
  })

  describe('getModuleTypeName', () => {
    it('should return correct names for all module types', () => {
      expect(getModuleTypeName(MODULE_TYPE.VALIDATOR)).toBe('Validator')
      expect(getModuleTypeName(MODULE_TYPE.EXECUTOR)).toBe('Executor')
      expect(getModuleTypeName(MODULE_TYPE.FALLBACK)).toBe('Fallback')
      expect(getModuleTypeName(MODULE_TYPE.HOOK)).toBe('Hook')
      expect(getModuleTypeName(MODULE_TYPE.POLICY)).toBe('Policy')
      expect(getModuleTypeName(MODULE_TYPE.SIGNER)).toBe('Signer')
    })

    it('should return Unknown for invalid type', () => {
      expect(getModuleTypeName(99n as any)).toBe('Unknown')
    })
  })

  describe('MODULE_STATUS constants', () => {
    it('should have correct values', () => {
      expect(MODULE_STATUS.NOT_INSTALLED).toBe('not_installed')
      expect(MODULE_STATUS.INSTALLING).toBe('installing')
      expect(MODULE_STATUS.INSTALLED).toBe('installed')
      expect(MODULE_STATUS.UNINSTALLING).toBe('uninstalling')
      expect(MODULE_STATUS.FAILED).toBe('failed')
    })
  })
})

// ============================================================================
// Transaction Type Guard Tests
// ============================================================================

describe('Transaction type guards', () => {
  it('isEOAMode should identify EOA mode', () => {
    expect(isEOAMode(TRANSACTION_MODE.EOA)).toBe(true)
    expect(isEOAMode(TRANSACTION_MODE.SMART_ACCOUNT)).toBe(false)
  })

  it('isEIP7702Mode should identify EIP7702 mode', () => {
    expect(isEIP7702Mode(TRANSACTION_MODE.EIP7702)).toBe(true)
    expect(isEIP7702Mode(TRANSACTION_MODE.EOA)).toBe(false)
  })

  it('isSmartAccountMode should identify Smart Account mode', () => {
    expect(isSmartAccountMode(TRANSACTION_MODE.SMART_ACCOUNT)).toBe(true)
    expect(isSmartAccountMode(TRANSACTION_MODE.EOA)).toBe(false)
  })

  it('isSponsoredGas should identify sponsor payment', () => {
    expect(isSponsoredGas({ type: GAS_PAYMENT_TYPE.SPONSOR })).toBe(true)
    expect(isSponsoredGas({ type: GAS_PAYMENT_TYPE.NATIVE })).toBe(false)
    expect(isSponsoredGas(undefined)).toBe(false)
  })

  it('isERC20Gas should identify ERC20 payment with token address', () => {
    expect(
      isERC20Gas({
        type: GAS_PAYMENT_TYPE.ERC20,
        tokenAddress: '0x1234567890123456789012345678901234567890',
      })
    ).toBe(true)
    expect(isERC20Gas({ type: GAS_PAYMENT_TYPE.ERC20 })).toBe(false)
    expect(isERC20Gas({ type: GAS_PAYMENT_TYPE.NATIVE })).toBe(false)
    expect(isERC20Gas(undefined)).toBe(false)
  })

  describe('TRANSACTION_MODE constants', () => {
    it('should have correct values', () => {
      expect(TRANSACTION_MODE.EOA).toBe('eoa')
      expect(TRANSACTION_MODE.EIP7702).toBe('eip7702')
      expect(TRANSACTION_MODE.SMART_ACCOUNT).toBe('smartAccount')
    })
  })

  describe('GAS_PAYMENT_TYPE constants', () => {
    it('should have correct values', () => {
      expect(GAS_PAYMENT_TYPE.SPONSOR).toBe('sponsor')
      expect(GAS_PAYMENT_TYPE.NATIVE).toBe('native')
      expect(GAS_PAYMENT_TYPE.ERC20).toBe('erc20')
    })
  })
})

// ============================================================================
// Token Tests
// ============================================================================

describe('Token utilities', () => {
  it('isNativeToken should identify zero address', () => {
    expect(isNativeToken(NATIVE_TOKEN_ADDRESS)).toBe(true)
  })

  it('isNativeToken should identify 0xEeee...EeE sentinel', () => {
    expect(isNativeToken(NATIVE_ETH_SENTINEL_ADDRESS)).toBe(true)
  })

  it('isNativeToken should handle case-insensitive sentinel', () => {
    expect(isNativeToken('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`)).toBe(true)
  })

  it('isNativeToken should return false for ERC20 address', () => {
    expect(isNativeToken('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(false)
  })

  it('NATIVE_TOKEN_ADDRESS should be zero address', () => {
    expect(NATIVE_TOKEN_ADDRESS).toBe('0x0000000000000000000000000000000000000000')
  })

  it('NATIVE_ETH_SENTINEL_ADDRESS should be 0xEeee...EeE', () => {
    expect(NATIVE_ETH_SENTINEL_ADDRESS).toBe('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')
  })
})

// ============================================================================
// Network Tests
// ============================================================================

describe('Network utilities', () => {
  describe('CHAIN_IDS', () => {
    it('should have correct mainnet chain IDs', () => {
      expect(CHAIN_IDS.ETHEREUM).toBe(1)
      expect(CHAIN_IDS.POLYGON).toBe(137)
      expect(CHAIN_IDS.ARBITRUM).toBe(42161)
      expect(CHAIN_IDS.OPTIMISM).toBe(10)
      expect(CHAIN_IDS.BASE).toBe(8453)
    })

    it('should have correct testnet chain IDs', () => {
      expect(CHAIN_IDS.SEPOLIA).toBe(11155111)
      expect(CHAIN_IDS.BASE_SEPOLIA).toBe(84532)
    })

    it('should have localhost chain ID', () => {
      expect(CHAIN_IDS.LOCALHOST).toBe(31337)
    })
  })

  describe('getDefaultCurrency', () => {
    it('should return ETH for Ethereum mainnet', () => {
      const currency = getDefaultCurrency(CHAIN_IDS.ETHEREUM)
      expect(currency.symbol).toBe('ETH')
      expect(currency.decimals).toBe(18)
    })

    it('should return MATIC for Polygon', () => {
      const currency = getDefaultCurrency(CHAIN_IDS.POLYGON)
      expect(currency.symbol).toBe('MATIC')
    })

    it('should return BNB for BSC', () => {
      const currency = getDefaultCurrency(CHAIN_IDS.BSC)
      expect(currency.symbol).toBe('BNB')
    })

    it('should return ETH as default for unknown chain ID', () => {
      const currency = getDefaultCurrency(99999)
      expect(currency.symbol).toBe('ETH')
      expect(currency.decimals).toBe(18)
    })
  })
})

// ============================================================================
// RPC Tests
// ============================================================================

describe('RPC utilities', () => {
  describe('RPC_ERROR_CODES', () => {
    it('should include JSON-RPC standard codes', () => {
      expect(RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700)
      expect(RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
    })

    it('should include EIP-1193 provider codes', () => {
      expect(RPC_ERROR_CODES.USER_REJECTED).toBe(4001)
      expect(RPC_ERROR_CODES.UNAUTHORIZED).toBe(4100)
    })

    it('should include ERC-4337 bundler codes', () => {
      expect(RPC_ERROR_CODES.REJECTED_BY_EP_OR_ACCOUNT).toBe(-32500)
    })

    it('should include StableNet custom codes', () => {
      expect(RPC_ERROR_CODES.INVALID_INPUT).toBe(-32000)
      expect(RPC_ERROR_CODES.LIMIT_EXCEEDED).toBe(-32005)
    })
  })

  describe('RpcError', () => {
    it('should create error with code and message', () => {
      const error = new RpcError('test error', -32600)
      expect(error.message).toBe('test error')
      expect(error.code).toBe(-32600)
      expect(error.name).toBe('RpcError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should include optional data', () => {
      const error = new RpcError('test', -32600, { detail: 'info' })
      expect(error.data).toEqual({ detail: 'info' })
    })

    it('should serialize to JSON correctly', () => {
      const error = new RpcError('test error', -32600, 'extra')
      const json = error.toJSON()
      expect(json.code).toBe(-32600)
      expect(json.message).toBe('test error')
      expect(json.data).toBe('extra')
    })
  })

  describe('PROVIDER_EVENTS', () => {
    it('should have correct event names', () => {
      expect(PROVIDER_EVENTS.ACCOUNTS_CHANGED).toBe('accountsChanged')
      expect(PROVIDER_EVENTS.CHAIN_CHANGED).toBe('chainChanged')
      expect(PROVIDER_EVENTS.CONNECT).toBe('connect')
      expect(PROVIDER_EVENTS.DISCONNECT).toBe('disconnect')
      expect(PROVIDER_EVENTS.MESSAGE).toBe('message')
    })
  })
})
