import type { Hex, LocalAccount } from 'viem'
import { keccak256, toHex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createEcdsaValidator,
  createEcdsaValidatorFromPrivateKey,
  serializeEcdsaValidator,
} from '../src/ecdsaValidator'

describe('ecdsa plugin', () => {
  let testPrivateKey: Hex
  let testSigner: LocalAccount

  beforeEach(() => {
    testPrivateKey = generatePrivateKey()
    testSigner = privateKeyToAccount(testPrivateKey)
  })

  describe('createEcdsaValidator', () => {
    it('should create a validator with correct type', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })

      expect(validator.type).toBe('validator')
    })

    it('should return the correct signer address', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })

      expect(validator.getSignerAddress()).toBe(testSigner.address)
    })

    it('should return signer address as init data', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const initData = await validator.getInitData()

      expect(initData).toBe(testSigner.address)
    })

    it('should use custom validator address when provided', async () => {
      const customAddress = '0x1234567890123456789012345678901234567890' as const
      const validator = await createEcdsaValidator({
        signer: testSigner,
        validatorAddress: customAddress,
      })

      expect(validator.address).toBe(customAddress)
    })

    it('should use default validator address when not provided', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })

      // Default ECDSA_VALIDATOR_ADDRESS from @stablenet/sdk-types
      expect(validator.address).toBeDefined()
      expect(validator.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  describe('signHash', () => {
    it('should sign a hash correctly', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const testHash = keccak256(toHex('test message'))

      const signature = await validator.signHash(testHash)

      // Signature should be 65 bytes (130 hex chars + 0x prefix)
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/)
    })

    it('should produce different signatures for different hashes', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const hash1 = keccak256(toHex('message 1'))
      const hash2 = keccak256(toHex('message 2'))

      const signature1 = await validator.signHash(hash1)
      const signature2 = await validator.signHash(hash2)

      expect(signature1).not.toBe(signature2)
    })

    it('should produce consistent signatures for the same hash', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const testHash = keccak256(toHex('test message'))

      const signature1 = await validator.signHash(testHash)
      const signature2 = await validator.signHash(testHash)

      // Note: ECDSA signatures may include randomness (k value)
      // but with deterministic k (RFC 6979), they should be consistent
      expect(signature1).toBe(signature2)
    })
  })

  describe('createEcdsaValidatorFromPrivateKey', () => {
    it('should create a validator from private key', async () => {
      const validator = await createEcdsaValidatorFromPrivateKey({
        privateKey: testPrivateKey,
      })

      expect(validator.type).toBe('validator')
      expect(validator.getSignerAddress()).toBe(testSigner.address)
    })

    it('should use custom validator address when provided', async () => {
      const customAddress = '0x1234567890123456789012345678901234567890' as const
      const validator = await createEcdsaValidatorFromPrivateKey({
        privateKey: testPrivateKey,
        validatorAddress: customAddress,
      })

      expect(validator.address).toBe(customAddress)
    })

    it('should produce same signatures as createEcdsaValidator', async () => {
      const validator1 = await createEcdsaValidator({ signer: testSigner })
      const validator2 = await createEcdsaValidatorFromPrivateKey({
        privateKey: testPrivateKey,
      })

      const testHash = keccak256(toHex('test message'))
      const signature1 = await validator1.signHash(testHash)
      const signature2 = await validator2.signHash(testHash)

      expect(signature1).toBe(signature2)
    })
  })

  describe('serializeEcdsaValidator', () => {
    it('should serialize validator correctly', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const serialized = serializeEcdsaValidator(validator)

      expect(serialized.address).toBe(validator.address)
      expect(serialized.signerAddress).toBe(testSigner.address)
    })

    it('should include all required fields', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const serialized = serializeEcdsaValidator(validator)

      expect(serialized).toHaveProperty('address')
      expect(serialized).toHaveProperty('signerAddress')
    })
  })

  describe('edge cases', () => {
    it('should handle different private keys correctly', async () => {
      const privateKey1 = generatePrivateKey()
      const privateKey2 = generatePrivateKey()

      const validator1 = await createEcdsaValidatorFromPrivateKey({
        privateKey: privateKey1,
      })
      const validator2 = await createEcdsaValidatorFromPrivateKey({
        privateKey: privateKey2,
      })

      expect(validator1.getSignerAddress()).not.toBe(validator2.getSignerAddress())
    })

    it('should handle zero-padded hash', async () => {
      const validator = await createEcdsaValidator({ signer: testSigner })
      const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex

      const signature = await validator.signHash(zeroHash)

      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/)
    })
  })
})
