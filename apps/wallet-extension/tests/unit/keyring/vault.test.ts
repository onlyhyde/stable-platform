/**
 * Vault Tests
 * TDD tests for the Vault class that manages encrypted storage
 */

import {
  decryptSessionData,
  type EncryptedSessionData,
  isEncryptedSessionData,
} from '../../../src/background/keyring/sessionCrypto'
import { Vault } from '../../../src/background/keyring/vault'
import { SESSION_KEYS, STORAGE_KEYS } from '../../../src/shared/constants'
import type { SerializedKeyring, VaultData, VaultSessionData } from '../../../src/types'
import { mockChrome } from '../../utils/mockChrome'
import { TEST_PASSWORD } from '../../utils/testUtils'

/**
 * Helper to get vault salt from local storage for test decryption
 */
async function getVaultSalt(): Promise<Uint8Array | null> {
  const stored = await mockChrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_VAULT)
  const vault = stored[STORAGE_KEYS.ENCRYPTED_VAULT]
  if (!vault || !vault.salt) return null

  const hex = vault.salt
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// Test keyring data
const createTestKeyring = (): SerializedKeyring => ({
  type: 'hd',
  data: {
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    hdPath: "m/44'/60'/0'/0",
    accounts: [{ index: 0 }],
  },
})

describe('Vault', () => {
  let vault: Vault

  beforeEach(() => {
    // Create fresh vault instance for each test
    vault = new Vault(15) // 15 minutes auto-lock
  })

  describe('isInitialized', () => {
    it('should return false when no vault exists', async () => {
      const initialized = await vault.isInitialized()
      expect(initialized).toBe(false)
    })

    it('should return true after vault is initialized', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      const initialized = await vault.isInitialized()
      expect(initialized).toBe(true)
    })
  })

  describe('isUnlocked', () => {
    it('should return false when vault is not initialized', () => {
      expect(vault.isUnlocked()).toBe(false)
    })

    it('should return true after vault is unlocked', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      expect(vault.isUnlocked()).toBe(true)
    })

    it('should return false after vault is locked', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      vault.lock()
      expect(vault.isUnlocked()).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should create new vault with password', async () => {
      const keyrings = [createTestKeyring()]

      await vault.initialize(TEST_PASSWORD, keyrings)

      expect(vault.isUnlocked()).toBe(true)
      const data = vault.getData()
      expect(data.keyrings).toHaveLength(1)
      expect(data.keyrings[0].type).toBe('hd')
    })

    it('should throw if vault already initialized', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      await expect(vault.initialize(TEST_PASSWORD, [])).rejects.toThrow(
        'Vault is already initialized'
      )
    })

    it('should save encrypted vault to local storage', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      const stored = await mockChrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_VAULT)
      const encryptedVault = stored[STORAGE_KEYS.ENCRYPTED_VAULT]

      expect(encryptedVault).toBeDefined()
      expect(encryptedVault.version).toBe(1)
      expect(encryptedVault.cipher).toBe('aes-256-gcm')
      expect(encryptedVault.ciphertext).toBeDefined()
      expect(encryptedVault.iv).toBeDefined()
      expect(encryptedVault.salt).toBeDefined()
      expect(encryptedVault.tag).toBeDefined()
    })

    it('should save to session storage without password (SEC-6: encrypted)', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedSession = stored[SESSION_KEYS.VAULT_SESSION]

      // SEC-6: Session data should be encrypted
      expect(encryptedSession).toBeDefined()
      expect(isEncryptedSessionData(encryptedSession)).toBe(true)

      // Decrypt to verify contents
      const salt = await getVaultSalt()
      expect(salt).not.toBeNull()
      const sessionData = await decryptSessionData<VaultSessionData>(
        encryptedSession as EncryptedSessionData,
        salt!
      )

      expect(sessionData.vaultData).toBeDefined()
      // SECURITY: Password should NOT be stored in session
      expect((sessionData as Record<string, unknown>).password).toBeUndefined()
      expect(sessionData.createdAt).toBeDefined()
      expect(sessionData.autoLockMinutes).toBe(15)
    })

    it('should initialize with empty keyrings array', async () => {
      await vault.initialize(TEST_PASSWORD, [])

      const data = vault.getData()
      expect(data.keyrings).toHaveLength(0)
    })
  })

  describe('unlock', () => {
    beforeEach(async () => {
      // Initialize vault before each unlock test
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      vault.lock()
    })

    it('should decrypt vault with correct password', async () => {
      const data = await vault.unlock(TEST_PASSWORD)

      expect(vault.isUnlocked()).toBe(true)
      expect(data.keyrings).toHaveLength(1)
      expect(data.keyrings[0].type).toBe('hd')
    })

    it('should throw with incorrect password', async () => {
      await expect(vault.unlock('wrong-password')).rejects.toThrow('Incorrect password')
      expect(vault.isUnlocked()).toBe(false)
    })

    it('should throw when vault is not initialized', async () => {
      // Clear storage to ensure no vault exists
      await mockChrome.storage.local.clear()
      await mockChrome.storage.session.clear()

      // Create new vault without initialization
      const newVault = new Vault()
      await expect(newVault.unlock(TEST_PASSWORD)).rejects.toThrow('Vault is not initialized')
    })

    it('should save to session storage after unlock without password (SEC-6: encrypted)', async () => {
      // Clear session storage first
      await mockChrome.storage.session.clear()

      await vault.unlock(TEST_PASSWORD)

      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedSession = stored[SESSION_KEYS.VAULT_SESSION]

      // SEC-6: Session data should be encrypted
      expect(encryptedSession).toBeDefined()
      expect(isEncryptedSessionData(encryptedSession)).toBe(true)

      // Decrypt to verify contents
      const salt = await getVaultSalt()
      expect(salt).not.toBeNull()
      const sessionData = await decryptSessionData<VaultSessionData>(
        encryptedSession as EncryptedSessionData,
        salt!
      )

      expect(sessionData.vaultData).toBeDefined()
      // SECURITY: Password should NOT be stored in session
      expect((sessionData as Record<string, unknown>).password).toBeUndefined()
    })

    it('should restore selected address if present', async () => {
      // Initialize with selected address
      await mockChrome.storage.local.clear()
      const vaultWithAddress = new Vault()
      await vaultWithAddress.initialize(TEST_PASSWORD, [createTestKeyring()])
      await vaultWithAddress.updateData({
        selectedAddress: '0x1234567890123456789012345678901234567890',
      })
      vaultWithAddress.lock()

      const data = await vaultWithAddress.unlock(TEST_PASSWORD)
      expect(data.selectedAddress).toBe('0x1234567890123456789012345678901234567890')
    })
  })

  describe('lock', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
    })

    it('should clear cached data', () => {
      vault.lock()

      expect(vault.isUnlocked()).toBe(false)
      expect(() => vault.getData()).toThrow('Vault is locked')
    })

    it('should clear session storage', async () => {
      vault.lock()

      // Wait a bit for async clear
      await new Promise((resolve) => setTimeout(resolve, 50))

      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      expect(stored[SESSION_KEYS.VAULT_SESSION]).toBeUndefined()
    })

    it('should not affect encrypted vault in local storage', async () => {
      vault.lock()

      const stored = await mockChrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_VAULT)
      expect(stored[STORAGE_KEYS.ENCRYPTED_VAULT]).toBeDefined()
    })
  })

  describe('getData', () => {
    it('should return vault data when unlocked', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      const data = vault.getData()

      expect(data).toBeDefined()
      expect(data.keyrings).toBeDefined()
    })

    it('should throw when vault is locked', () => {
      expect(() => vault.getData()).toThrow('Vault is locked')
    })
  })

  describe('updateData', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
    })

    it('should persist changes to storage', async () => {
      const newKeyring = createTestKeyring()
      newKeyring.data = { ...newKeyring.data, accounts: [{ index: 0 }, { index: 1 }] }

      await vault.updateData({ keyrings: [newKeyring] })

      // Verify by unlocking after lock
      vault.lock()
      const data = await vault.unlock(TEST_PASSWORD)
      expect(data.keyrings[0].data.accounts).toHaveLength(2)
    })

    it('should update session storage (SEC-6: encrypted)', async () => {
      await vault.updateData({
        selectedAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      })

      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedSession = stored[SESSION_KEYS.VAULT_SESSION]

      // SEC-6: Session data should be encrypted
      expect(isEncryptedSessionData(encryptedSession)).toBe(true)

      // Decrypt to verify contents
      const salt = await getVaultSalt()
      expect(salt).not.toBeNull()
      const sessionData = await decryptSessionData<VaultSessionData>(
        encryptedSession as EncryptedSessionData,
        salt!
      )

      expect(sessionData.vaultData.selectedAddress).toBe(
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      )
    })

    it('should throw if vault locked', async () => {
      vault.lock()

      await expect(vault.updateData({ keyrings: [] })).rejects.toThrow('Vault is locked')
    })

    it('should merge updates with existing data', async () => {
      await vault.updateData({ selectedAddress: '0x1234567890123456789012345678901234567890' })

      const data = vault.getData()
      expect(data.keyrings).toHaveLength(1) // Original keyrings preserved
      expect(data.selectedAddress).toBe('0x1234567890123456789012345678901234567890')
    })
  })

  describe('tryRestoreFromSession', () => {
    it('should restore vault state from session storage', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      // Create new vault instance (simulating service worker restart)
      const newVault = new Vault()
      const restored = await newVault.tryRestoreFromSession()

      expect(restored).not.toBeNull()
      expect(newVault.isUnlocked()).toBe(true)
      expect(restored?.keyrings).toHaveLength(1)
    })

    it('should return null when no session data exists', async () => {
      const newVault = new Vault()
      const restored = await newVault.tryRestoreFromSession()

      expect(restored).toBeNull()
      expect(newVault.isUnlocked()).toBe(false)
    })

    it('should return null when session has expired (SEC-6: encrypted)', async () => {
      // Initialize with 0.001 minute auto-lock (effectively immediate)
      const shortLockVault = new Vault(0.001)
      await shortLockVault.initialize(TEST_PASSWORD, [createTestKeyring()])

      // Get the salt for encrypting modified session data
      const salt = await getVaultSalt()
      expect(salt).not.toBeNull()

      // Get and decrypt current session data
      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedSession = stored[SESSION_KEYS.VAULT_SESSION] as EncryptedSessionData
      const sessionData = await decryptSessionData<VaultSessionData>(encryptedSession, salt!)

      // Modify to have old timestamp
      sessionData.createdAt = Date.now() - 1000000 // Old timestamp

      // Re-encrypt and save (SEC-6 compliant)
      const { encryptSessionData } = await import('../../../src/background/keyring/sessionCrypto')
      const newEncryptedSession = await encryptSessionData(sessionData, salt!)
      await mockChrome.storage.session.set({ [SESSION_KEYS.VAULT_SESSION]: newEncryptedSession })

      // Try restore with new vault
      const newVault = new Vault(0.001)
      const restored = await newVault.tryRestoreFromSession()

      expect(restored).toBeNull()
    })

    it('should not expire session when autoLockMinutes is 0 (SEC-6: encrypted)', async () => {
      // Initialize with 0 auto-lock (disabled)
      const noLockVault = new Vault(0)
      await noLockVault.initialize(TEST_PASSWORD, [createTestKeyring()])

      // Get the salt for encrypting modified session data
      const salt = await getVaultSalt()
      expect(salt).not.toBeNull()

      // Get and decrypt current session data
      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedSession = stored[SESSION_KEYS.VAULT_SESSION] as EncryptedSessionData
      const sessionData = await decryptSessionData<VaultSessionData>(encryptedSession, salt!)

      // Modify to have very old timestamp
      sessionData.createdAt = Date.now() - 100000000 // Very old timestamp
      sessionData.autoLockMinutes = 0

      // Re-encrypt and save (SEC-6 compliant)
      const { encryptSessionData } = await import('../../../src/background/keyring/sessionCrypto')
      const newEncryptedSession = await encryptSessionData(sessionData, salt!)
      await mockChrome.storage.session.set({ [SESSION_KEYS.VAULT_SESSION]: newEncryptedSession })

      // Try restore
      const newVault = new Vault(0)
      const restored = await newVault.tryRestoreFromSession()

      expect(restored).not.toBeNull()
    })

    it('should restore as read-only (no password)', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      // Create new vault instance (simulating service worker restart)
      const newVault = new Vault()
      await newVault.tryRestoreFromSession()

      // Should be unlocked but session-restored
      expect(newVault.isUnlocked()).toBe(true)
      expect(newVault.isRestoredFromSession()).toBe(true)

      // Read should work
      const data = newVault.getData()
      expect(data.keyrings).toHaveLength(1)

      // Write should fail (no password available)
      await expect(newVault.updateData({ keyrings: [] })).rejects.toThrow(
        'Re-authentication required'
      )
    })

    it('should enable writes after reauthenticate', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      // Create new vault instance and restore
      const newVault = new Vault()
      await newVault.tryRestoreFromSession()

      // Re-authenticate with correct password
      await newVault.reauthenticate(TEST_PASSWORD)
      expect(newVault.isRestoredFromSession()).toBe(false)

      // Write should now work
      await expect(newVault.updateData({ keyrings: [] })).resolves.not.toThrow()
    })

    it('should reject reauthenticate with wrong password', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])

      const newVault = new Vault()
      await newVault.tryRestoreFromSession()

      await expect(newVault.reauthenticate('wrong-password')).rejects.toThrow('Incorrect password')
    })
  })

  describe('changePassword', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      vault.lock()
    })

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword456!'

      await vault.changePassword(TEST_PASSWORD, newPassword)

      // Lock and try to unlock with new password
      vault.lock()
      const data = await vault.unlock(newPassword)
      expect(data.keyrings).toHaveLength(1)
    })

    it('should fail with incorrect old password', async () => {
      await expect(vault.changePassword('wrong-password', 'new-password')).rejects.toThrow(
        'Incorrect password'
      )
    })

    it('should not be able to unlock with old password after change', async () => {
      const newPassword = 'NewPassword456!'
      await vault.changePassword(TEST_PASSWORD, newPassword)
      vault.lock()

      await expect(vault.unlock(TEST_PASSWORD)).rejects.toThrow('Incorrect password')
    })
  })

  describe('clear', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
    })

    it('should clear all vault data', async () => {
      await vault.clear()

      const initialized = await vault.isInitialized()
      expect(initialized).toBe(false)
      expect(vault.isUnlocked()).toBe(false)
    })

    it('should clear local storage', async () => {
      await vault.clear()

      const stored = await mockChrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_VAULT)
      expect(stored[STORAGE_KEYS.ENCRYPTED_VAULT]).toBeUndefined()
    })

    it('should clear session storage', async () => {
      await vault.clear()

      const stored = await mockChrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      expect(stored[SESSION_KEYS.VAULT_SESSION]).toBeUndefined()
    })
  })

  describe('addKeyring', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [])
    })

    it('should add keyring to vault', async () => {
      const keyring = createTestKeyring()
      await vault.addKeyring(keyring)

      const data = vault.getData()
      expect(data.keyrings).toHaveLength(1)
    })

    it('should persist added keyring', async () => {
      const keyring = createTestKeyring()
      await vault.addKeyring(keyring)

      vault.lock()
      const data = await vault.unlock(TEST_PASSWORD)
      expect(data.keyrings).toHaveLength(1)
    })
  })

  describe('removeKeyring', () => {
    beforeEach(async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring(), createTestKeyring()])
    })

    it('should remove keyring at index', async () => {
      await vault.removeKeyring(0)

      const data = vault.getData()
      expect(data.keyrings).toHaveLength(1)
    })

    it('should persist removal', async () => {
      await vault.removeKeyring(0)

      vault.lock()
      const data = await vault.unlock(TEST_PASSWORD)
      expect(data.keyrings).toHaveLength(1)
    })
  })

  describe('export and import', () => {
    it('should export vault data', async () => {
      await vault.initialize(TEST_PASSWORD, [createTestKeyring()])
      vault.lock()

      const exported = await vault.export(TEST_PASSWORD)
      const parsed = JSON.parse(exported) as VaultData

      expect(parsed.keyrings).toHaveLength(1)
    })

    it('should import vault data', async () => {
      const exportedData: VaultData = {
        keyrings: [createTestKeyring()],
        selectedAddress: '0x1234567890123456789012345678901234567890',
      }

      await vault.import(JSON.stringify(exportedData), TEST_PASSWORD)

      expect(vault.isUnlocked()).toBe(true)
      const data = vault.getData()
      expect(data.keyrings).toHaveLength(1)
      expect(data.selectedAddress).toBe('0x1234567890123456789012345678901234567890')
    })
  })
})
