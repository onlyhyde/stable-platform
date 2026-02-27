import { describe, expect, it } from 'vitest'
import { parseNonce, encodeNonceKey } from '../../src/nonce'

describe('nonce module', () => {
  describe('parseNonce', () => {
    it('should parse nonce with key=0', () => {
      const result = parseNonce(5n)
      expect(result.key).toBe(0n)
      expect(result.sequence).toBe(5n)
    })

    it('should parse nonce with non-zero key', () => {
      // key=1, sequence=10 → nonce = (1 << 64) | 10
      const nonce = (1n << 64n) | 10n
      const result = parseNonce(nonce)
      expect(result.key).toBe(1n)
      expect(result.sequence).toBe(10n)
    })

    it('should parse nonce with large key', () => {
      const key = 12345n
      const sequence = 42n
      const nonce = (key << 64n) | sequence
      const result = parseNonce(nonce)
      expect(result.key).toBe(key)
      expect(result.sequence).toBe(sequence)
    })

    it('should parse zero nonce', () => {
      const result = parseNonce(0n)
      expect(result.key).toBe(0n)
      expect(result.sequence).toBe(0n)
    })
  })

  describe('encodeNonceKey', () => {
    it('should encode key=0 and sequence', () => {
      const nonce = encodeNonceKey(0n, 5n)
      expect(nonce).toBe(5n)
    })

    it('should encode non-zero key', () => {
      const nonce = encodeNonceKey(1n, 10n)
      expect(nonce).toBe((1n << 64n) | 10n)
    })

    it('should roundtrip with parseNonce', () => {
      const key = 999n
      const sequence = 42n
      const nonce = encodeNonceKey(key, sequence)
      const parsed = parseNonce(nonce)
      expect(parsed.key).toBe(key)
      expect(parsed.sequence).toBe(sequence)
    })

    it('should mask sequence to 64 bits', () => {
      const maxSequence = (1n << 64n) - 1n
      const nonce = encodeNonceKey(0n, maxSequence)
      expect(nonce).toBe(maxSequence)
    })
  })
})
