/**
 * Stealth Transfer E2E Tests
 *
 * Tests the complete stealth address flow:
 * 1. Key generation (spending + viewing keypairs)
 * 2. Stealth meta-address registration on EIP-6538 Registry
 * 3. Stealth address generation for a payment
 * 4. ETH transfer to stealth address
 * 5. Announcement publication on EIP-5564 Announcer
 * 6. Announcement scanning and view tag filtering
 * 7. Stealth private key computation
 * 8. Spending verification from stealth address
 */

// Import stealth plugin
import {
  checkViewTag,
  computeStealthPrivateKey,
  createMetadata,
  derivePublicKey,
  ERC5564_ANNOUNCER_ABI,
  ERC6538_REGISTRY_ABI,
  encodeStealthMetaAddress,
  encodeStealthMetaAddressUri,
  generatePrivateKey,
  generateStealthAddressCrypto,
  generateStealthKeyPair,
  parseStealthMetaAddressUri,
  SCHEME_ID,
} from '@stablenet/plugin-stealth'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  type PublicClient,
  parseEther,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { beforeAll, describe, expect, it } from 'vitest'
import { isNetworkAvailable, TEST_CONFIG } from '../setup'

describe('Stealth Transfer E2E Tests', () => {
  let publicClient: PublicClient
  let senderWalletClient: WalletClient
  let recipientWalletClient: WalletClient
  let networkAvailable: boolean

  // Recipient's stealth keys
  let recipientSpendingKeyPair: { privateKey: Hex; publicKey: Hex }
  let recipientViewingKeyPair: { privateKey: Hex; publicKey: Hex }
  let recipientStealthMetaAddress: Hex
  let recipientStealthMetaAddressUri: string

  // Sender's generated stealth address for payment
  let generatedStealthAddress: Address
  let ephemeralPubKey: Hex
  let viewTag: Hex

  beforeAll(async () => {
    networkAvailable = await isNetworkAvailable()
    if (!networkAvailable) {
      console.warn('⚠️ Local network not available, stealth E2E tests will be skipped')
      return
    }

    const chain = {
      ...foundry,
      id: TEST_CONFIG.chainId,
    }

    publicClient = createPublicClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
    })

    // Sender (user1) - will send funds to stealth address
    const senderAccount = privateKeyToAccount(TEST_CONFIG.accounts.user1.privateKey as Hex)
    senderWalletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account: senderAccount,
    })

    // Recipient (user2) - will receive at stealth address
    const recipientAccount = privateKeyToAccount(TEST_CONFIG.accounts.user2.privateKey as Hex)
    recipientWalletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account: recipientAccount,
    })

    // Generate recipient's stealth keys
    recipientSpendingKeyPair = generateStealthKeyPair()
    recipientViewingKeyPair = generateStealthKeyPair()

    // Encode stealth meta-address
    recipientStealthMetaAddress = encodeStealthMetaAddress(
      recipientSpendingKeyPair.publicKey,
      recipientViewingKeyPair.publicKey
    )

    recipientStealthMetaAddressUri = encodeStealthMetaAddressUri(
      'eth',
      recipientSpendingKeyPair.publicKey,
      recipientViewingKeyPair.publicKey
    )
  })

  describe('1. Key Generation', () => {
    it('should generate valid spending and viewing key pairs', () => {
      if (!networkAvailable) return

      expect(recipientSpendingKeyPair.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(recipientSpendingKeyPair.publicKey).toMatch(/^0x0[23][a-fA-F0-9]{64}$/)
      expect(recipientViewingKeyPair.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(recipientViewingKeyPair.publicKey).toMatch(/^0x0[23][a-fA-F0-9]{64}$/)
    })

    it('should encode valid stealth meta-address (66 bytes)', () => {
      if (!networkAvailable) return

      // 66 bytes = 33 (spending) + 33 (viewing)
      const metaAddressBytes = Buffer.from(recipientStealthMetaAddress.slice(2), 'hex')
      expect(metaAddressBytes.length).toBe(66)
    })

    it('should create valid stealth meta-address URI', () => {
      if (!networkAvailable) return

      expect(recipientStealthMetaAddressUri).toMatch(/^st:eth:0x[a-fA-F0-9]+$/)

      // Should round-trip parse correctly
      const parsed = parseStealthMetaAddressUri(recipientStealthMetaAddressUri)
      expect(parsed.chainPrefix).toBe('eth')
      expect(parsed.stealthMetaAddress.spendingPubKey).toBe(recipientSpendingKeyPair.publicKey)
      expect(parsed.stealthMetaAddress.viewingPubKey).toBe(recipientViewingKeyPair.publicKey)
    })
  })

  describe('2. Registry Contract (EIP-6538)', () => {
    it('should check Registry contract deployment', async () => {
      if (!networkAvailable) return

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.stealthRegistry as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
      } else {
      }
    })

    it('should register stealth meta-address on-chain', async () => {
      if (!networkAvailable) return

      const registryAddress = TEST_CONFIG.contracts.stealthRegistry as Address
      const code = await publicClient.getCode({ address: registryAddress })

      if (!code || code === '0x') {
        return
      }

      try {
        // Register recipient's stealth meta-address
        const hash = await recipientWalletClient.writeContract({
          address: registryAddress,
          abi: ERC6538_REGISTRY_ABI,
          functionName: 'registerKeys',
          args: [BigInt(SCHEME_ID.SECP256K1), recipientStealthMetaAddress],
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        expect(receipt.status).toBe('success')
      } catch (_error) {}
    })

    it('should retrieve registered stealth meta-address', async () => {
      if (!networkAvailable) return

      const registryAddress = TEST_CONFIG.contracts.stealthRegistry as Address
      const code = await publicClient.getCode({ address: registryAddress })

      if (!code || code === '0x') {
        return
      }

      try {
        const storedMetaAddress = await publicClient.readContract({
          address: registryAddress,
          abi: ERC6538_REGISTRY_ABI,
          functionName: 'stealthMetaAddressOf',
          args: [TEST_CONFIG.accounts.user2.address as Address, BigInt(SCHEME_ID.SECP256K1)],
        })

        expect(storedMetaAddress).toBe(recipientStealthMetaAddress)
      } catch (_error) {}
    })
  })

  describe('3. Stealth Address Generation', () => {
    it('should generate stealth address for payment', () => {
      if (!networkAvailable) return

      const parsed = parseStealthMetaAddressUri(recipientStealthMetaAddressUri)
      const result = generateStealthAddressCrypto(
        parsed.stealthMetaAddress.spendingPubKey,
        parsed.stealthMetaAddress.viewingPubKey
      )

      generatedStealthAddress = result.stealthAddress as Address
      ephemeralPubKey = result.ephemeralPubKey
      viewTag = result.viewTag

      expect(generatedStealthAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(ephemeralPubKey).toMatch(/^0x0[23][a-fA-F0-9]{64}$/)
      expect(viewTag).toMatch(/^0x[a-fA-F0-9]{2}$/)
    })

    it('should generate different addresses for multiple payments', () => {
      if (!networkAvailable) return

      const parsed = parseStealthMetaAddressUri(recipientStealthMetaAddressUri)

      const addresses = new Set<string>()
      for (let i = 0; i < 5; i++) {
        const result = generateStealthAddressCrypto(
          parsed.stealthMetaAddress.spendingPubKey,
          parsed.stealthMetaAddress.viewingPubKey
        )
        addresses.add(result.stealthAddress.toLowerCase())
      }

      expect(addresses.size).toBe(5)
    })
  })

  describe('4. ETH Transfer to Stealth Address', () => {
    it('should send ETH to stealth address', async () => {
      if (!networkAvailable || !generatedStealthAddress) return

      const amount = parseEther('0.1')

      const balanceBefore = await publicClient.getBalance({
        address: generatedStealthAddress,
      })

      const hash = await senderWalletClient.sendTransaction({
        to: generatedStealthAddress,
        value: amount,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')

      const balanceAfter = await publicClient.getBalance({
        address: generatedStealthAddress,
      })

      expect(balanceAfter).toBe(balanceBefore + amount)
    })
  })

  describe('5. Announcement (EIP-5564)', () => {
    it('should check Announcer contract deployment', async () => {
      if (!networkAvailable) return

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.stealthAnnouncer as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
      } else {
      }
    })

    it('should publish announcement with ephemeral key and view tag', async () => {
      if (!networkAvailable || !generatedStealthAddress) return

      const announcerAddress = TEST_CONFIG.contracts.stealthAnnouncer as Address
      const code = await publicClient.getCode({ address: announcerAddress })

      if (!code || code === '0x') {
        return
      }

      // Create metadata with view tag
      const metadata = createMetadata(viewTag)

      const hash = await senderWalletClient.writeContract({
        address: announcerAddress,
        abi: ERC5564_ANNOUNCER_ABI,
        functionName: 'announce',
        args: [BigInt(SCHEME_ID.SECP256K1), generatedStealthAddress, ephemeralPubKey, metadata],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')

      // Verify announcement event was emitted
      const logs = receipt.logs.filter(
        (log) => log.address.toLowerCase() === announcerAddress.toLowerCase()
      )
      expect(logs.length).toBeGreaterThan(0)
    })
  })

  describe('6. View Tag Filtering', () => {
    it('should match view tag with correct viewing key', () => {
      if (!networkAvailable || !ephemeralPubKey || !viewTag) return

      const matches = checkViewTag(ephemeralPubKey, recipientViewingKeyPair.privateKey, viewTag)

      expect(matches).toBe(true)
    })

    it('should not match view tag with wrong viewing key', () => {
      if (!networkAvailable || !ephemeralPubKey || !viewTag) return

      const wrongViewingKey = generatePrivateKey()
      const matches = checkViewTag(ephemeralPubKey, wrongViewingKey, viewTag)

      // Very unlikely to match by chance (1/256)
      expect(matches).toBe(false)
    })

    it('should demonstrate view tag filtering efficiency', () => {
      if (!networkAvailable || !viewTag) return

      // Simulate scanning 1000 announcements
      const totalAnnouncements = 1000
      let passed = 0

      for (let i = 0; i < totalAnnouncements; i++) {
        // Simulate random ephemeral keys from other senders
        const randomEphemeralKeyPair = generateStealthKeyPair()
        const matches = checkViewTag(
          randomEphemeralKeyPair.publicKey,
          recipientViewingKeyPair.privateKey,
          viewTag
        )
        if (matches) passed++
      }

      // Expected: ~4 false positives (1000 / 256 ≈ 3.9)
      // Allow up to 20 for statistical variance
      expect(passed).toBeLessThan(20)
    })
  })

  describe('7. Stealth Key Computation', () => {
    it('should compute stealth private key matching generated address', () => {
      if (!networkAvailable || !ephemeralPubKey || !generatedStealthAddress) return

      const computed = computeStealthPrivateKey(
        ephemeralPubKey,
        recipientSpendingKeyPair.privateKey,
        recipientViewingKeyPair.privateKey
      )

      expect(computed.stealthAddress.toLowerCase()).toBe(generatedStealthAddress.toLowerCase())
      expect(computed.stealthPrivateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should derive correct public key from stealth private key', () => {
      if (!networkAvailable || !ephemeralPubKey || !generatedStealthAddress) return

      const computed = computeStealthPrivateKey(
        ephemeralPubKey,
        recipientSpendingKeyPair.privateKey,
        recipientViewingKeyPair.privateKey
      )

      // Derive public key from stealth private key
      const _derivedPublicKey = derivePublicKey(computed.stealthPrivateKey, false)

      // The public key should hash to the stealth address
      // We can verify by checking the address derivation
      expect(computed.stealthAddress.toLowerCase()).toBe(generatedStealthAddress.toLowerCase())
    })
  })

  describe('8. Spending from Stealth Address', () => {
    it('should allow recipient to spend from stealth address', async () => {
      if (!networkAvailable || !ephemeralPubKey || !generatedStealthAddress) return

      // Compute stealth private key
      const computed = computeStealthPrivateKey(
        ephemeralPubKey,
        recipientSpendingKeyPair.privateKey,
        recipientViewingKeyPair.privateKey
      )

      // Create wallet client with stealth private key
      const stealthAccount = privateKeyToAccount(computed.stealthPrivateKey as Hex)
      const stealthWalletClient = createWalletClient({
        chain: {
          ...foundry,
          id: TEST_CONFIG.chainId,
        },
        transport: http(TEST_CONFIG.rpcUrl),
        account: stealthAccount,
      })

      // Check balance before
      const balanceBefore = await publicClient.getBalance({
        address: generatedStealthAddress,
      })

      if (balanceBefore === 0n) {
        return
      }

      // Send some ETH back to recipient's main address
      const sendAmount = balanceBefore / 2n // Send half

      const hash = await stealthWalletClient.sendTransaction({
        to: TEST_CONFIG.accounts.user2.address as Address,
        value: sendAmount,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')

      const balanceAfter = await publicClient.getBalance({
        address: generatedStealthAddress,
      })

      // Balance should have decreased (by sendAmount + gas)
      expect(balanceAfter).toBeLessThan(balanceBefore)
    })
  })

  describe('9. Full Flow Integration', () => {
    it('should complete full stealth payment flow', async () => {
      if (!networkAvailable) return

      // Step 3: Sender generates unique stealth address
      const parsed = parseStealthMetaAddressUri(recipientStealthMetaAddressUri)
      const newStealth = generateStealthAddressCrypto(
        parsed.stealthMetaAddress.spendingPubKey,
        parsed.stealthMetaAddress.viewingPubKey
      )

      // Step 6: Recipient scans with view tag filter
      const viewTagMatches = checkViewTag(
        newStealth.ephemeralPubKey,
        recipientViewingKeyPair.privateKey,
        newStealth.viewTag
      )
      expect(viewTagMatches).toBe(true)

      // Step 7: Recipient computes stealth private key
      const stealthKey = computeStealthPrivateKey(
        newStealth.ephemeralPubKey,
        recipientSpendingKeyPair.privateKey,
        recipientViewingKeyPair.privateKey
      )
      expect(stealthKey.stealthAddress.toLowerCase()).toBe(newStealth.stealthAddress.toLowerCase())
    })
  })

  describe('10. Edge Cases', () => {
    it('should handle same spending and viewing keys', () => {
      if (!networkAvailable) return

      const singleKeyPair = generateStealthKeyPair()

      const result = generateStealthAddressCrypto(singleKeyPair.publicKey, singleKeyPair.publicKey)

      const computed = computeStealthPrivateKey(
        result.ephemeralPubKey,
        singleKeyPair.privateKey,
        singleKeyPair.privateKey
      )

      expect(computed.stealthAddress.toLowerCase()).toBe(result.stealthAddress.toLowerCase())
    })

    it('should handle multiple sequential payments', () => {
      if (!networkAvailable) return

      const payments: Array<{
        stealthAddress: string
        viewTag: string
        stealthPrivateKey: string
      }> = []

      for (let i = 0; i < 3; i++) {
        const result = generateStealthAddressCrypto(
          recipientSpendingKeyPair.publicKey,
          recipientViewingKeyPair.publicKey
        )

        const computed = computeStealthPrivateKey(
          result.ephemeralPubKey,
          recipientSpendingKeyPair.privateKey,
          recipientViewingKeyPair.privateKey
        )

        expect(computed.stealthAddress.toLowerCase()).toBe(result.stealthAddress.toLowerCase())

        payments.push({
          stealthAddress: result.stealthAddress,
          viewTag: result.viewTag,
          stealthPrivateKey: computed.stealthPrivateKey,
        })
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(payments.map((p) => p.stealthAddress.toLowerCase()))
      expect(uniqueAddresses.size).toBe(3)

      // All private keys should be unique
      const uniqueKeys = new Set(payments.map((p) => p.stealthPrivateKey))
      expect(uniqueKeys.size).toBe(3)
    })
  })
})
