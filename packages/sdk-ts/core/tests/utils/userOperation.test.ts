/**
 * UserOperation Utility Tests
 *
 * Tests for packing, unpacking, and hashing ERC-4337 UserOperations.
 */

import type { UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { hashTypedData } from 'viem'
import {
  buildUserOpTypedData,
  getUserOperationHash,
  packUserOperation,
  unpackUserOperation,
} from '../../src/utils/userOperation'

const SENDER = '0x1234567890abcdef1234567890abcdef12345678' as Address
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const FACTORY = '0xaabbccddee0011223344556677889900aabbccdd' as Address
const PAYMASTER = '0x9876543210fedcba9876543210fedcba98765432' as Address

function createMinimalUserOp(overrides: Partial<UserOperation> = {}): UserOperation {
  return {
    sender: SENDER,
    nonce: 1n,
    callData: '0xdeadbeef' as Hex,
    callGasLimit: 100_000n,
    verificationGasLimit: 200_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: 30_000_000_000n,
    maxPriorityFeePerGas: 1_500_000_000n,
    signature: '0xsig' as Hex,
    ...overrides,
  }
}

function createFullUserOp(): UserOperation {
  return createMinimalUserOp({
    factory: FACTORY,
    factoryData: '0x112233' as Hex,
    paymaster: PAYMASTER,
    paymasterVerificationGasLimit: 75_000n,
    paymasterPostOpGasLimit: 50_000n,
    paymasterData: '0xaabbcc' as Hex,
  })
}

describe('packUserOperation', () => {
  it('should pack a minimal UserOperation without factory or paymaster', () => {
    const userOp = createMinimalUserOp()
    const packed = packUserOperation(userOp)

    expect(packed.sender).toBe(SENDER)
    expect(packed.callData).toBe('0xdeadbeef')
    expect(packed.signature).toBe('0xsig')
    expect(packed.initCode).toBe('0x')
    expect(packed.paymasterAndData).toBe('0x')
    expect(packed.nonce).toBeTruthy()
    expect(packed.preVerificationGas).toBeTruthy()
  })

  it('should pack initCode from factory + factoryData', () => {
    const userOp = createMinimalUserOp({
      factory: FACTORY,
      factoryData: '0x112233' as Hex,
    })
    const packed = packUserOperation(userOp)

    // initCode = factory (20 bytes) + factoryData
    expect(packed.initCode).toContain(FACTORY.slice(2))
    expect(packed.initCode.endsWith('112233')).toBe(true)
  })

  it('should pack empty initCode when no factory', () => {
    const userOp = createMinimalUserOp({ factory: undefined, factoryData: undefined })
    const packed = packUserOperation(userOp)
    expect(packed.initCode).toBe('0x')
  })

  it('should pack accountGasLimits as 32 bytes (verificationGasLimit + callGasLimit)', () => {
    const userOp = createMinimalUserOp()
    const packed = packUserOperation(userOp)

    // accountGasLimits is 2 x 16 bytes = 34 hex chars for each (0x + 32 + 32 = 66)
    expect(packed.accountGasLimits.length).toBe(66)
  })

  it('should pack gasFees as 32 bytes (maxPriorityFeePerGas + maxFeePerGas)', () => {
    const userOp = createMinimalUserOp()
    const packed = packUserOperation(userOp)

    expect(packed.gasFees.length).toBe(66)
  })

  it('should pack paymasterAndData when paymaster is provided', () => {
    const userOp = createFullUserOp()
    const packed = packUserOperation(userOp)

    expect(packed.paymasterAndData).not.toBe('0x')
    // Should contain paymaster address
    expect(packed.paymasterAndData.toLowerCase()).toContain(PAYMASTER.slice(2).toLowerCase())
  })

  it('should handle zero gas values', () => {
    const userOp = createMinimalUserOp({
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
    })
    const packed = packUserOperation(userOp)
    expect(packed.accountGasLimits).toBeTruthy()
    expect(packed.gasFees).toBeTruthy()
  })

  it('should handle paymaster without paymasterData', () => {
    const userOp = createMinimalUserOp({
      paymaster: PAYMASTER,
      paymasterVerificationGasLimit: 100n,
      paymasterPostOpGasLimit: 200n,
    })
    const packed = packUserOperation(userOp)
    expect(packed.paymasterAndData).not.toBe('0x')
  })
})

describe('unpackUserOperation', () => {
  it('should unpack a minimal packed UserOp', () => {
    const original = createMinimalUserOp()
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.sender).toBe(SENDER)
    expect(unpacked.nonce).toBe(1n)
    expect(unpacked.callData).toBe('0xdeadbeef')
    expect(unpacked.callGasLimit).toBe(100_000n)
    expect(unpacked.verificationGasLimit).toBe(200_000n)
    expect(unpacked.preVerificationGas).toBe(50_000n)
    expect(unpacked.maxFeePerGas).toBe(30_000_000_000n)
    expect(unpacked.maxPriorityFeePerGas).toBe(1_500_000_000n)
    expect(unpacked.factory).toBeUndefined()
    expect(unpacked.paymaster).toBeUndefined()
  })

  it('should unpack initCode to factory + factoryData', () => {
    const original = createMinimalUserOp({
      factory: FACTORY,
      factoryData: '0x112233' as Hex,
    })
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.factory?.toLowerCase()).toBe(FACTORY.toLowerCase())
    expect(unpacked.factoryData).toBe('0x112233')
  })

  it('should handle empty initCode', () => {
    const unpacked = unpackUserOperation({
      sender: SENDER,
      nonce: '0x1',
      initCode: '0x',
      callData: '0x',
      accountGasLimits: '0x' + '0'.repeat(64),
      preVerificationGas: '0x0',
      gasFees: '0x' + '0'.repeat(64),
      paymasterAndData: '0x',
      signature: '0x',
    })
    expect(unpacked.factory).toBeUndefined()
    expect(unpacked.factoryData).toBeUndefined()
  })

  it('should unpack paymasterAndData to paymaster + gas limits + data', () => {
    const original = createFullUserOp()
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.paymaster?.toLowerCase()).toBe(PAYMASTER.toLowerCase())
    expect(unpacked.paymasterVerificationGasLimit).toBe(75_000n)
    expect(unpacked.paymasterPostOpGasLimit).toBe(50_000n)
  })

  it('should handle empty paymasterAndData', () => {
    const original = createMinimalUserOp()
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)
    expect(unpacked.paymaster).toBeUndefined()
  })

  it('should handle missing fields gracefully', () => {
    const unpacked = unpackUserOperation({
      sender: SENDER,
      nonce: '0x0',
      callData: '0x',
      signature: '0x',
    } as Record<string, Hex>)
    expect(unpacked.sender).toBe(SENDER)
    expect(unpacked.nonce).toBe(0n)
    expect(unpacked.verificationGasLimit).toBe(0n)
    expect(unpacked.callGasLimit).toBe(0n)
    expect(unpacked.maxFeePerGas).toBe(0n)
    expect(unpacked.maxPriorityFeePerGas).toBe(0n)
    expect(unpacked.preVerificationGas).toBe(0n)
  })
})

describe('pack/unpack round-trip', () => {
  it('should preserve all values through pack -> unpack', () => {
    const original = createMinimalUserOp()
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.sender).toBe(original.sender)
    expect(unpacked.nonce).toBe(original.nonce)
    expect(unpacked.callData).toBe(original.callData)
    expect(unpacked.callGasLimit).toBe(original.callGasLimit)
    expect(unpacked.verificationGasLimit).toBe(original.verificationGasLimit)
    expect(unpacked.preVerificationGas).toBe(original.preVerificationGas)
    expect(unpacked.maxFeePerGas).toBe(original.maxFeePerGas)
    expect(unpacked.maxPriorityFeePerGas).toBe(original.maxPriorityFeePerGas)
  })

  it('should preserve factory fields through round-trip', () => {
    const original = createMinimalUserOp({
      factory: FACTORY,
      factoryData: '0xaabbccdd' as Hex,
    })
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.factory?.toLowerCase()).toBe(original.factory!.toLowerCase())
    expect(unpacked.factoryData).toBe(original.factoryData)
  })

  it('should preserve paymaster fields through round-trip', () => {
    const original = createFullUserOp()
    const packed = packUserOperation(original)
    const unpacked = unpackUserOperation(packed as unknown as Record<string, Hex>)

    expect(unpacked.paymaster?.toLowerCase()).toBe(original.paymaster!.toLowerCase())
    expect(unpacked.paymasterVerificationGasLimit).toBe(original.paymasterVerificationGasLimit)
    expect(unpacked.paymasterPostOpGasLimit).toBe(original.paymasterPostOpGasLimit)
  })
})

describe('getUserOperationHash', () => {
  it('should return a hex string', () => {
    const userOp = createMinimalUserOp()
    const hash = getUserOperationHash(userOp, ENTRY_POINT, 1n)
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/i)
  })

  it('should be deterministic', () => {
    const userOp = createMinimalUserOp()
    const hash1 = getUserOperationHash(userOp, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp, ENTRY_POINT, 1n)
    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different nonces', () => {
    const userOp1 = createMinimalUserOp({ nonce: 1n })
    const userOp2 = createMinimalUserOp({ nonce: 2n })
    const hash1 = getUserOperationHash(userOp1, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp2, ENTRY_POINT, 1n)
    expect(hash1).not.toBe(hash2)
  })

  it('should produce different hashes for different chain IDs', () => {
    const userOp = createMinimalUserOp()
    const hash1 = getUserOperationHash(userOp, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp, ENTRY_POINT, 137n)
    expect(hash1).not.toBe(hash2)
  })

  it('should produce different hashes for different entry points', () => {
    const userOp = createMinimalUserOp()
    const ep2 = '0x000000000000000000000000000000000000abcd' as Address
    const hash1 = getUserOperationHash(userOp, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp, ep2, 1n)
    expect(hash1).not.toBe(hash2)
  })

  it('should produce different hashes for different callData', () => {
    const userOp1 = createMinimalUserOp({ callData: '0xaa' as Hex })
    const userOp2 = createMinimalUserOp({ callData: '0xbb' as Hex })
    const hash1 = getUserOperationHash(userOp1, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp2, ENTRY_POINT, 1n)
    expect(hash1).not.toBe(hash2)
  })

  it('should produce different hashes for different senders', () => {
    const sender2 = '0x0000000000000000000000000000000000000001' as Address
    const userOp1 = createMinimalUserOp({ sender: SENDER })
    const userOp2 = createMinimalUserOp({ sender: sender2 })
    const hash1 = getUserOperationHash(userOp1, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(userOp2, ENTRY_POINT, 1n)
    expect(hash1).not.toBe(hash2)
  })

  it('should include paymaster in hash calculation', () => {
    const withoutPaymaster = createMinimalUserOp()
    const withPaymaster = createFullUserOp()
    const hash1 = getUserOperationHash(withoutPaymaster, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(withPaymaster, ENTRY_POINT, 1n)
    expect(hash1).not.toBe(hash2)
  })

  it('should include factory in hash calculation', () => {
    const withoutFactory = createMinimalUserOp()
    const withFactory = createMinimalUserOp({
      factory: FACTORY,
      factoryData: '0x11' as Hex,
    })
    const hash1 = getUserOperationHash(withoutFactory, ENTRY_POINT, 1n)
    const hash2 = getUserOperationHash(withFactory, ENTRY_POINT, 1n)
    expect(hash1).not.toBe(hash2)
  })
})

describe('buildUserOpTypedData', () => {
  it('should return valid EIP-712 TypedData structure', () => {
    const userOp = createMinimalUserOp()
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)

    expect(typedData.primaryType).toBe('PackedUserOperation')
    expect(typedData.domain).toEqual({
      name: 'ERC4337',
      version: '1',
      chainId: 1n,
      verifyingContract: ENTRY_POINT,
    })
    expect(typedData.types.PackedUserOperation).toHaveLength(8)
    expect(typedData.types.PackedUserOperation.map((f) => f.name)).toEqual([
      'sender',
      'nonce',
      'initCode',
      'callData',
      'accountGasLimits',
      'preVerificationGas',
      'gasFees',
      'paymasterAndData',
    ])
  })

  it('should populate message fields from UserOperation', () => {
    const userOp = createMinimalUserOp()
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)

    expect(typedData.message.sender).toBe(SENDER)
    expect(typedData.message.nonce).toBe(1n)
    expect(typedData.message.callData).toBe('0xdeadbeef')
    expect(typedData.message.initCode).toBe('0x')
    expect(typedData.message.paymasterAndData).toBe('0x')
  })

  it('should include packed factory data in initCode', () => {
    const userOp = createMinimalUserOp({
      factory: FACTORY,
      factoryData: '0x112233' as Hex,
    })
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)

    expect(typedData.message.initCode).not.toBe('0x')
    expect((typedData.message.initCode as string).toLowerCase()).toContain(
      FACTORY.slice(2).toLowerCase()
    )
  })

  it('should include packed paymaster data in paymasterAndData', () => {
    const userOp = createFullUserOp()
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)

    expect(typedData.message.paymasterAndData).not.toBe('0x')
    expect((typedData.message.paymasterAndData as string).toLowerCase()).toContain(
      PAYMASTER.slice(2).toLowerCase()
    )
  })

  it('hashTypedData(buildUserOpTypedData(...)) === getUserOperationHash(...) for minimal op', () => {
    const userOp = createMinimalUserOp()
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)
    const hashFromTypedData = hashTypedData(typedData)
    const hashFromDirect = getUserOperationHash(userOp, ENTRY_POINT, 1n)

    expect(hashFromTypedData).toBe(hashFromDirect)
  })

  it('hashTypedData(buildUserOpTypedData(...)) === getUserOperationHash(...) for full op', () => {
    const userOp = createFullUserOp()
    const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, 1n)
    const hashFromTypedData = hashTypedData(typedData)
    const hashFromDirect = getUserOperationHash(userOp, ENTRY_POINT, 1n)

    expect(hashFromTypedData).toBe(hashFromDirect)
  })

  it('hash equivalence holds across different chain IDs', () => {
    const userOp = createMinimalUserOp()
    for (const chainId of [1n, 137n, 42161n]) {
      const typedData = buildUserOpTypedData(userOp, ENTRY_POINT, chainId)
      const hashFromTypedData = hashTypedData(typedData)
      const hashFromDirect = getUserOperationHash(userOp, ENTRY_POINT, chainId)
      expect(hashFromTypedData).toBe(hashFromDirect)
    }
  })
})
