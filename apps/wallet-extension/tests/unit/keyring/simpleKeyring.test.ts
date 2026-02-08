/**
 * SimpleKeyring Tests
 * TDD tests for the SimpleKeyring class that manages imported private keys
 */

import type { Address, Hex } from 'viem'
import { SimpleKeyring } from '../../../src/background/keyring/simpleKeyring'
import type { SimpleKeyringData } from '../../../src/types'

// Test private keys (DO NOT USE IN PRODUCTION)
const TEST_PRIVATE_KEY_1 =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex
const TEST_PRIVATE_KEY_2 =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex

// Known address derived from TEST_PRIVATE_KEY_1
const KNOWN_ADDRESS_1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address
// Known address derived from TEST_PRIVATE_KEY_2
const KNOWN_ADDRESS_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address

describe('SimpleKeyring', () => {
  let simpleKeyring: SimpleKeyring

  beforeEach(() => {
    simpleKeyring = new SimpleKeyring()
  })

  describe('constructor', () => {
    it('should create empty keyring without data', () => {
      expect(simpleKeyring.getAccounts()).toHaveLength(0)
    })

    it('should restore keyring from serialized data', () => {
      const data: SimpleKeyringData = {
        privateKeys: [TEST_PRIVATE_KEY_1, TEST_PRIVATE_KEY_2],
      }

      const restored = new SimpleKeyring(data)
      expect(restored.getAccounts()).toHaveLength(2)
    })
  })

  describe('importAccount', () => {
    it('should import valid private key', () => {
      const account = simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)

      expect(account.address.toLowerCase()).toBe(KNOWN_ADDRESS_1.toLowerCase())
      expect(account.type).toBe('simple')
    })

    it('should import private key without 0x prefix', () => {
      const keyWithoutPrefix = TEST_PRIVATE_KEY_1.slice(2) as Hex
      const account = simpleKeyring.importAccount(keyWithoutPrefix)

      expect(account.address.toLowerCase()).toBe(KNOWN_ADDRESS_1.toLowerCase())
    })

    it('should reject invalid private key', () => {
      const invalidKey = '0xinvalid' as Hex

      expect(() => simpleKeyring.importAccount(invalidKey)).toThrow('Invalid private key')
    })

    it('should reject private key with wrong length', () => {
      const shortKey = '0x1234' as Hex

      expect(() => simpleKeyring.importAccount(shortKey)).toThrow('Invalid private key')
    })

    it('should reject duplicate account', () => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)

      expect(() => simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)).toThrow(
        'Account already exists'
      )
    })

    it('should name accounts sequentially', () => {
      const account1 = simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
      const account2 = simpleKeyring.importAccount(TEST_PRIVATE_KEY_2)

      expect(account1.name).toBe('Imported 1')
      expect(account2.name).toBe('Imported 2')
    })
  })

  describe('removeAccount', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_2)
    })

    it('should remove existing account', () => {
      simpleKeyring.removeAccount(KNOWN_ADDRESS_1)

      expect(simpleKeyring.getAccounts()).toHaveLength(1)
      expect(simpleKeyring.hasAccount(KNOWN_ADDRESS_1)).toBe(false)
    })

    it('should throw for non-existing account', () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address

      expect(() => simpleKeyring.removeAccount(unknownAddress)).toThrow('Account not found')
    })

    it('should be case insensitive', () => {
      simpleKeyring.removeAccount(KNOWN_ADDRESS_1.toLowerCase() as Address)
      expect(simpleKeyring.hasAccount(KNOWN_ADDRESS_1)).toBe(false)
    })
  })

  describe('getAccounts', () => {
    it('should return empty array when no accounts', () => {
      expect(simpleKeyring.getAccounts()).toEqual([])
    })

    it('should return all imported accounts', () => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_2)

      const accounts = simpleKeyring.getAccounts()
      expect(accounts).toHaveLength(2)
    })

    it('should return copy of accounts array', () => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)

      const accounts1 = simpleKeyring.getAccounts()
      const accounts2 = simpleKeyring.getAccounts()

      expect(accounts1).toEqual(accounts2)
      expect(accounts1).not.toBe(accounts2)
    })
  })

  describe('getAccountCount', () => {
    it('should return 0 when no accounts', () => {
      expect(simpleKeyring.getAccountCount()).toBe(0)
    })

    it('should return correct count', () => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_2)
      expect(simpleKeyring.getAccountCount()).toBe(2)
    })
  })

  describe('hasAccount', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
    })

    it('should return true for existing account', () => {
      expect(simpleKeyring.hasAccount(KNOWN_ADDRESS_1)).toBe(true)
    })

    it('should return false for non-existing account', () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      expect(simpleKeyring.hasAccount(unknownAddress)).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(simpleKeyring.hasAccount(KNOWN_ADDRESS_1.toLowerCase() as Address)).toBe(true)
      expect(simpleKeyring.hasAccount(KNOWN_ADDRESS_1.toUpperCase() as Address)).toBe(true)
    })
  })

  describe('signMessage', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
    })

    it('should sign with imported key', async () => {
      const message = '0x48656c6c6f' as Hex // "Hello" in hex
      const signature = await simpleKeyring.signMessage(KNOWN_ADDRESS_1, message)

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(signature.length).toBe(132) // 65 bytes * 2 + '0x'
    })

    it('should produce consistent signatures', async () => {
      const message = '0x48656c6c6f' as Hex

      const sig1 = await simpleKeyring.signMessage(KNOWN_ADDRESS_1, message)
      const sig2 = await simpleKeyring.signMessage(KNOWN_ADDRESS_1, message)

      expect(sig1).toBe(sig2)
    })

    it('should throw for unknown account', async () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      const message = '0x48656c6c6f' as Hex

      await expect(simpleKeyring.signMessage(unknownAddress, message)).rejects.toThrow(
        'Account not found in keyring'
      )
    })

    it('should be case insensitive for address', async () => {
      const message = '0x48656c6c6f' as Hex

      const sig1 = await simpleKeyring.signMessage(KNOWN_ADDRESS_1, message)
      const sig2 = await simpleKeyring.signMessage(
        KNOWN_ADDRESS_1.toLowerCase() as Address,
        message
      )

      expect(sig1).toBe(sig2)
    })
  })

  describe('signTypedData', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
    })

    it('should sign typed data (EIP-712)', async () => {
      const typedData = {
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
        },
        primaryType: 'Person' as const,
        domain: {
          name: 'Test',
          version: '1',
          chainId: 1,
        },
        message: {
          name: 'Alice',
          wallet: KNOWN_ADDRESS_1,
        },
      }

      const signature = await simpleKeyring.signTypedData(KNOWN_ADDRESS_1, typedData)
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
    })

    it('should throw for unknown account', async () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      const typedData = {
        types: { Person: [{ name: 'name', type: 'string' }] },
        primaryType: 'Person' as const,
        domain: { name: 'Test', version: '1', chainId: 1 },
        message: { name: 'Alice' },
      }

      await expect(simpleKeyring.signTypedData(unknownAddress, typedData)).rejects.toThrow(
        'Account not found in keyring'
      )
    })
  })

  describe('signTransaction', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
    })

    it('should sign transaction', async () => {
      // EIP-1559 transaction format
      const tx = {
        to: '0x0000000000000000000000000000000000000001' as Address,
        value: BigInt(1000000000000000000),
        chainId: 1,
        maxFeePerGas: BigInt(20000000000), // 20 Gwei
        maxPriorityFeePerGas: BigInt(1000000000), // 1 Gwei
        nonce: 0,
        gas: BigInt(21000),
      }

      const signedTx = await simpleKeyring.signTransaction(KNOWN_ADDRESS_1, tx)
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/)
    })

    it('should throw for unknown account', async () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      const tx = {
        to: '0x0000000000000000000000000000000000000002' as Address,
        value: BigInt(1),
        chainId: 1,
        maxFeePerGas: BigInt(20000000000),
        maxPriorityFeePerGas: BigInt(1000000000),
        nonce: 0,
        gas: BigInt(21000),
      }

      await expect(simpleKeyring.signTransaction(unknownAddress, tx)).rejects.toThrow(
        'Account not found in keyring'
      )
    })
  })

  describe('exportPrivateKey', () => {
    beforeEach(() => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
    })

    it('should export private key', () => {
      const exportedKey = simpleKeyring.exportPrivateKey(KNOWN_ADDRESS_1)
      expect(exportedKey).toBe(TEST_PRIVATE_KEY_1)
    })

    it('should throw for non-existing account', () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address

      expect(() => simpleKeyring.exportPrivateKey(unknownAddress)).toThrow('Account not found')
    })

    it('should be case insensitive', () => {
      const exportedKey = simpleKeyring.exportPrivateKey(KNOWN_ADDRESS_1.toLowerCase() as Address)
      expect(exportedKey).toBe(TEST_PRIVATE_KEY_1)
    })
  })

  describe('serialize', () => {
    it('should serialize keyring data', () => {
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_1)
      simpleKeyring.importAccount(TEST_PRIVATE_KEY_2)

      const serialized = simpleKeyring.serialize()

      expect(serialized.privateKeys).toHaveLength(2)
      expect(serialized.privateKeys).toContain(TEST_PRIVATE_KEY_1)
      expect(serialized.privateKeys).toContain(TEST_PRIVATE_KEY_2)
    })

    it('should serialize empty keyring', () => {
      const serialized = simpleKeyring.serialize()
      expect(serialized.privateKeys).toHaveLength(0)
    })
  })

  describe('deserialization', () => {
    it('should restore accounts from serialized data', () => {
      // First keyring
      const keyring1 = new SimpleKeyring()
      keyring1.importAccount(TEST_PRIVATE_KEY_1)
      keyring1.importAccount(TEST_PRIVATE_KEY_2)

      const serialized = keyring1.serialize()

      // Restore to new keyring
      const keyring2 = new SimpleKeyring(serialized)

      expect(keyring2.getAccountCount()).toBe(2)
      expect(keyring2.hasAccount(KNOWN_ADDRESS_1)).toBe(true)
      expect(keyring2.hasAccount(KNOWN_ADDRESS_2)).toBe(true)
    })

    it('should restore private keys correctly', () => {
      const keyring1 = new SimpleKeyring()
      keyring1.importAccount(TEST_PRIVATE_KEY_1)

      const serialized = keyring1.serialize()
      const keyring2 = new SimpleKeyring(serialized)

      // Should be able to export the same private key
      const exportedKey = keyring2.exportPrivateKey(KNOWN_ADDRESS_1)
      expect(exportedKey).toBe(TEST_PRIVATE_KEY_1)
    })

    it('should be able to sign after restore', async () => {
      const keyring1 = new SimpleKeyring()
      keyring1.importAccount(TEST_PRIVATE_KEY_1)

      const message = '0x48656c6c6f' as Hex
      const sig1 = await keyring1.signMessage(KNOWN_ADDRESS_1, message)

      const serialized = keyring1.serialize()
      const keyring2 = new SimpleKeyring(serialized)

      const sig2 = await keyring2.signMessage(KNOWN_ADDRESS_1, message)
      expect(sig2).toBe(sig1)
    })
  })
})
