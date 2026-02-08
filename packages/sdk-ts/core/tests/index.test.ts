import type { UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  createAuthorization,
  createAuthorizationHash,
  createRevocationAuthorization,
  createSignedAuthorization,
  extractDelegateAddress,
  formatAuthorization,
  getDelegatePresets,
  getDelegationStatus,
  isDelegatedAccount,
  isRevocationAuthorization,
  isValidAddress,
  parseSignature,
} from '../src/eip7702/authorization'
import { DELEGATION_PREFIX, ZERO_ADDRESS } from '../src/eip7702/constants'
import {
  getUserOperationHash,
  packUserOperation,
  unpackUserOperation,
} from '../src/utils/userOperation'

describe('UserOperation Utils', () => {
  const mockUserOp: UserOperation = {
    sender: '0x1234567890123456789012345678901234567890' as Address,
    nonce: 1n,
    callData: '0xabcdef' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 50000n,
    preVerificationGas: 21000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 100000000n,
    signature: '0x' as Hex,
  }

  describe('packUserOperation', () => {
    it('should pack a basic user operation', () => {
      const packed = packUserOperation(mockUserOp)

      expect(packed.sender).toBe(mockUserOp.sender)
      expect(packed.callData).toBe(mockUserOp.callData)
      expect(packed.signature).toBe(mockUserOp.signature)
      expect(packed.initCode).toBe('0x')
      expect(packed.paymasterAndData).toBe('0x')
    })

    it('should pack user operation with factory data', () => {
      const userOpWithFactory: UserOperation = {
        ...mockUserOp,
        factory: '0xaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaA' as Address,
        factoryData: '0x1234' as Hex,
      }

      const packed = packUserOperation(userOpWithFactory)

      expect(packed.initCode.toLowerCase()).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(packed.initCode).toContain('1234')
    })

    it('should pack user operation with paymaster', () => {
      const userOpWithPaymaster: UserOperation = {
        ...mockUserOp,
        paymaster: '0xbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbB' as Address,
        paymasterData: '0x5678' as Hex,
        paymasterVerificationGasLimit: 30000n,
        paymasterPostOpGasLimit: 20000n,
      }

      const packed = packUserOperation(userOpWithPaymaster)

      expect(packed.paymasterAndData.toLowerCase()).toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      )
    })

    it('should correctly encode accountGasLimits', () => {
      const packed = packUserOperation(mockUserOp)

      // accountGasLimits should be 64 hex chars (32 bytes) + 0x prefix
      expect(packed.accountGasLimits.length).toBe(66)
    })

    it('should correctly encode gasFees', () => {
      const packed = packUserOperation(mockUserOp)

      // gasFees should be 64 hex chars (32 bytes) + 0x prefix
      expect(packed.gasFees.length).toBe(66)
    })

    it('should convert nonce to hex', () => {
      const packed = packUserOperation(mockUserOp)

      expect(packed.nonce).toBe('0x1')
    })

    it('should convert preVerificationGas to hex', () => {
      const packed = packUserOperation(mockUserOp)

      expect(packed.preVerificationGas).toBe('0x5208') // 21000 in hex
    })
  })

  describe('unpackUserOperation', () => {
    it('should unpack a basic packed user operation', () => {
      const packed = packUserOperation(mockUserOp)
      const unpacked = unpackUserOperation(packed as Record<string, Hex>)

      expect(unpacked.sender).toBe(mockUserOp.sender)
      expect(unpacked.nonce).toBe(mockUserOp.nonce)
      expect(unpacked.callData).toBe(mockUserOp.callData)
      expect(unpacked.signature).toBe(mockUserOp.signature)
    })

    it('should unpack user operation with factory', () => {
      const userOpWithFactory: UserOperation = {
        ...mockUserOp,
        factory: '0xaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaA' as Address,
        factoryData: '0x1234' as Hex,
      }

      const packed = packUserOperation(userOpWithFactory)
      const unpacked = unpackUserOperation(packed as Record<string, Hex>)

      expect(unpacked.factory?.toLowerCase()).toBe(userOpWithFactory.factory.toLowerCase())
    })

    it('should handle empty initCode', () => {
      const packed = {
        sender: mockUserOp.sender,
        nonce: '0x1',
        initCode: '0x',
        callData: mockUserOp.callData,
        accountGasLimits: '0x' + '0'.repeat(64),
        preVerificationGas: '0x5208',
        gasFees: '0x' + '0'.repeat(64),
        paymasterAndData: '0x',
        signature: '0x',
      }

      const unpacked = unpackUserOperation(packed)

      expect(unpacked.factory).toBeUndefined()
      expect(unpacked.factoryData).toBeUndefined()
    })

    it('should handle empty paymasterAndData', () => {
      const packed = packUserOperation(mockUserOp)
      const unpacked = unpackUserOperation(packed as Record<string, Hex>)

      expect(unpacked.paymaster).toBeUndefined()
      expect(unpacked.paymasterData).toBeUndefined()
    })

    it('should correctly parse gas limits', () => {
      const packed = packUserOperation(mockUserOp)
      const unpacked = unpackUserOperation(packed as Record<string, Hex>)

      expect(unpacked.callGasLimit).toBe(mockUserOp.callGasLimit)
      expect(unpacked.verificationGasLimit).toBe(mockUserOp.verificationGasLimit)
    })

    it('should correctly parse gas fees', () => {
      const packed = packUserOperation(mockUserOp)
      const unpacked = unpackUserOperation(packed as Record<string, Hex>)

      expect(unpacked.maxFeePerGas).toBe(mockUserOp.maxFeePerGas)
      expect(unpacked.maxPriorityFeePerGas).toBe(mockUserOp.maxPriorityFeePerGas)
    })
  })

  describe('getUserOperationHash', () => {
    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
    const chainId = 1n

    it('should return a valid hash', () => {
      const hash = getUserOperationHash(mockUserOp, entryPoint, chainId)

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should return consistent hash for same inputs', () => {
      const hash1 = getUserOperationHash(mockUserOp, entryPoint, chainId)
      const hash2 = getUserOperationHash(mockUserOp, entryPoint, chainId)

      expect(hash1).toBe(hash2)
    })

    it('should return different hash for different nonce', () => {
      const hash1 = getUserOperationHash(mockUserOp, entryPoint, chainId)
      const hash2 = getUserOperationHash({ ...mockUserOp, nonce: 2n }, entryPoint, chainId)

      expect(hash1).not.toBe(hash2)
    })

    it('should return different hash for different chainId', () => {
      const hash1 = getUserOperationHash(mockUserOp, entryPoint, 1n)
      const hash2 = getUserOperationHash(mockUserOp, entryPoint, 11155111n)

      expect(hash1).not.toBe(hash2)
    })

    it('should return different hash for different entryPoint', () => {
      const hash1 = getUserOperationHash(mockUserOp, entryPoint, chainId)
      const hash2 = getUserOperationHash(
        mockUserOp,
        '0x1111111111111111111111111111111111111111' as Address,
        chainId
      )

      expect(hash1).not.toBe(hash2)
    })
  })
})

describe('EIP-7702 Authorization', () => {
  const mockChainId = 1n
  const mockDelegateAddress = '0x1234567890123456789012345678901234567890' as Address
  const mockNonce = 5n

  describe('createAuthorization', () => {
    it('should create authorization with correct fields', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, mockNonce)

      expect(auth.chainId).toBe(mockChainId)
      expect(auth.address).toBe(mockDelegateAddress)
      expect(auth.nonce).toBe(mockNonce)
    })

    it('should convert number chainId to bigint', () => {
      const auth = createAuthorization(1, mockDelegateAddress, mockNonce)

      expect(auth.chainId).toBe(1n)
    })

    it('should convert number nonce to bigint', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, 5)

      expect(auth.nonce).toBe(5n)
    })
  })

  describe('createRevocationAuthorization', () => {
    it('should create authorization with zero address', () => {
      const auth = createRevocationAuthorization(mockChainId, mockNonce)

      expect(auth.address).toBe(ZERO_ADDRESS)
      expect(auth.chainId).toBe(mockChainId)
      expect(auth.nonce).toBe(mockNonce)
    })
  })

  describe('createAuthorizationHash', () => {
    it('should return a valid hash', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, mockNonce)
      const hash = createAuthorizationHash(auth)

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should return consistent hash for same inputs', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, mockNonce)
      const hash1 = createAuthorizationHash(auth)
      const hash2 = createAuthorizationHash(auth)

      expect(hash1).toBe(hash2)
    })

    it('should return different hash for different chainId', () => {
      const auth1 = createAuthorization(1n, mockDelegateAddress, mockNonce)
      const auth2 = createAuthorization(11155111n, mockDelegateAddress, mockNonce)

      const hash1 = createAuthorizationHash(auth1)
      const hash2 = createAuthorizationHash(auth2)

      expect(hash1).not.toBe(hash2)
    })

    it('should return different hash for different nonce', () => {
      const auth1 = createAuthorization(mockChainId, mockDelegateAddress, 1n)
      const auth2 = createAuthorization(mockChainId, mockDelegateAddress, 2n)

      const hash1 = createAuthorizationHash(auth1)
      const hash2 = createAuthorizationHash(auth2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle zero chainId', () => {
      const auth = createAuthorization(0n, mockDelegateAddress, mockNonce)
      const hash = createAuthorizationHash(auth)

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should handle zero nonce', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, 0n)
      const hash = createAuthorizationHash(auth)

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })
  })

  describe('parseSignature', () => {
    const validSignature = ('0x1234567890123456789012345678901234567890123456789012345678901234' +
      '5678901234567890123456789012345678901234567890123456789012345678' +
      '1b') as Hex

    it('should parse r, s, v correctly', () => {
      const { r, s, v } = parseSignature(validSignature)

      expect(r).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(s).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(typeof v).toBe('number')
    })

    it('should normalize v value from 27/28 to 0/1', () => {
      const sigWith27 = ('0x1234567890123456789012345678901234567890123456789012345678901234' +
        '5678901234567890123456789012345678901234567890123456789012345678' +
        '1b') as Hex // 27 in hex

      const { v } = parseSignature(sigWith27)
      expect(v).toBe(0)
    })

    it('should normalize v=28 to v=1', () => {
      const sigWith28 = ('0x1234567890123456789012345678901234567890123456789012345678901234' +
        '5678901234567890123456789012345678901234567890123456789012345678' +
        '1c') as Hex // 28 in hex

      const { v } = parseSignature(sigWith28)
      expect(v).toBe(1)
    })

    it('should keep v=0 as is', () => {
      const sigWith0 = ('0x1234567890123456789012345678901234567890123456789012345678901234' +
        '5678901234567890123456789012345678901234567890123456789012345678' +
        '00') as Hex

      const { v } = parseSignature(sigWith0)
      expect(v).toBe(0)
    })
  })

  describe('createSignedAuthorization', () => {
    const mockSignature = ('0x1234567890123456789012345678901234567890123456789012345678901234' +
      '5678901234567890123456789012345678901234567890123456789012345678' +
      '1b') as Hex

    it('should create signed authorization with all fields', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, mockNonce)
      const signedAuth = createSignedAuthorization(auth, mockSignature)

      expect(signedAuth.chainId).toBe(auth.chainId)
      expect(signedAuth.address).toBe(auth.address)
      expect(signedAuth.nonce).toBe(auth.nonce)
      expect(signedAuth.r).toBeDefined()
      expect(signedAuth.s).toBeDefined()
      expect(typeof signedAuth.v).toBe('number')
    })
  })

  describe('isDelegatedAccount', () => {
    it('should return true for delegated bytecode', () => {
      const delegatedCode = (DELEGATION_PREFIX + '1234567890123456789012345678901234567890') as Hex

      expect(isDelegatedAccount(delegatedCode)).toBe(true)
    })

    it('should return false for non-delegated bytecode', () => {
      const normalCode = '0x608060405234801561001057600080fd5b' as Hex

      expect(isDelegatedAccount(normalCode)).toBe(false)
    })

    it('should return false for empty bytecode', () => {
      expect(isDelegatedAccount('0x')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isDelegatedAccount(null)).toBe(false)
      expect(isDelegatedAccount(undefined)).toBe(false)
    })

    it('should return false for too short bytecode', () => {
      expect(isDelegatedAccount('0xef0100' as Hex)).toBe(false)
    })
  })

  describe('extractDelegateAddress', () => {
    it('should extract delegate address from delegated bytecode', () => {
      const delegateAddr = '1234567890123456789012345678901234567890'
      const delegatedCode = (DELEGATION_PREFIX + delegateAddr) as Hex

      const extracted = extractDelegateAddress(delegatedCode)

      expect(extracted?.toLowerCase()).toBe(`0x${delegateAddr}`)
    })

    it('should return null for non-delegated bytecode', () => {
      const normalCode = '0x608060405234801561001057600080fd5b' as Hex

      expect(extractDelegateAddress(normalCode)).toBeNull()
    })

    it('should return null for empty bytecode', () => {
      expect(extractDelegateAddress('0x')).toBeNull()
    })
  })

  describe('getDelegationStatus', () => {
    it('should return correct status for delegated account', () => {
      const delegateAddr = '1234567890123456789012345678901234567890'
      const delegatedCode = (DELEGATION_PREFIX + delegateAddr) as Hex

      const status = getDelegationStatus(delegatedCode)

      expect(status.isDelegated).toBe(true)
      expect(status.delegateAddress?.toLowerCase()).toBe(`0x${delegateAddr}`)
      expect(status.code).toBe(delegatedCode)
    })

    it('should return correct status for non-delegated account', () => {
      const normalCode = '0x608060405234801561001057600080fd5b' as Hex

      const status = getDelegationStatus(normalCode)

      expect(status.isDelegated).toBe(false)
      expect(status.delegateAddress).toBeNull()
      expect(status.code).toBe(normalCode)
    })

    it('should handle null code', () => {
      const status = getDelegationStatus(null)

      expect(status.isDelegated).toBe(false)
      expect(status.delegateAddress).toBeNull()
      expect(status.code).toBeNull()
    })
  })

  describe('isValidAddress', () => {
    it('should return true for valid address', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
    })

    it('should return true for checksummed address', () => {
      expect(isValidAddress('0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B')).toBe(true)
    })

    it('should return false for invalid address (too short)', () => {
      expect(isValidAddress('0x123456789')).toBe(false)
    })

    it('should return false for invalid address (no 0x prefix)', () => {
      expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false)
    })

    it('should return false for invalid characters', () => {
      expect(isValidAddress('0xGGGG567890123456789012345678901234567890')).toBe(false)
    })
  })

  describe('getDelegatePresets', () => {
    it('should return presets for known chain', () => {
      const presets = getDelegatePresets(31337)

      expect(Array.isArray(presets)).toBe(true)
      expect(presets.length).toBeGreaterThan(0)
    })

    it('should return empty array for unknown chain', () => {
      const presets = getDelegatePresets(99999)

      expect(presets).toEqual([])
    })

    it('should have correct preset structure', () => {
      const presets = getDelegatePresets(31337)

      if (presets.length > 0) {
        const preset = presets[0]
        expect(preset).toHaveProperty('name')
        expect(preset).toHaveProperty('description')
        expect(preset).toHaveProperty('address')
        expect(preset).toHaveProperty('features')
      }
    })
  })

  describe('isRevocationAuthorization', () => {
    it('should return true for revocation (zero address)', () => {
      const auth = createRevocationAuthorization(mockChainId, mockNonce)

      expect(isRevocationAuthorization(auth)).toBe(true)
    })

    it('should return false for non-revocation', () => {
      const auth = createAuthorization(mockChainId, mockDelegateAddress, mockNonce)

      expect(isRevocationAuthorization(auth)).toBe(false)
    })
  })

  describe('formatAuthorization', () => {
    it('should format authorization correctly', () => {
      const auth = createAuthorization(1n, mockDelegateAddress, 5n)
      const formatted = formatAuthorization(auth)

      expect(formatted).toContain('chainId: 1')
      expect(formatted).toContain(`delegate: ${mockDelegateAddress}`)
      expect(formatted).toContain('nonce: 5')
    })
  })
})
