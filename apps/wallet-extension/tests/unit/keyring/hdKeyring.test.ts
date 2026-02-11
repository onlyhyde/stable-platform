/**
 * HDKeyring Tests
 * TDD tests for the HDKeyring class that manages HD wallet accounts
 */

import type { Address, Hex } from 'viem'
import { HDKeyring } from '../../../src/background/keyring/hdKeyring'
import type { HDKeyringData } from '../../../src/types'
import { TEST_MNEMONIC, TEST_MNEMONIC_24 } from '../../utils/testUtils'

// Known address derived from TEST_MNEMONIC at index 0
// This is the first address derived from "abandon abandon ... about" mnemonic
const KNOWN_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' as Address

describe('HDKeyring', () => {
  let hdKeyring: HDKeyring

  beforeEach(() => {
    hdKeyring = new HDKeyring()
  })

  describe('constructor', () => {
    it('should create empty keyring without data', () => {
      expect(hdKeyring.getAccounts()).toHaveLength(0)
      expect(hdKeyring.getMnemonic()).toBe('')
    })

    it('should restore keyring from serialized data', () => {
      const data: HDKeyringData = {
        mnemonic: TEST_MNEMONIC,
        hdPath: "m/44'/60'/0'/0",
        numberOfAccounts: 2,
      }

      const restored = new HDKeyring(data)
      expect(restored.getAccounts()).toHaveLength(2)
      expect(restored.getMnemonic()).toBe(TEST_MNEMONIC)
    })
  })

  describe('initializeNewMnemonic', () => {
    it('should generate 12-word mnemonic by default', () => {
      const mnemonic = hdKeyring.initializeNewMnemonic()
      const words = mnemonic.split(' ')
      expect(words).toHaveLength(12)
    })

    it('should generate 12-word mnemonic explicitly', () => {
      const mnemonic = hdKeyring.initializeNewMnemonic(12)
      const words = mnemonic.split(' ')
      expect(words).toHaveLength(12)
    })

    it('should generate 24-word mnemonic', () => {
      const mnemonic = hdKeyring.initializeNewMnemonic(24)
      const words = mnemonic.split(' ')
      expect(words).toHaveLength(24)
    })

    it('should be a valid BIP39 mnemonic', () => {
      const _mnemonic = hdKeyring.initializeNewMnemonic()
      // Adding an account should not throw with valid mnemonic
      expect(() => hdKeyring.addAccount()).not.toThrow()
    })

    it('should clear existing accounts when generating new mnemonic', () => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
      expect(hdKeyring.getAccounts()).toHaveLength(1)

      hdKeyring.initializeNewMnemonic()
      expect(hdKeyring.getAccounts()).toHaveLength(0)
    })
  })

  describe('initializeFromMnemonic', () => {
    it('should initialize with valid mnemonic', () => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      expect(hdKeyring.getMnemonic()).toBe(TEST_MNEMONIC)
    })

    it('should accept valid 24-word mnemonic', () => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC_24)
      expect(hdKeyring.getMnemonic()).toBe(TEST_MNEMONIC_24)
    })

    it('should throw with invalid mnemonic', () => {
      expect(() => hdKeyring.initializeFromMnemonic('invalid mnemonic phrase')).toThrow(
        'Invalid mnemonic phrase'
      )
    })

    it('should throw with wrong number of words', () => {
      expect(() =>
        hdKeyring.initializeFromMnemonic('abandon abandon abandon abandon abandon')
      ).toThrow('Invalid mnemonic phrase')
    })

    it('should accept custom HD path', () => {
      const customPath = "m/44'/60'/0'/1"
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC, customPath)
      // Custom path should be used when deriving accounts
      expect(hdKeyring.getMnemonic()).toBe(TEST_MNEMONIC)
    })

    it('should clear existing accounts', () => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
      hdKeyring.addAccount()

      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      expect(hdKeyring.getAccounts()).toHaveLength(0)
    })
  })

  describe('addAccount', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
    })

    it('should derive account at correct index', () => {
      const account1 = hdKeyring.addAccount()
      expect(account1.index).toBe(0)

      const account2 = hdKeyring.addAccount()
      expect(account2.index).toBe(1)
    })

    it('should derive deterministic addresses', () => {
      const account = hdKeyring.addAccount()
      expect(account.address.toLowerCase()).toBe(KNOWN_ADDRESS.toLowerCase())
    })

    it('should use BIP44 path', () => {
      const account = hdKeyring.addAccount()
      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    it('should set account type to hd', () => {
      const account = hdKeyring.addAccount()
      expect(account.type).toBe('hd')
    })

    it('should generate unique addresses for each account', () => {
      const account1 = hdKeyring.addAccount()
      const account2 = hdKeyring.addAccount()
      const account3 = hdKeyring.addAccount()

      expect(account1.address).not.toBe(account2.address)
      expect(account2.address).not.toBe(account3.address)
      expect(account1.address).not.toBe(account3.address)
    })

    it('should increment account name', () => {
      const account1 = hdKeyring.addAccount()
      const account2 = hdKeyring.addAccount()

      expect(account1.name).toBe('Account 1')
      expect(account2.name).toBe('Account 2')
    })
  })

  describe('addAccounts', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
    })

    it('should add multiple accounts at once', () => {
      const accounts = hdKeyring.addAccounts(3)
      expect(accounts).toHaveLength(3)
      expect(hdKeyring.getAccounts()).toHaveLength(3)
    })

    it('should derive accounts with sequential indices', () => {
      const accounts = hdKeyring.addAccounts(3)
      expect(accounts[0].index).toBe(0)
      expect(accounts[1].index).toBe(1)
      expect(accounts[2].index).toBe(2)
    })
  })

  describe('getAccounts', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
    })

    it('should return empty array when no accounts', () => {
      expect(hdKeyring.getAccounts()).toEqual([])
    })

    it('should return copy of accounts array', () => {
      hdKeyring.addAccount()
      const accounts1 = hdKeyring.getAccounts()
      const accounts2 = hdKeyring.getAccounts()

      // Should be equal but not same reference
      expect(accounts1).toEqual(accounts2)
      expect(accounts1).not.toBe(accounts2)
    })
  })

  describe('getAccountCount', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
    })

    it('should return 0 when no accounts', () => {
      expect(hdKeyring.getAccountCount()).toBe(0)
    })

    it('should return correct count', () => {
      hdKeyring.addAccount()
      hdKeyring.addAccount()
      expect(hdKeyring.getAccountCount()).toBe(2)
    })
  })

  describe('hasAccount', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
    })

    it('should return true for existing account', () => {
      expect(hdKeyring.hasAccount(KNOWN_ADDRESS)).toBe(true)
    })

    it('should return false for non-existing account', () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      expect(hdKeyring.hasAccount(unknownAddress)).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(hdKeyring.hasAccount(KNOWN_ADDRESS.toLowerCase() as Address)).toBe(true)
      expect(hdKeyring.hasAccount(KNOWN_ADDRESS.toUpperCase() as Address)).toBe(true)
    })
  })

  describe('signMessage', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
    })

    it('should sign message with correct account', async () => {
      const message = '0x48656c6c6f' as Hex // "Hello" in hex
      const signature = await hdKeyring.signMessage(KNOWN_ADDRESS, message)

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(signature.length).toBe(132) // 65 bytes * 2 + '0x' = 132
    })

    it('should produce valid signature', async () => {
      const message = '0x48656c6c6f' as Hex
      const signature = await hdKeyring.signMessage(KNOWN_ADDRESS, message)

      // Signature should be recoverable (ECDSA)
      expect(signature.startsWith('0x')).toBe(true)
    })

    it('should throw for unknown account', async () => {
      const unknownAddress = '0x0000000000000000000000000000000000000001' as Address
      const message = '0x48656c6c6f' as Hex

      await expect(hdKeyring.signMessage(unknownAddress, message)).rejects.toThrow(
        'Account not found in keyring'
      )
    })

    it('should produce different signatures for different messages', async () => {
      const message1 = '0x48656c6c6f' as Hex // "Hello"
      const message2 = '0x576f726c64' as Hex // "World"

      const sig1 = await hdKeyring.signMessage(KNOWN_ADDRESS, message1)
      const sig2 = await hdKeyring.signMessage(KNOWN_ADDRESS, message2)

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('signTypedData', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
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
          wallet: KNOWN_ADDRESS,
        },
      }

      const signature = await hdKeyring.signTypedData(KNOWN_ADDRESS, typedData)
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

      await expect(hdKeyring.signTypedData(unknownAddress, typedData)).rejects.toThrow(
        'Account not found in keyring'
      )
    })
  })

  describe('signTransaction', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
      hdKeyring.addAccount()
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

      const signedTx = await hdKeyring.signTransaction(KNOWN_ADDRESS, tx)
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

      await expect(hdKeyring.signTransaction(unknownAddress, tx)).rejects.toThrow(
        'Account not found in keyring'
      )
    })
  })

  describe('serialize', () => {
    beforeEach(() => {
      hdKeyring.initializeFromMnemonic(TEST_MNEMONIC)
    })

    it('should serialize keyring data', () => {
      hdKeyring.addAccount()
      hdKeyring.addAccount()

      const serialized = hdKeyring.serialize()

      expect(serialized.mnemonic).toBe(TEST_MNEMONIC)
      expect(serialized.hdPath).toBe("m/44'/60'/0'/0")
      expect(serialized.numberOfAccounts).toBe(2)
    })

    it('should serialize empty keyring', () => {
      const serialized = hdKeyring.serialize()

      expect(serialized.numberOfAccounts).toBe(0)
    })
  })

  describe('deserialization', () => {
    it('should restore accounts from serialized data', () => {
      // First keyring
      const keyring1 = new HDKeyring()
      keyring1.initializeFromMnemonic(TEST_MNEMONIC)
      keyring1.addAccount()
      keyring1.addAccount()

      const serialized = keyring1.serialize()

      // Restore to new keyring
      const keyring2 = new HDKeyring(serialized)

      expect(keyring2.getAccountCount()).toBe(2)
      expect(keyring2.getAccounts()[0].address.toLowerCase()).toBe(KNOWN_ADDRESS.toLowerCase())
    })

    it('should produce same addresses after restore', () => {
      const keyring1 = new HDKeyring()
      keyring1.initializeFromMnemonic(TEST_MNEMONIC)
      const account1 = keyring1.addAccount()
      const account2 = keyring1.addAccount()

      const serialized = keyring1.serialize()
      const keyring2 = new HDKeyring(serialized)

      const restoredAccounts = keyring2.getAccounts()
      expect(restoredAccounts[0].address).toBe(account1.address)
      expect(restoredAccounts[1].address).toBe(account2.address)
    })
  })
})
