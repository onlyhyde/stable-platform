import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  decodeECDSAValidatorInit,
  decodeMultiSigValidatorInit,
  decodeWebAuthnValidatorInit,
  encodeECDSASignature,
  encodeECDSAValidatorInit,
  encodeMultiSigSignature,
  encodeMultiSigValidatorInit,
  encodeWebAuthnValidatorInit,
  generateSignerChangeHash,
  identifyValidatorType,
  isValidSignatureFormat,
  validateECDSAValidatorConfig,
  validateMultiSigValidatorConfig,
  validateWebAuthnValidatorConfig,
} from '../../src/modules/utils/validatorUtils'

describe('validatorUtils', () => {
  describe('ECDSA Validator', () => {
    const validOwner = '0x1234567890123456789012345678901234567890' as Address

    describe('encodeECDSAValidatorInit', () => {
      it('should encode valid init data', () => {
        const initData = encodeECDSAValidatorInit({ owner: validOwner })

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBeGreaterThan(2)
      })

      it('should produce consistent output for same input', () => {
        const initData1 = encodeECDSAValidatorInit({ owner: validOwner })
        const initData2 = encodeECDSAValidatorInit({ owner: validOwner })

        expect(initData1).toBe(initData2)
      })
    })

    describe('decodeECDSAValidatorInit', () => {
      it('should decode encoded init data correctly', () => {
        const initData = encodeECDSAValidatorInit({ owner: validOwner })
        const decoded = decodeECDSAValidatorInit(initData)

        expect(decoded.owner.toLowerCase()).toBe(validOwner.toLowerCase())
      })
    })

    describe('validateECDSAValidatorConfig', () => {
      it('should validate valid config', () => {
        const result = validateECDSAValidatorConfig({ owner: validOwner })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject zero address', () => {
        const result = validateECDSAValidatorConfig({
          owner: '0x0000000000000000000000000000000000000000' as Address,
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Owner cannot be zero address')
      })

      it('should reject invalid address format', () => {
        const result = validateECDSAValidatorConfig({
          owner: 'not-an-address' as Address,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('valid Ethereum address'))).toBe(true)
      })

      it('should reject empty owner', () => {
        const result = validateECDSAValidatorConfig({
          owner: '' as Address,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('required'))).toBe(true)
      })
    })

    describe('encodeECDSASignature', () => {
      it('should encode signature correctly', () => {
        const signature = encodeECDSASignature({
          r: '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex,
          s: '0x5678901234567890123456789012345678901234567890123456789012345678' as Hex,
          v: 27,
        })

        expect(signature).toMatch(/^0x/)
        expect(signature.length).toBe(132) // 65 bytes = 130 hex chars + '0x'
      })
    })
  })

  describe('WebAuthn Validator', () => {
    const validConfig = {
      pubKeyX: 12345678901234567890123456789012345678901234567890n,
      pubKeyY: 98765432109876543210987654321098765432109876543210n,
      credentialId: '0xabcdef1234567890' as Hex,
    }

    describe('encodeWebAuthnValidatorInit', () => {
      it('should encode valid init data', () => {
        const initData = encodeWebAuthnValidatorInit(validConfig)

        expect(initData).toMatch(/^0x/)
        expect(initData.length).toBeGreaterThan(2)
      })
    })

    describe('decodeWebAuthnValidatorInit', () => {
      it('should decode encoded init data correctly', () => {
        const initData = encodeWebAuthnValidatorInit(validConfig)
        const decoded = decodeWebAuthnValidatorInit(initData)

        expect(decoded.pubKeyX).toBe(validConfig.pubKeyX)
        expect(decoded.pubKeyY).toBe(validConfig.pubKeyY)
        expect(decoded.credentialId).toBe(validConfig.credentialId)
      })
    })

    describe('validateWebAuthnValidatorConfig', () => {
      it('should validate valid config', () => {
        const result = validateWebAuthnValidatorConfig(validConfig)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject zero pubKeyX', () => {
        const result = validateWebAuthnValidatorConfig({
          ...validConfig,
          pubKeyX: 0n,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('Public key X'))).toBe(true)
      })

      it('should reject zero pubKeyY', () => {
        const result = validateWebAuthnValidatorConfig({
          ...validConfig,
          pubKeyY: 0n,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('Public key Y'))).toBe(true)
      })

      it('should reject invalid credentialId format', () => {
        const result = validateWebAuthnValidatorConfig({
          ...validConfig,
          credentialId: 'not-hex' as Hex,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('hex string'))).toBe(true)
      })
    })
  })

  describe('MultiSig Validator', () => {
    const validSigners = [
      '0x1111111111111111111111111111111111111111' as Address,
      '0x2222222222222222222222222222222222222222' as Address,
      '0x3333333333333333333333333333333333333333' as Address,
    ]

    describe('encodeMultiSigValidatorInit', () => {
      it('should encode valid init data', () => {
        const initData = encodeMultiSigValidatorInit({
          signers: validSigners,
          threshold: 2,
        })

        expect(initData).toMatch(/^0x/)
      })
    })

    describe('decodeMultiSigValidatorInit', () => {
      it('should decode encoded init data correctly', () => {
        const config = { signers: validSigners, threshold: 2 }
        const initData = encodeMultiSigValidatorInit(config)
        const decoded = decodeMultiSigValidatorInit(initData)

        expect(decoded.signers.length).toBe(validSigners.length)
        expect(decoded.threshold).toBe(2)
      })
    })

    describe('validateMultiSigValidatorConfig', () => {
      it('should validate valid config', () => {
        const result = validateMultiSigValidatorConfig({
          signers: validSigners,
          threshold: 2,
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate threshold <= signers', () => {
        const result = validateMultiSigValidatorConfig({
          signers: [
            '0x1111111111111111111111111111111111111111' as Address,
            '0x2222222222222222222222222222222222222222' as Address,
          ],
          threshold: 3,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('greater than number of signers'))).toBe(true)
      })

      it('should reject duplicate signers', () => {
        const result = validateMultiSigValidatorConfig({
          signers: [
            '0x1111111111111111111111111111111111111111' as Address,
            '0x1111111111111111111111111111111111111111' as Address,
          ],
          threshold: 1,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true)
      })

      it('should reject empty signers array', () => {
        const result = validateMultiSigValidatorConfig({
          signers: [],
          threshold: 1,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('signer is required'))).toBe(true)
      })

      it('should reject threshold of 0', () => {
        const result = validateMultiSigValidatorConfig({
          signers: validSigners,
          threshold: 0,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('at least 1'))).toBe(true)
      })

      it('should reject zero address in signers', () => {
        const result = validateMultiSigValidatorConfig({
          signers: [
            '0x1111111111111111111111111111111111111111' as Address,
            '0x0000000000000000000000000000000000000000' as Address,
          ],
          threshold: 1,
        })

        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.includes('zero address'))).toBe(true)
      })
    })

    describe('encodeMultiSigSignature', () => {
      it('should encode multiple signatures', () => {
        const signatures = [
          {
            signer: '0x1111111111111111111111111111111111111111' as Address,
            r: '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex,
            s: '0x5678901234567890123456789012345678901234567890123456789012345678' as Hex,
            v: 27,
          },
          {
            signer: '0x2222222222222222222222222222222222222222' as Address,
            r: '0xabcdef1234567890123456789012345678901234567890123456789012345678' as Hex,
            s: '0x9876543210987654321098765432109876543210987654321098765432109876' as Hex,
            v: 28,
          },
        ]

        const encoded = encodeMultiSigSignature(signatures)

        expect(encoded).toMatch(/^0x/)
        // Two 65-byte signatures = 130 bytes = 260 hex chars + '0x'
        expect(encoded.length).toBe(262)
      })

      it('should sort signatures by signer address', () => {
        const signatures = [
          {
            signer: '0x2222222222222222222222222222222222222222' as Address,
            r: '0xabcdef1234567890123456789012345678901234567890123456789012345678' as Hex,
            s: '0x9876543210987654321098765432109876543210987654321098765432109876' as Hex,
            v: 28,
          },
          {
            signer: '0x1111111111111111111111111111111111111111' as Address,
            r: '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex,
            s: '0x5678901234567890123456789012345678901234567890123456789012345678' as Hex,
            v: 27,
          },
        ]

        // Should produce same result regardless of input order
        const encoded1 = encodeMultiSigSignature(signatures)
        const encoded2 = encodeMultiSigSignature([...signatures].reverse())

        expect(encoded1).toBe(encoded2)
      })
    })

    describe('generateSignerChangeHash', () => {
      it('should generate hash for add operation', () => {
        const hash = generateSignerChangeHash({
          account: '0x1234567890123456789012345678901234567890' as Address,
          operation: 'add',
          signer: '0xabcdef1234567890123456789012345678901234' as Address,
          nonce: 1n,
        })

        expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      })

      it('should generate different hash for remove operation', () => {
        const hashAdd = generateSignerChangeHash({
          account: '0x1234567890123456789012345678901234567890' as Address,
          operation: 'add',
          signer: '0xabcdef1234567890123456789012345678901234' as Address,
          nonce: 1n,
        })

        const hashRemove = generateSignerChangeHash({
          account: '0x1234567890123456789012345678901234567890' as Address,
          operation: 'remove',
          signer: '0xabcdef1234567890123456789012345678901234' as Address,
          nonce: 1n,
        })

        expect(hashAdd).not.toBe(hashRemove)
      })

      it('should generate different hash for different nonce', () => {
        const hash1 = generateSignerChangeHash({
          account: '0x1234567890123456789012345678901234567890' as Address,
          operation: 'add',
          signer: '0xabcdef1234567890123456789012345678901234' as Address,
          nonce: 1n,
        })

        const hash2 = generateSignerChangeHash({
          account: '0x1234567890123456789012345678901234567890' as Address,
          operation: 'add',
          signer: '0xabcdef1234567890123456789012345678901234' as Address,
          nonce: 2n,
        })

        expect(hash1).not.toBe(hash2)
      })
    })
  })

  describe('Common Utils', () => {
    describe('identifyValidatorType', () => {
      const knownValidators = {
        ecdsa: '0x1234567890123456789012345678901234567890' as Address,
        webauthn: '0xabcdef1234567890123456789012345678901234' as Address,
      }

      it('should identify known validator type', () => {
        const type = identifyValidatorType(
          '0x1234567890123456789012345678901234567890' as Address,
          knownValidators
        )

        expect(type).toBe('ecdsa')
      })

      it('should return null for unknown validator', () => {
        const type = identifyValidatorType(
          '0x9999999999999999999999999999999999999999' as Address,
          knownValidators
        )

        expect(type).toBeNull()
      })

      it('should be case-insensitive', () => {
        const type = identifyValidatorType(
          '0x1234567890123456789012345678901234567890'.toUpperCase() as Address,
          knownValidators
        )

        expect(type).toBe('ecdsa')
      })
    })

    describe('isValidSignatureFormat', () => {
      it('should return true for valid signature', () => {
        const validSig =
          '0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890' as Hex

        expect(isValidSignatureFormat(validSig)).toBe(true)
      })

      it('should return false for too short signature', () => {
        expect(isValidSignatureFormat('0x1234' as Hex)).toBe(false)
      })

      it('should return false for non-hex signature', () => {
        expect(isValidSignatureFormat('not-hex' as Hex)).toBe(false)
      })
    })
  })
})
