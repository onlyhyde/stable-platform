/**
 * Session Crypto Tests (SEC-6)
 *
 * Tests for session storage encryption functionality
 */

import {
  decryptSessionData,
  deriveSessionKey,
  type EncryptedSessionData,
  encryptSessionData,
  isEncryptedSessionData,
  secureClear,
} from '../../../src/background/keyring/sessionCrypto'

describe('sessionCrypto', () => {
  // Test salt (32 bytes)
  const testSalt = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ])

  describe('deriveSessionKey', () => {
    it('should derive a CryptoKey from salt', async () => {
      const key = await deriveSessionKey(testSalt)

      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('AES-GCM')
      expect(key.extractable).toBe(false)
      expect(key.usages).toContain('encrypt')
      expect(key.usages).toContain('decrypt')
    })

    it('should derive the same key from the same salt', async () => {
      const _key1 = await deriveSessionKey(testSalt)
      const _key2 = await deriveSessionKey(testSalt)

      // Keys can't be directly compared, but we can verify they produce the same ciphertext
      const testData = { message: 'test' }
      const encrypted1 = await encryptSessionData(testData, testSalt)
      const decrypted2 = await decryptSessionData<typeof testData>(encrypted1, testSalt)

      expect(decrypted2).toEqual(testData)
    })

    it('should derive different keys from different salts', async () => {
      const differentSalt = new Uint8Array(32)
      crypto.getRandomValues(differentSalt)

      const testData = { message: 'test' }
      const encrypted = await encryptSessionData(testData, testSalt)

      // Decrypting with different salt should fail
      await expect(decryptSessionData(encrypted, differentSalt)).rejects.toThrow()
    })
  })

  describe('encryptSessionData', () => {
    it('should encrypt data and return EncryptedSessionData structure', async () => {
      const data = { keyrings: [{ type: 'hd', accounts: [] }] }

      const encrypted = await encryptSessionData(data, testSalt)

      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.ciphertext.length).toBeGreaterThan(0)
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.iv.length).toBeGreaterThan(0)
      expect(encrypted.version).toBe(1)
      expect(encrypted.encryptedAt).toBeLessThanOrEqual(Date.now())
    })

    it('should produce different ciphertexts for same data (random IV)', async () => {
      const data = { message: 'same data' }

      const encrypted1 = await encryptSessionData(data, testSalt)
      const encrypted2 = await encryptSessionData(data, testSalt)

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      // Ciphertexts should be different (due to different IVs)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
    })

    it('should handle complex nested objects', async () => {
      const complexData = {
        vaultData: {
          keyrings: [
            {
              type: 'hd',
              mnemonic: 'test mnemonic phrase for testing',
              accounts: [
                { address: '0x1234', privateKey: '0xabcd' },
                { address: '0x5678', privateKey: '0xefgh' },
              ],
            },
          ],
        },
        createdAt: Date.now(),
        autoLockMinutes: 15,
      }

      const encrypted = await encryptSessionData(complexData, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(complexData)
    })

    it('should handle empty objects', async () => {
      const encrypted = await encryptSessionData({}, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual({})
    })

    it('should handle arrays', async () => {
      const data = [1, 2, 3, 'test', { nested: true }]

      const encrypted = await encryptSessionData(data, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(data)
    })

    it('should handle strings', async () => {
      const data = 'simple string data'

      const encrypted = await encryptSessionData(data, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toBe(data)
    })

    it('should handle null and undefined values in objects', async () => {
      const data = { nullValue: null, nested: { inner: null } }

      const encrypted = await encryptSessionData(data, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(data)
    })

    it('should handle unicode characters', async () => {
      const data = { message: '한글 테스트 🔐 émojis and ümlauts' }

      const encrypted = await encryptSessionData(data, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(data)
    })

    it('should handle large data', async () => {
      const largeData = {
        keyrings: Array(10)
          .fill(null)
          .map((_, i) => ({
            type: 'hd',
            accounts: Array(100)
              .fill(null)
              .map((_, j) => ({
                address: `0x${i.toString(16).padStart(2, '0')}${j.toString(16).padStart(2, '0')}`,
                privateKey: `0x${'a'.repeat(64)}`,
              })),
          })),
      }

      const encrypted = await encryptSessionData(largeData, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(largeData)
    })
  })

  describe('decryptSessionData', () => {
    it('should decrypt encrypted data correctly', async () => {
      const originalData = {
        vaultData: { keyrings: [] },
        createdAt: 1234567890,
        autoLockMinutes: 15,
      }

      const encrypted = await encryptSessionData(originalData, testSalt)
      const decrypted = await decryptSessionData(encrypted, testSalt)

      expect(decrypted).toEqual(originalData)
    })

    it('should throw on tampered ciphertext', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      // Tamper with ciphertext
      const tamperedCiphertext = encrypted.ciphertext.slice(0, -4) + 'XXXX'
      const tampered: EncryptedSessionData = {
        ...encrypted,
        ciphertext: tamperedCiphertext,
      }

      await expect(decryptSessionData(tampered, testSalt)).rejects.toThrow()
    })

    it('should throw on tampered IV', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      // Tamper with IV
      const tampered: EncryptedSessionData = {
        ...encrypted,
        iv: 'AAAAAAAAAAAAAAAA', // 12 bytes in base64
      }

      await expect(decryptSessionData(tampered, testSalt)).rejects.toThrow()
    })

    it('should throw on unsupported version', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      // Change version
      const tampered = {
        ...encrypted,
        version: 2 as const,
      }

      // Error is caught and re-thrown with generic message for security
      await expect(decryptSessionData(tampered as EncryptedSessionData, testSalt)).rejects.toThrow(
        'Session decryption failed'
      )
    })

    it('should throw on wrong salt', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      const wrongSalt = new Uint8Array(32)
      crypto.getRandomValues(wrongSalt)

      await expect(decryptSessionData(encrypted, wrongSalt)).rejects.toThrow()
    })

    it('should throw on empty salt', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      const emptySalt = new Uint8Array(0)

      await expect(decryptSessionData(encrypted, emptySalt)).rejects.toThrow()
    })
  })

  describe('isEncryptedSessionData', () => {
    it('should return true for valid encrypted data', async () => {
      const encrypted = await encryptSessionData({ test: true }, testSalt)

      expect(isEncryptedSessionData(encrypted)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isEncryptedSessionData(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isEncryptedSessionData(undefined)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isEncryptedSessionData('string')).toBe(false)
      expect(isEncryptedSessionData(123)).toBe(false)
      expect(isEncryptedSessionData(true)).toBe(false)
    })

    it('should return false for missing ciphertext', () => {
      expect(
        isEncryptedSessionData({
          iv: 'test',
          version: 1,
          encryptedAt: 123,
        })
      ).toBe(false)
    })

    it('should return false for missing iv', () => {
      expect(
        isEncryptedSessionData({
          ciphertext: 'test',
          version: 1,
          encryptedAt: 123,
        })
      ).toBe(false)
    })

    it('should return false for wrong version', () => {
      expect(
        isEncryptedSessionData({
          ciphertext: 'test',
          iv: 'test',
          version: 2,
          encryptedAt: 123,
        })
      ).toBe(false)
    })

    it('should return false for missing encryptedAt', () => {
      expect(
        isEncryptedSessionData({
          ciphertext: 'test',
          iv: 'test',
          version: 1,
        })
      ).toBe(false)
    })

    it('should return false for legacy session data format', () => {
      const legacyData = {
        vaultData: { keyrings: [] },
        createdAt: Date.now(),
        autoLockMinutes: 15,
      }

      expect(isEncryptedSessionData(legacyData)).toBe(false)
    })
  })

  describe('secureClear', () => {
    it('should fill array with zeros after random values', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])

      secureClear(data)

      // After secureClear, all values should be 0
      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0])
    })

    it('should handle empty arrays', () => {
      const data = new Uint8Array(0)

      expect(() => secureClear(data)).not.toThrow()
    })

    it('should handle large arrays', () => {
      const data = new Uint8Array(10000)
      data.fill(255)

      secureClear(data)

      expect(data.every((v) => v === 0)).toBe(true)
    })
  })

  describe('encryption security properties', () => {
    it('should use AES-GCM (authenticated encryption)', async () => {
      const data = { secret: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      // Verify we're using 12-byte IV (standard for GCM)
      const ivBytes = atob(encrypted.iv)
      expect(ivBytes.length).toBe(12)
    })

    it('should not leak plaintext in ciphertext', async () => {
      const secret = 'super_secret_mnemonic_phrase'
      const data = { secret }
      const encrypted = await encryptSessionData(data, testSalt)

      // Ciphertext should not contain plaintext
      expect(encrypted.ciphertext.includes(secret)).toBe(false)
      expect(encrypted.ciphertext.includes('secret')).toBe(false)
    })

    it('should produce cryptographically random IVs', async () => {
      const data = { test: true }
      const ivs = new Set<string>()

      // Generate 50 encryptions and check all IVs are unique (reduced for performance)
      for (let i = 0; i < 50; i++) {
        const encrypted = await encryptSessionData(data, testSalt)
        ivs.add(encrypted.iv)
      }

      expect(ivs.size).toBe(50)
    }, 15000) // Increased timeout for crypto operations

    it('should maintain data integrity (authentication)', async () => {
      const data = { important: 'data' }
      const encrypted = await encryptSessionData(data, testSalt)

      // Flip a single bit in ciphertext
      const bytes = atob(encrypted.ciphertext)
      const flipped =
        bytes.slice(0, 10) + String.fromCharCode(bytes.charCodeAt(10) ^ 1) + bytes.slice(11)
      const tampered: EncryptedSessionData = {
        ...encrypted,
        ciphertext: btoa(flipped),
      }

      // GCM should detect the tampering
      await expect(decryptSessionData(tampered, testSalt)).rejects.toThrow()
    })
  })
})
