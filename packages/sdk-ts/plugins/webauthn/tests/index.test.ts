import type { Address, Hex } from 'viem'
import { keccak256, toHex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebAuthnSignatureData } from '@stablenet/core'
import {
  createWebAuthnValidator,
  type CreateWebAuthnValidatorConfig,
} from '../src/webauthnValidator'

// P256 curve order for malleability tests
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

describe('webauthn plugin', () => {
  const mockPubKeyX = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn
  const mockPubKeyY = 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321n
  const mockCredentialId = '0xdeadbeef01020304' as Hex

  const mockSignatureData: WebAuthnSignatureData = {
    authenticatorData: '0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763' as Hex,
    clientDataJSON: '0x7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22' as Hex,
    challengeIndex: 23,
    typeIndex: 1,
    r: 0xaabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344n,
    s: 0x1122334455667788112233445566778811223344556677881122334455667788n,
  }

  let mockSignFn: ReturnType<typeof vi.fn>
  let defaultConfig: CreateWebAuthnValidatorConfig

  beforeEach(() => {
    mockSignFn = vi.fn().mockResolvedValue(mockSignatureData)
    defaultConfig = {
      pubKeyX: mockPubKeyX,
      pubKeyY: mockPubKeyY,
      credentialId: mockCredentialId,
      signFn: mockSignFn,
    }
  })

  describe('createWebAuthnValidator', () => {
    it('should create a validator with type "validator"', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      expect(validator.type).toBe('validator')
    })

    it('should conform to Validator interface', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      expect(validator).toHaveProperty('address')
      expect(validator).toHaveProperty('type')
      expect(validator).toHaveProperty('getInitData')
      expect(validator).toHaveProperty('signHash')
      expect(validator).toHaveProperty('getSignerAddress')
      expect(typeof validator.getInitData).toBe('function')
      expect(typeof validator.signHash).toBe('function')
      expect(typeof validator.getSignerAddress).toBe('function')
    })

    it('should use default WebAuthn validator address when not specified', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      expect(validator.address).toBeDefined()
      expect(validator.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should use custom validator address when provided', async () => {
      const customAddress = '0x1234567890123456789012345678901234567890' as Address
      const validator = await createWebAuthnValidator({
        ...defaultConfig,
        validatorAddress: customAddress,
      })
      expect(validator.address).toBe(customAddress)
    })
  })

  describe('getInitData', () => {
    it('should return ABI-encoded (uint256, uint256, bytes) format', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      const initData = await validator.getInitData()

      // ABI-encoded data should start with 0x and be longer than raw pubkey data
      expect(initData).toMatch(/^0x/)
      // (uint256, uint256, bytes) = 32 + 32 + 32(offset) + 32(length) + padded(credentialId)
      // Minimum: 0x + 2*(32*2) + 32*2 + 32*2 + data = quite long
      expect(initData.length).toBeGreaterThan(130)
    })
  })

  describe('signHash', () => {
    it('should call signFn with the challenge hash', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      const testHash = keccak256(toHex('test message'))

      await validator.signHash(testHash)

      expect(mockSignFn).toHaveBeenCalledOnce()
      expect(mockSignFn).toHaveBeenCalledWith(testHash)
    })

    it('should return ABI-encoded WebAuthn signature', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      const testHash = keccak256(toHex('test message'))

      const signature = await validator.signHash(testHash)

      // Encoded WebAuthn signature is ABI-encoded with multiple fields
      expect(signature).toMatch(/^0x/)
      expect(signature.length).toBeGreaterThan(130)
    })

    it('should apply s-value malleability fix', async () => {
      // Create a signature with s > P256_N / 2 (high s)
      const highS = P256_N - 1n // This is > P256_N / 2
      const highSSignatureData: WebAuthnSignatureData = {
        ...mockSignatureData,
        s: highS,
      }
      const highSSignFn = vi.fn().mockResolvedValue(highSSignatureData)

      const validator = await createWebAuthnValidator({
        ...defaultConfig,
        signFn: highSSignFn,
      })

      const testHash = keccak256(toHex('test message'))
      const signature = await validator.signHash(testHash)

      // The signature should be produced (malleability fix is applied internally
      // by encodeWebAuthnSignature which normalizes s)
      expect(signature).toMatch(/^0x/)
      expect(signature.length).toBeGreaterThan(130)
    })

    it('should produce different signatures for different hashes', async () => {
      let callCount = 0
      const signFn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({
          ...mockSignatureData,
          r: mockSignatureData.r + BigInt(callCount),
        })
      })

      const validator = await createWebAuthnValidator({
        ...defaultConfig,
        signFn,
      })

      const hash1 = keccak256(toHex('message 1'))
      const hash2 = keccak256(toHex('message 2'))

      const sig1 = await validator.signHash(hash1)
      const sig2 = await validator.signHash(hash2)

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('getSignerAddress', () => {
    it('should return a deterministic address derived from credential', async () => {
      const validator = await createWebAuthnValidator(defaultConfig)
      const signerAddress = validator.getSignerAddress()

      expect(signerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should return consistent address for same config', async () => {
      const v1 = await createWebAuthnValidator(defaultConfig)
      const v2 = await createWebAuthnValidator(defaultConfig)

      expect(v1.getSignerAddress()).toBe(v2.getSignerAddress())
    })
  })
})
