import type { UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex, LocalAccount } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodePaymasterData,
  isPaymasterDataSupported,
  splitEnvelopeAndSignature,
  PaymasterType as CorePaymasterType,
  HEADER_SIZE,
} from '@stablenet/core'
import {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
} from '../src/verifyingPaymaster'

describe('paymaster plugin', () => {
  let testPrivateKey: Hex
  let testSigner: LocalAccount
  const testPaymasterAddress = '0x1234567890123456789012345678901234567890' as Address
  const testEntryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
  const testChainId = 1n

  // Mock UserOperation for testing
  const mockUserOp: UserOperation = {
    sender: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
    nonce: 0n,
    factory: null,
    factoryData: null,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    paymaster: null,
    paymasterVerificationGasLimit: null,
    paymasterPostOpGasLimit: null,
    paymasterData: null,
    signature: '0x' as Hex,
  }

  beforeEach(() => {
    testPrivateKey = generatePrivateKey()
    testSigner = privateKeyToAccount(testPrivateKey)
    // Mock Date.now for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createVerifyingPaymaster', () => {
    it('should create a paymaster client with required methods', () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      expect(paymaster.getPaymasterStubData).toBeDefined()
      expect(paymaster.getPaymasterData).toBeDefined()
      expect(typeof paymaster.getPaymasterStubData).toBe('function')
      expect(typeof paymaster.getPaymasterData).toBe('function')
    })
  })

  describe('getPaymasterStubData', () => {
    it('should return stub data with correct paymaster address', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      expect(stubData.paymaster).toBe(testPaymasterAddress)
    })

    it('should return stub data with gas limits', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      expect(stubData.paymasterVerificationGasLimit).toBeDefined()
      expect(stubData.paymasterPostOpGasLimit).toBeDefined()
      expect(stubData.paymasterVerificationGasLimit).toBeGreaterThan(0n)
      expect(stubData.paymasterPostOpGasLimit).toBeGreaterThan(0n)
    })

    it('should return stub data with paymaster data', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      expect(stubData.paymasterData).toBeDefined()
      expect(stubData.paymasterData).toMatch(/^0x/)
    })

    it('should produce v2 envelope format with stub signature', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      // Verify the data uses v2 envelope format (starts with version 0x01)
      expect(isPaymasterDataSupported(stubData.paymasterData)).toBe(true)

      // Should be decodable by the core codec (just the envelope part)
      const { envelope, signature } = splitEnvelopeAndSignature(stubData.paymasterData)
      const decoded = decodePaymasterData(envelope)

      expect(decoded.version).toBe(1)
      expect(decoded.paymasterType).toBe(CorePaymasterType.VERIFYING)
      expect(decoded.flags).toBe(0)

      // Stub signature should be 65 bytes of zeros
      expect(signature).toBe(`0x${'00'.repeat(65)}`)
    })
  })

  describe('getPaymasterData', () => {
    it('should return paymaster data with correct paymaster address', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const data = await paymaster.getPaymasterData(mockUserOp, testEntryPoint, testChainId)

      expect(data.paymaster).toBe(testPaymasterAddress)
    })

    it('should return paymaster data with actual signature in v2 format', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const data = await paymaster.getPaymasterData(mockUserOp, testEntryPoint, testChainId)

      expect(data.paymasterData).toBeDefined()
      expect(data.paymasterData).toMatch(/^0x/)

      // Verify v2 envelope format
      expect(isPaymasterDataSupported(data.paymasterData)).toBe(true)

      // Signature should not be all zeros
      const { signature } = splitEnvelopeAndSignature(data.paymasterData)
      expect(signature).not.toBe(`0x${'00'.repeat(65)}`)
    })

    it('should produce different signatures for different user operations', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const userOp1 = { ...mockUserOp, nonce: 1n }
      const userOp2 = { ...mockUserOp, nonce: 2n }

      const data1 = await paymaster.getPaymasterData(userOp1, testEntryPoint, testChainId)
      const data2 = await paymaster.getPaymasterData(userOp2, testEntryPoint, testChainId)

      expect(data1.paymasterData).not.toBe(data2.paymasterData)
    })

    it('should produce consistent signatures for same user operation', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const data1 = await paymaster.getPaymasterData(mockUserOp, testEntryPoint, testChainId)
      const data2 = await paymaster.getPaymasterData(mockUserOp, testEntryPoint, testChainId)

      // With same timestamp (mocked), same userOp should produce same signature
      expect(data1.paymasterData).toBe(data2.paymasterData)
    })
  })

  describe('validity period', () => {
    it('should use default validity seconds', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      // Decode the v2 envelope to inspect validity
      const { envelope } = splitEnvelopeAndSignature(stubData.paymasterData)
      const decoded = decodePaymasterData(envelope)
      const now = Math.floor(Date.now() / 1000)

      // Default validity is 3600 seconds (1 hour)
      expect(Number(decoded.validUntil)).toBeGreaterThan(now)
      expect(Number(decoded.validUntil)).toBeLessThanOrEqual(now + 3600)
    })

    it('should use custom validity seconds', async () => {
      const customValidity = 7200 // 2 hours
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
        validitySeconds: customValidity,
      })

      const stubData = await paymaster.getPaymasterStubData(mockUserOp, testEntryPoint, testChainId)

      // Decode the v2 envelope to inspect validity
      const { envelope } = splitEnvelopeAndSignature(stubData.paymasterData)
      const decoded = decodePaymasterData(envelope)
      const now = Math.floor(Date.now() / 1000)

      expect(Number(decoded.validUntil)).toBeGreaterThan(now + 3600) // More than default 1 hour
      expect(Number(decoded.validUntil)).toBeLessThanOrEqual(now + customValidity)
    })
  })

  describe('createVerifyingPaymasterFromPrivateKey', () => {
    it('should create a paymaster from private key', async () => {
      const paymaster = await createVerifyingPaymasterFromPrivateKey({
        paymasterAddress: testPaymasterAddress,
        privateKey: testPrivateKey,
        chainId: testChainId,
      })

      expect(paymaster.getPaymasterStubData).toBeDefined()
      expect(paymaster.getPaymasterData).toBeDefined()
    })

    it('should produce same signatures as createVerifyingPaymaster', async () => {
      const paymaster1 = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })
      const paymaster2 = await createVerifyingPaymasterFromPrivateKey({
        paymasterAddress: testPaymasterAddress,
        privateKey: testPrivateKey,
        chainId: testChainId,
      })

      const data1 = await paymaster1.getPaymasterData(mockUserOp, testEntryPoint, testChainId)
      const data2 = await paymaster2.getPaymasterData(mockUserOp, testEntryPoint, testChainId)

      expect(data1.paymasterData).toBe(data2.paymasterData)
    })
  })

  describe('user operation with factory', () => {
    it('should handle user operation with factory', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const userOpWithFactory: UserOperation = {
        ...mockUserOp,
        factory: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        factoryData: '0xabcdef' as Hex,
      }

      const data = await paymaster.getPaymasterData(userOpWithFactory, testEntryPoint, testChainId)

      expect(data.paymaster).toBe(testPaymasterAddress)
      expect(data.paymasterData).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle different chain IDs', async () => {
      const paymaster1 = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: 1n,
      })
      const paymaster2 = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: 137n,
      })

      const data1 = await paymaster1.getPaymasterData(mockUserOp, testEntryPoint, 1n)
      const data2 = await paymaster2.getPaymasterData(mockUserOp, testEntryPoint, 137n)

      // Different chain IDs should produce different signatures
      expect(data1.paymasterData).not.toBe(data2.paymasterData)
    })

    it('should handle large gas values', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const largeGasUserOp: UserOperation = {
        ...mockUserOp,
        callGasLimit: BigInt(2) ** BigInt(64) - BigInt(1),
        verificationGasLimit: BigInt(2) ** BigInt(64) - BigInt(1),
      }

      const data = await paymaster.getPaymasterData(largeGasUserOp, testEntryPoint, testChainId)

      expect(data.paymasterData).toBeDefined()
    })

    it('should produce data in v2 envelope format', async () => {
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: testPaymasterAddress,
        signer: testSigner,
        chainId: testChainId,
      })

      const data = await paymaster.getPaymasterData(mockUserOp, testEntryPoint, testChainId)

      // The data must be longer than just the header
      const hexLength = (data.paymasterData.length - 2) / 2  // bytes
      expect(hexLength).toBeGreaterThan(HEADER_SIZE)

      // Must be decodable as v2 envelope
      const { envelope } = splitEnvelopeAndSignature(data.paymasterData)
      const decoded = decodePaymasterData(envelope)

      expect(decoded.version).toBe(1)
      expect(decoded.paymasterType).toBe(CorePaymasterType.VERIFYING)
    })
  })
})
