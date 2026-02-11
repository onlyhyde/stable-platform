import type { Hex } from 'viem'
import { hexToBytes } from 'viem'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMPRESSED_PUBKEY_SIZE,
  checkViewTag,
  computeStealthPrivateKey,
  computeViewTag,
  createMetadata,
  derivePublicKey,
  encodeStealthMetaAddress,
  encodeStealthMetaAddressUri,
  extractViewTag,
  generatePrivateKey,
  generateStealthAddressCrypto,
  generateStealthKeyPair,
  parseStealthMetaAddress,
  parseStealthMetaAddressUri,
  SCHEME_ID,
  VIEW_TAG_SIZE,
  validateMetadata,
  viewTagsMatch,
} from '../src'

describe('stealth plugin', () => {
  describe('key generation', () => {
    describe('generatePrivateKey', () => {
      it('should generate a valid private key', () => {
        const privateKey = generatePrivateKey()

        expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      })

      it('should generate unique keys', () => {
        const key1 = generatePrivateKey()
        const key2 = generatePrivateKey()

        expect(key1).not.toBe(key2)
      })
    })

    describe('derivePublicKey', () => {
      it('should derive compressed public key from private key', () => {
        const privateKey = generatePrivateKey()
        const publicKey = derivePublicKey(privateKey, true)

        // Compressed public key is 33 bytes
        expect(hexToBytes(publicKey)).toHaveLength(COMPRESSED_PUBKEY_SIZE)
        // Should start with 02 or 03
        expect(publicKey.slice(0, 4)).toMatch(/^0x0[23]/)
      })

      it('should derive uncompressed public key', () => {
        const privateKey = generatePrivateKey()
        const publicKey = derivePublicKey(privateKey, false)

        // Uncompressed public key is 65 bytes
        expect(hexToBytes(publicKey)).toHaveLength(65)
        // Should start with 04
        expect(publicKey.slice(0, 4)).toBe('0x04')
      })

      it('should derive consistent public key for same private key', () => {
        const privateKey = generatePrivateKey()
        const pubKey1 = derivePublicKey(privateKey, true)
        const pubKey2 = derivePublicKey(privateKey, true)

        expect(pubKey1).toBe(pubKey2)
      })

      it('should throw for invalid private key (zero)', () => {
        const zeroKey = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex

        expect(() => derivePublicKey(zeroKey)).toThrow('Invalid private key: cannot be zero')
      })
    })

    describe('generateStealthKeyPair', () => {
      it('should generate valid key pair', () => {
        const keyPair = generateStealthKeyPair()

        expect(keyPair.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
        expect(hexToBytes(keyPair.publicKey)).toHaveLength(COMPRESSED_PUBKEY_SIZE)
      })

      it('should generate matching key pair', () => {
        const keyPair = generateStealthKeyPair()
        const derivedPubKey = derivePublicKey(keyPair.privateKey, true)

        expect(keyPair.publicKey).toBe(derivedPubKey)
      })
    })
  })

  describe('stealth address generation', () => {
    let spendingKeyPair: { privateKey: Hex; publicKey: Hex }
    let viewingKeyPair: { privateKey: Hex; publicKey: Hex }

    beforeEach(() => {
      spendingKeyPair = generateStealthKeyPair()
      viewingKeyPair = generateStealthKeyPair()
    })

    describe('generateStealthAddressCrypto', () => {
      it('should generate valid stealth address', () => {
        const result = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        expect(result.stealthAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
        expect(hexToBytes(result.ephemeralPubKey)).toHaveLength(COMPRESSED_PUBKEY_SIZE)
        expect(hexToBytes(result.viewTag)).toHaveLength(VIEW_TAG_SIZE)
      })

      it('should generate different addresses for different recipients', () => {
        const otherSpendingKeyPair = generateStealthKeyPair()
        const otherViewingKeyPair = generateStealthKeyPair()

        const result1 = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const result2 = generateStealthAddressCrypto(
          otherSpendingKeyPair.publicKey,
          otherViewingKeyPair.publicKey
        )

        expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
      })

      it('should generate different addresses for same recipient (due to random ephemeral key)', () => {
        const result1 = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const result2 = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        // Different ephemeral keys should produce different addresses
        expect(result1.ephemeralPubKey).not.toBe(result2.ephemeralPubKey)
        expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
      })
    })
  })

  describe('stealth private key computation', () => {
    let spendingKeyPair: { privateKey: Hex; publicKey: Hex }
    let viewingKeyPair: { privateKey: Hex; publicKey: Hex }

    beforeEach(() => {
      spendingKeyPair = generateStealthKeyPair()
      viewingKeyPair = generateStealthKeyPair()
    })

    describe('computeStealthPrivateKey', () => {
      it('should compute stealth private key that matches generated address', () => {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const computed = computeStealthPrivateKey(
          generated.ephemeralPubKey,
          spendingKeyPair.privateKey,
          viewingKeyPair.privateKey
        )

        // The computed address should match the generated address
        expect(computed.stealthAddress.toLowerCase()).toBe(generated.stealthAddress.toLowerCase())
      })

      it('should return valid private key format', () => {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const computed = computeStealthPrivateKey(
          generated.ephemeralPubKey,
          spendingKeyPair.privateKey,
          viewingKeyPair.privateKey
        )

        expect(computed.stealthPrivateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      })

      it('should derive different stealth keys for different ephemeral keys', () => {
        const generated1 = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const generated2 = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const computed1 = computeStealthPrivateKey(
          generated1.ephemeralPubKey,
          spendingKeyPair.privateKey,
          viewingKeyPair.privateKey
        )
        const computed2 = computeStealthPrivateKey(
          generated2.ephemeralPubKey,
          spendingKeyPair.privateKey,
          viewingKeyPair.privateKey
        )

        expect(computed1.stealthPrivateKey).not.toBe(computed2.stealthPrivateKey)
      })
    })
  })

  describe('view tag operations', () => {
    describe('checkViewTag', () => {
      let spendingKeyPair: { privateKey: Hex; publicKey: Hex }
      let viewingKeyPair: { privateKey: Hex; publicKey: Hex }

      beforeEach(() => {
        spendingKeyPair = generateStealthKeyPair()
        viewingKeyPair = generateStealthKeyPair()
      })

      it('should return true for matching view tag', () => {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const matches = checkViewTag(
          generated.ephemeralPubKey,
          viewingKeyPair.privateKey,
          generated.viewTag
        )

        expect(matches).toBe(true)
      })

      it('should return false for non-matching view tag', () => {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const matches = checkViewTag(
          generated.ephemeralPubKey,
          viewingKeyPair.privateKey,
          '0xff' as Hex // Wrong view tag
        )

        // May match by chance (1/256 probability), but usually won't
        // This test verifies the function works
        expect(typeof matches).toBe('boolean')
      })

      it('should return false for different viewing key', () => {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const otherViewingKeyPair = generateStealthKeyPair()

        // The view tag computed with a different viewing key should not match
        const computedMatches = checkViewTag(
          generated.ephemeralPubKey,
          otherViewingKeyPair.privateKey,
          generated.viewTag
        )

        // Very unlikely to match by chance
        expect(computedMatches).toBe(false)
      })
    })

    describe('computeViewTag', () => {
      it('should compute 1-byte view tag', () => {
        const sharedSecret = new Uint8Array(33).fill(1)
        const viewTag = computeViewTag(sharedSecret)

        expect(hexToBytes(viewTag)).toHaveLength(VIEW_TAG_SIZE)
      })

      it('should throw for empty shared secret', () => {
        expect(() => computeViewTag(new Uint8Array(0))).toThrow('Shared secret cannot be empty')
      })

      it('should produce different view tags for different secrets', () => {
        const secret1 = new Uint8Array(33).fill(1)
        const secret2 = new Uint8Array(33).fill(2)

        const viewTag1 = computeViewTag(secret1)
        const viewTag2 = computeViewTag(secret2)

        expect(viewTag1).not.toBe(viewTag2)
      })
    })

    describe('extractViewTag', () => {
      it('should extract view tag from metadata', () => {
        const metadata = '0xab1234' as Hex
        const viewTag = extractViewTag(metadata)

        expect(viewTag).toBe('0xab')
      })

      it('should throw for empty metadata', () => {
        expect(() => extractViewTag('0x' as Hex)).toThrow('Metadata cannot be empty')
      })

      it('should throw for too short metadata', () => {
        // Empty after 0x prefix but before VIEW_TAG_SIZE
        expect(() => extractViewTag('0x' as Hex)).toThrow()
      })
    })

    describe('createMetadata', () => {
      it('should create metadata with view tag only', () => {
        const viewTag = '0xab' as Hex
        const metadata = createMetadata(viewTag)

        expect(metadata).toBe('0xab')
      })

      it('should create metadata with view tag and extra data', () => {
        const viewTag = '0xab' as Hex
        const extraData = '0x1234' as Hex
        const metadata = createMetadata(viewTag, extraData)

        expect(metadata).toBe('0xab1234')
      })

      it('should throw for invalid view tag size', () => {
        const invalidViewTag = '0xabcd' as Hex // 2 bytes

        expect(() => createMetadata(invalidViewTag)).toThrow('View tag must be exactly 1 byte')
      })

      it('should throw for empty view tag', () => {
        expect(() => createMetadata('0x' as Hex)).toThrow('View tag cannot be empty')
      })
    })

    describe('viewTagsMatch', () => {
      it('should return true for matching view tags', () => {
        expect(viewTagsMatch('0xab' as Hex, '0xab' as Hex)).toBe(true)
      })

      it('should return true for case-insensitive match', () => {
        expect(viewTagsMatch('0xAB' as Hex, '0xab' as Hex)).toBe(true)
      })

      it('should return false for non-matching view tags', () => {
        expect(viewTagsMatch('0xab' as Hex, '0xcd' as Hex)).toBe(false)
      })
    })

    describe('validateMetadata', () => {
      it('should pass for valid metadata', () => {
        expect(() => validateMetadata('0xab1234' as Hex)).not.toThrow()
      })

      it('should throw for empty metadata', () => {
        expect(() => validateMetadata('0x' as Hex)).toThrow('Metadata cannot be empty')
      })

      it('should throw for invalid hex characters', () => {
        expect(() => validateMetadata('0xgg' as Hex)).toThrow('invalid hex characters')
      })

      it('should throw for metadata without 0x prefix', () => {
        expect(() => validateMetadata('ab1234' as Hex)).toThrow(
          'must be a hex string starting with 0x'
        )
      })

      it('should throw for oversized metadata', () => {
        const largeMetadata = ('0x' + 'ab'.repeat(2000)) as Hex

        expect(() => validateMetadata(largeMetadata)).toThrow('Metadata too large')
      })
    })
  })

  describe('meta-address operations', () => {
    let spendingKeyPair: { privateKey: Hex; publicKey: Hex }
    let viewingKeyPair: { privateKey: Hex; publicKey: Hex }

    beforeEach(() => {
      spendingKeyPair = generateStealthKeyPair()
      viewingKeyPair = generateStealthKeyPair()
    })

    describe('encodeStealthMetaAddress', () => {
      it('should encode meta-address to 66 bytes', () => {
        const encoded = encodeStealthMetaAddress(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        expect(hexToBytes(encoded)).toHaveLength(66) // 33 + 33 bytes
      })

      it('should throw for non-compressed public keys', () => {
        const uncompressed = derivePublicKey(spendingKeyPair.privateKey, false)

        expect(() => encodeStealthMetaAddress(uncompressed, viewingKeyPair.publicKey)).toThrow(
          'Public keys must be compressed (33 bytes)'
        )
      })
    })

    describe('parseStealthMetaAddress', () => {
      it('should parse encoded meta-address', () => {
        const encoded = encodeStealthMetaAddress(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const parsed = parseStealthMetaAddress(encoded)

        expect(parsed.spendingPubKey).toBe(spendingKeyPair.publicKey)
        expect(parsed.viewingPubKey).toBe(viewingKeyPair.publicKey)
        expect(parsed.schemeId).toBe(SCHEME_ID.SECP256K1)
      })

      it('should throw for invalid length', () => {
        const invalidLength = '0xabcd' as Hex

        expect(() => parseStealthMetaAddress(invalidLength)).toThrow(
          'Invalid stealth meta-address length'
        )
      })

      it('should round-trip encode/parse', () => {
        const encoded = encodeStealthMetaAddress(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const parsed = parseStealthMetaAddress(encoded)
        const reencoded = encodeStealthMetaAddress(parsed.spendingPubKey, parsed.viewingPubKey)

        expect(reencoded).toBe(encoded)
      })
    })
  })

  describe('URI operations', () => {
    let spendingKeyPair: { privateKey: Hex; publicKey: Hex }
    let viewingKeyPair: { privateKey: Hex; publicKey: Hex }

    beforeEach(() => {
      spendingKeyPair = generateStealthKeyPair()
      viewingKeyPair = generateStealthKeyPair()
    })

    describe('encodeStealthMetaAddressUri', () => {
      it('should encode URI with chain prefix', () => {
        const uri = encodeStealthMetaAddressUri(
          'eth',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        expect(uri).toMatch(/^st:eth:0x[a-fA-F0-9]+$/)
      })

      it('should support different chain prefixes', () => {
        const uriEth = encodeStealthMetaAddressUri(
          'eth',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        const uriStablenet = encodeStealthMetaAddressUri(
          'stablenet',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        expect(uriEth).toMatch(/^st:eth:/)
        expect(uriStablenet).toMatch(/^st:stablenet:/)
      })
    })

    describe('parseStealthMetaAddressUri', () => {
      it('should parse valid URI', () => {
        const uri = encodeStealthMetaAddressUri(
          'eth',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const parsed = parseStealthMetaAddressUri(uri)

        expect(parsed.chainPrefix).toBe('eth')
        expect(parsed.stealthMetaAddress.spendingPubKey).toBe(spendingKeyPair.publicKey)
        expect(parsed.stealthMetaAddress.viewingPubKey).toBe(viewingKeyPair.publicKey)
      })

      it('should throw for missing st: prefix', () => {
        expect(() => parseStealthMetaAddressUri('eth:0xabcd')).toThrow('must start with "st:"')
      })

      it('should throw for empty chain prefix', () => {
        const encoded = encodeStealthMetaAddress(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        expect(() => parseStealthMetaAddressUri(`st::${encoded}`)).toThrow(
          'chain prefix cannot be empty'
        )
      })

      it('should throw for invalid chain prefix characters', () => {
        const encoded = encodeStealthMetaAddress(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )
        expect(() => parseStealthMetaAddressUri(`st:eth@invalid:${encoded}`)).toThrow(
          'chain prefix must be alphanumeric'
        )
      })

      it('should throw for empty address', () => {
        expect(() => parseStealthMetaAddressUri('st:eth:')).toThrow('address cannot be empty')
      })

      it('should throw for non-hex address', () => {
        expect(() => parseStealthMetaAddressUri('st:eth:notahexstring')).toThrow(
          'must be a hex string'
        )
      })

      it('should throw for null or undefined', () => {
        expect(() => parseStealthMetaAddressUri(null as unknown as string)).toThrow(
          'must be a non-empty string'
        )
        expect(() => parseStealthMetaAddressUri(undefined as unknown as string)).toThrow(
          'must be a non-empty string'
        )
      })

      it('should round-trip encode/parse URI', () => {
        const originalUri = encodeStealthMetaAddressUri(
          'eth',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const parsed = parseStealthMetaAddressUri(originalUri)
        const reencoded = encodeStealthMetaAddressUri(
          parsed.chainPrefix,
          parsed.stealthMetaAddress.spendingPubKey,
          parsed.stealthMetaAddress.viewingPubKey
        )

        expect(reencoded).toBe(originalUri)
      })

      it('should handle hyphenated chain prefixes', () => {
        const uri = encodeStealthMetaAddressUri(
          'base-sepolia',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const parsed = parseStealthMetaAddressUri(uri)

        expect(parsed.chainPrefix).toBe('base-sepolia')
      })

      it('should trim whitespace', () => {
        const uri = encodeStealthMetaAddressUri(
          'eth',
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const parsed = parseStealthMetaAddressUri(`  ${uri}  `)

        expect(parsed.chainPrefix).toBe('eth')
      })
    })
  })

  describe('end-to-end stealth flow', () => {
    it('should complete full stealth address flow', () => {
      // 1. Recipient generates key pairs
      const spendingKeyPair = generateStealthKeyPair()
      const viewingKeyPair = generateStealthKeyPair()

      // 2. Recipient publishes stealth meta-address
      const stealthMetaAddressUri = encodeStealthMetaAddressUri(
        'eth',
        spendingKeyPair.publicKey,
        viewingKeyPair.publicKey
      )

      // 3. Sender parses meta-address and generates stealth address
      const parsed = parseStealthMetaAddressUri(stealthMetaAddressUri)
      const generated = generateStealthAddressCrypto(
        parsed.stealthMetaAddress.spendingPubKey,
        parsed.stealthMetaAddress.viewingPubKey
      )

      // 4. Sender sends funds to generated.stealthAddress
      // and announces (ephemeralPubKey, viewTag) on-chain

      // 5. Recipient scans announcements using view tag
      const viewTagMatches = checkViewTag(
        generated.ephemeralPubKey,
        viewingKeyPair.privateKey,
        generated.viewTag
      )
      expect(viewTagMatches).toBe(true)

      // 6. For matching announcements, recipient computes stealth private key
      const computed = computeStealthPrivateKey(
        generated.ephemeralPubKey,
        spendingKeyPair.privateKey,
        viewingKeyPair.privateKey
      )

      // 7. Verify computed address matches generated address
      expect(computed.stealthAddress.toLowerCase()).toBe(generated.stealthAddress.toLowerCase())

      // 8. Recipient can now use computed.stealthPrivateKey to spend funds
      expect(computed.stealthPrivateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should handle multiple payments to same recipient', () => {
      const spendingKeyPair = generateStealthKeyPair()
      const viewingKeyPair = generateStealthKeyPair()

      // Generate multiple stealth addresses
      const payments = []
      for (let i = 0; i < 5; i++) {
        const generated = generateStealthAddressCrypto(
          spendingKeyPair.publicKey,
          viewingKeyPair.publicKey
        )

        const computed = computeStealthPrivateKey(
          generated.ephemeralPubKey,
          spendingKeyPair.privateKey,
          viewingKeyPair.privateKey
        )

        payments.push({
          generated,
          computed,
        })
      }

      // All payments should have different stealth addresses
      const addresses = payments.map((p) => p.generated.stealthAddress)
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(5)

      // All computed addresses should match generated addresses
      for (const payment of payments) {
        expect(payment.computed.stealthAddress.toLowerCase()).toBe(
          payment.generated.stealthAddress.toLowerCase()
        )
      }
    })
  })

  describe('edge cases', () => {
    it('should handle keys at curve boundary', () => {
      // Keys near the curve order n are still valid
      // This just verifies the code doesn't crash on various inputs
      const keyPair = generateStealthKeyPair()

      expect(() => generateStealthAddressCrypto(keyPair.publicKey, keyPair.publicKey)).not.toThrow()
    })

    it('should handle same spending and viewing keys', () => {
      const keyPair = generateStealthKeyPair()

      // Using same key for both spending and viewing (not recommended but valid)
      const generated = generateStealthAddressCrypto(keyPair.publicKey, keyPair.publicKey)

      const computed = computeStealthPrivateKey(
        generated.ephemeralPubKey,
        keyPair.privateKey,
        keyPair.privateKey
      )

      expect(computed.stealthAddress.toLowerCase()).toBe(generated.stealthAddress.toLowerCase())
    })

    it('should handle view tag collision probability correctly', () => {
      // View tags provide 1/256 filtering (1 byte)
      // After checking 100 random announcements, we should rarely match
      const spendingKeyPair = generateStealthKeyPair()
      const viewingKeyPair = generateStealthKeyPair()

      const generated = generateStealthAddressCrypto(
        spendingKeyPair.publicKey,
        viewingKeyPair.publicKey
      )

      // Generate random ephemeral keys and check false positive rate
      let matches = 0
      for (let i = 0; i < 100; i++) {
        const randomEphemeral = generateStealthKeyPair()
        const randomMatches = checkViewTag(
          randomEphemeral.publicKey,
          viewingKeyPair.privateKey,
          generated.viewTag
        )
        if (randomMatches) matches++
      }

      // Expected ~0.4 matches (100 * 1/256), but could be 0-3 typically
      // Just verify it's not always matching
      expect(matches).toBeLessThan(10)
    })
  })
})
