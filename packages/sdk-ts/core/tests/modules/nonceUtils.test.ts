import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  decodeValidatorNonceKey,
  encodeValidatorNonceKey,
  isRootValidator,
  VALIDATION_MODE,
  VALIDATION_TYPE,
} from '../../src/modules/utils/nonceUtils'

describe('nonceUtils', () => {
  const ECDSA_VALIDATOR = '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address
  const WEBAUTHN_VALIDATOR = '0x169844994bd5b64c3a264c54d6b0863bb7df0487' as Address
  const MULTISIG_VALIDATOR = '0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5' as Address

  describe('constants', () => {
    it('should export VALIDATION_MODE constants', () => {
      expect(VALIDATION_MODE.DEFAULT).toBe(0x00)
      expect(VALIDATION_MODE.ENABLE).toBe(0x01)
    })

    it('should export VALIDATION_TYPE constants', () => {
      expect(VALIDATION_TYPE.ROOT).toBe(0x00)
      expect(VALIDATION_TYPE.VALIDATOR).toBe(0x01)
      expect(VALIDATION_TYPE.PERMISSION).toBe(0x02)
    })
  })

  describe('encodeValidatorNonceKey', () => {
    it('should return 0n for root validator (default)', () => {
      const key = encodeValidatorNonceKey(ECDSA_VALIDATOR, {
        type: VALIDATION_TYPE.ROOT,
      })
      expect(key).toBe(0n)
    })

    it('should encode non-root validator address into nonce key', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
      })
      expect(key).not.toBe(0n)
      // Verify address is embedded in the key
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.address.toLowerCase()).toBe(WEBAUTHN_VALIDATOR.toLowerCase())
    })

    it('should encode validator type in nonce key', () => {
      const key = encodeValidatorNonceKey(MULTISIG_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.type).toBe(VALIDATION_TYPE.VALIDATOR)
    })

    it('should encode validation mode in nonce key', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        mode: VALIDATION_MODE.ENABLE,
        type: VALIDATION_TYPE.VALIDATOR,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.mode).toBe(VALIDATION_MODE.ENABLE)
    })

    it('should default mode to DEFAULT and nonceKey to 0', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.mode).toBe(VALIDATION_MODE.DEFAULT)
      expect(decoded.nonceKey).toBe(0)
    })

    it('should encode custom nonceKey', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
        nonceKey: 42,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.nonceKey).toBe(42)
    })

    it('should throw for nonceKey exceeding uint16 range', () => {
      expect(() =>
        encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
          type: VALIDATION_TYPE.VALIDATOR,
          nonceKey: 65536,
        })
      ).toThrow(/0-65535/)
    })

    it('should throw for negative nonceKey', () => {
      expect(() =>
        encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
          type: VALIDATION_TYPE.VALIDATOR,
          nonceKey: -1,
        })
      ).toThrow(/0-65535/)
    })

    it('should accept max valid nonceKey (65535)', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
        nonceKey: 65535,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.nonceKey).toBe(65535)
    })
  })

  describe('decodeValidatorNonceKey', () => {
    it('should decode root validator key (0n)', () => {
      const decoded = decodeValidatorNonceKey(0n)
      expect(decoded.mode).toBe(VALIDATION_MODE.DEFAULT)
      expect(decoded.type).toBe(VALIDATION_TYPE.ROOT)
      expect(decoded.nonceKey).toBe(0)
    })

    it('should round-trip encode → decode for all validators', () => {
      for (const addr of [WEBAUTHN_VALIDATOR, MULTISIG_VALIDATOR]) {
        const key = encodeValidatorNonceKey(addr, {
          type: VALIDATION_TYPE.VALIDATOR,
        })
        const decoded = decodeValidatorNonceKey(key)
        expect(decoded.address.toLowerCase()).toBe(addr.toLowerCase())
        expect(decoded.type).toBe(VALIDATION_TYPE.VALIDATOR)
      }
    })

    it('should round-trip with all fields set', () => {
      const key = encodeValidatorNonceKey(MULTISIG_VALIDATOR, {
        mode: VALIDATION_MODE.ENABLE,
        type: VALIDATION_TYPE.VALIDATOR,
        nonceKey: 255,
      })
      const decoded = decodeValidatorNonceKey(key)
      expect(decoded.mode).toBe(VALIDATION_MODE.ENABLE)
      expect(decoded.type).toBe(VALIDATION_TYPE.VALIDATOR)
      expect(decoded.address.toLowerCase()).toBe(MULTISIG_VALIDATOR.toLowerCase())
      expect(decoded.nonceKey).toBe(255)
    })
  })

  describe('isRootValidator', () => {
    it('should return true for 0n', () => {
      expect(isRootValidator(0n)).toBe(true)
    })

    it('should return true for root-encoded key', () => {
      const key = encodeValidatorNonceKey(ECDSA_VALIDATOR, {
        type: VALIDATION_TYPE.ROOT,
      })
      expect(isRootValidator(key)).toBe(true)
    })

    it('should return false for non-root validator key', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
      })
      expect(isRootValidator(key)).toBe(false)
    })
  })

  describe('EntryPoint v0.7 compatibility', () => {
    it('should produce a 192-bit key fitting getNonce(address, uint192)', () => {
      const key = encodeValidatorNonceKey(WEBAUTHN_VALIDATOR, {
        type: VALIDATION_TYPE.VALIDATOR,
      })
      // EntryPoint v0.7 getNonce key is 192 bits (24 bytes)
      // key should fit in uint192
      const MAX_UINT192 = (1n << 192n) - 1n
      expect(key).toBeLessThanOrEqual(MAX_UINT192)
      expect(key).toBeGreaterThanOrEqual(0n)
    })
  })
})
