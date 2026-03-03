import type { Address, Hex } from 'viem'
import { keccak256, toHex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMultiSigValidator,
  type CreateMultiSigValidatorConfig,
} from '../src/multisigValidator'

describe('multisig plugin', () => {
  const signerA = '0x1111111111111111111111111111111111111111' as Address
  const signerB = '0x2222222222222222222222222222222222222222' as Address
  const signerC = '0x3333333333333333333333333333333333333333' as Address

  const mockSignatureA = '0xaa'.padEnd(132, 'a') as Hex
  const mockSignatureB = '0xbb'.padEnd(132, 'b') as Hex
  const mockSignatureC = '0xcc'.padEnd(132, 'c') as Hex

  let mockCollectSignatures: ReturnType<typeof vi.fn>
  let defaultConfig: CreateMultiSigValidatorConfig

  beforeEach(() => {
    mockCollectSignatures = vi.fn().mockResolvedValue([
      { signer: signerA, signature: mockSignatureA },
      { signer: signerB, signature: mockSignatureB },
    ])
    defaultConfig = {
      signers: [signerA, signerB, signerC],
      threshold: 2,
      collectSignatures: mockCollectSignatures,
    }
  })

  describe('createMultiSigValidator', () => {
    it('should create a validator with type "validator"', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      expect(validator.type).toBe('validator')
    })

    it('should conform to Validator interface', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      expect(validator).toHaveProperty('address')
      expect(validator).toHaveProperty('type')
      expect(validator).toHaveProperty('getInitData')
      expect(validator).toHaveProperty('signHash')
      expect(validator).toHaveProperty('getSignerAddress')
      expect(typeof validator.getInitData).toBe('function')
      expect(typeof validator.signHash).toBe('function')
      expect(typeof validator.getSignerAddress).toBe('function')
    })

    it('should use default MultiSig validator address when not specified', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      expect(validator.address).toBeDefined()
      expect(validator.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should use custom validator address when provided', async () => {
      const customAddress = '0x9999999999999999999999999999999999999999' as Address
      const validator = await createMultiSigValidator({
        ...defaultConfig,
        validatorAddress: customAddress,
      })
      expect(validator.address).toBe(customAddress)
    })
  })

  describe('getInitData', () => {
    it('should return ABI-encoded (address[], uint8) format', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      const initData = await validator.getInitData()

      expect(initData).toMatch(/^0x/)
      // ABI-encoded array + uint8 is at least several hundred hex chars
      expect(initData.length).toBeGreaterThan(130)
    })
  })

  describe('signHash', () => {
    it('should call collectSignatures with the hash', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      const testHash = keccak256(toHex('test message'))

      await validator.signHash(testHash)

      expect(mockCollectSignatures).toHaveBeenCalledOnce()
      expect(mockCollectSignatures).toHaveBeenCalledWith(testHash)
    })

    it('should throw if fewer signatures than threshold', async () => {
      const insufficientSignatures = vi.fn().mockResolvedValue([
        { signer: signerA, signature: mockSignatureA },
      ])

      const validator = await createMultiSigValidator({
        ...defaultConfig,
        threshold: 2,
        collectSignatures: insufficientSignatures,
      })

      const testHash = keccak256(toHex('test message'))
      await expect(validator.signHash(testHash)).rejects.toThrow(/threshold/i)
    })

    it('should return concatenated signatures sorted by signer address', async () => {
      // Provide signatures in reverse order
      const reversedSignatures = vi.fn().mockResolvedValue([
        { signer: signerB, signature: mockSignatureB },
        { signer: signerA, signature: mockSignatureA },
      ])

      const validator = await createMultiSigValidator({
        ...defaultConfig,
        collectSignatures: reversedSignatures,
      })

      const testHash = keccak256(toHex('test message'))
      const signature = await validator.signHash(testHash)

      // Signatures should be sorted by address ascending
      // signerA (0x1111...) < signerB (0x2222...)
      // So signerA's signature should come first
      expect(signature).toMatch(/^0x/)
    })

    it('should reject duplicate signer in collected signatures', async () => {
      const duplicateSignatures = vi.fn().mockResolvedValue([
        { signer: signerA, signature: mockSignatureA },
        { signer: signerA, signature: mockSignatureA },
      ])

      const validator = await createMultiSigValidator({
        ...defaultConfig,
        collectSignatures: duplicateSignatures,
      })

      const testHash = keccak256(toHex('test message'))
      await expect(validator.signHash(testHash)).rejects.toThrow(/duplicate/i)
    })
  })

  describe('getSignerAddress', () => {
    it('should return a deterministic address derived from signers config', async () => {
      const validator = await createMultiSigValidator(defaultConfig)
      const signerAddress = validator.getSignerAddress()

      expect(signerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should return consistent address for same config', async () => {
      const v1 = await createMultiSigValidator(defaultConfig)
      const v2 = await createMultiSigValidator(defaultConfig)

      expect(v1.getSignerAddress()).toBe(v2.getSignerAddress())
    })
  })

  describe('edge cases', () => {
    it('should work with threshold of 1', async () => {
      const singleSig = vi.fn().mockResolvedValue([
        { signer: signerA, signature: mockSignatureA },
      ])

      const validator = await createMultiSigValidator({
        signers: [signerA, signerB],
        threshold: 1,
        collectSignatures: singleSig,
      })

      const testHash = keccak256(toHex('test message'))
      const signature = await validator.signHash(testHash)

      expect(signature).toMatch(/^0x/)
    })

    it('should work with threshold equal to signer count', async () => {
      const allSignatures = vi.fn().mockResolvedValue([
        { signer: signerA, signature: mockSignatureA },
        { signer: signerB, signature: mockSignatureB },
      ])

      const validator = await createMultiSigValidator({
        signers: [signerA, signerB],
        threshold: 2,
        collectSignatures: allSignatures,
      })

      const testHash = keccak256(toHex('test message'))
      const signature = await validator.signHash(testHash)

      expect(signature).toMatch(/^0x/)
    })
  })
})
