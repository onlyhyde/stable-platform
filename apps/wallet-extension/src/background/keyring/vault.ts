import { SESSION_KEYS, STORAGE_KEYS } from '../../shared/constants'
import { clearString } from '../../shared/security/memorySanitizer'
import { createLogger } from '../../shared/utils/logger'
import type { EncryptedVault, SerializedKeyring, VaultData, VaultSessionData } from '../../types'
import { decrypt, encrypt } from './crypto'
import { decryptSessionData, encryptSessionData, isEncryptedSessionData } from './sessionCrypto'

const logger = createLogger('Vault')

/**
 * Vault for secure storage of encrypted keyring data
 * Uses AES-256-GCM encryption with PBKDF2 key derivation
 */

const VAULT_VERSION = 1

/**
 * Vault class for managing encrypted storage
 */
export class Vault {
  private cachedPassword: string | null = null
  private cachedData: VaultData | null = null
  private lockTimeout: ReturnType<typeof setTimeout> | null = null
  private autoLockDelay: number
  private autoLockMinutes: number
  /** Flag indicating if restored from session (password not available) */
  private isSessionRestored = false

  constructor(autoLockMinutes = 15) {
    this.autoLockMinutes = autoLockMinutes
    this.autoLockDelay = autoLockMinutes * 60 * 1000
  }

  /**
   * Check if vault is initialized (has stored data)
   */
  async isInitialized(): Promise<boolean> {
    const stored = await this.getStoredVault()
    return stored !== null
  }

  /**
   * Check if vault is currently unlocked
   * Vault is unlocked if data is available (either with password or session-restored)
   */
  isUnlocked(): boolean {
    return this.cachedData !== null
  }

  /**
   * Check if vault has full write access (password available)
   */
  hasWriteAccess(): boolean {
    return this.cachedData !== null && this.cachedPassword !== null
  }

  /**
   * Initialize a new vault with a password
   */
  async initialize(password: string, keyrings: SerializedKeyring[] = []): Promise<void> {
    if (await this.isInitialized()) {
      throw new Error('Vault is already initialized')
    }

    const data: VaultData = {
      keyrings,
    }

    await this.saveVault(data, password)
    this.cachedPassword = password
    this.cachedData = data
    this.isSessionRestored = false
    this.resetAutoLock()

    // Save to session storage for service worker persistence
    await this.saveToSession(data)
  }

  /**
   * Unlock the vault with a password
   */
  async unlock(password: string): Promise<VaultData> {
    const stored = await this.getStoredVault()
    if (!stored) {
      throw new Error('Vault is not initialized')
    }

    try {
      const decrypted = await decrypt(
        {
          ciphertext: stored.ciphertext,
          iv: stored.iv,
          salt: stored.salt,
          tag: stored.tag,
        },
        password
      )

      const data = JSON.parse(decrypted) as VaultData

      this.cachedPassword = password
      this.cachedData = data
      this.isSessionRestored = false
      this.resetAutoLock()

      // Save to session storage for service worker persistence
      await this.saveToSession(data)

      return data
    } catch (_error) {
      throw new Error('Incorrect password')
    }
  }

  /**
   * Lock the vault
   */
  lock(): void {
    // Sanitize sensitive data before releasing references
    if (this.cachedPassword) {
      this.cachedPassword = clearString(this.cachedPassword)
    }
    this.cachedPassword = null

    // Clear cached keyring data which may contain mnemonics/private keys
    if (this.cachedData?.keyrings) {
      for (const keyring of this.cachedData.keyrings) {
        if ('mnemonic' in keyring && typeof keyring.mnemonic === 'string') {
          ;(keyring as Record<string, unknown>).mnemonic = clearString(keyring.mnemonic as string)
        }
        if ('privateKeys' in keyring && Array.isArray(keyring.privateKeys)) {
          for (let i = 0; i < keyring.privateKeys.length; i++) {
            keyring.privateKeys[i] = clearString(keyring.privateKeys[i] as string)
          }
          keyring.privateKeys.length = 0
        }
      }
    }
    this.cachedData = null

    this.isSessionRestored = false
    this.clearAutoLock()
    // Clear session storage
    this.clearSession().catch(() => {
      // Silent fail for session clear
    })
  }

  /**
   * Get the current vault data (must be unlocked)
   */
  getData(): VaultData {
    if (!this.isUnlocked()) {
      throw new Error('Vault is locked')
    }
    return this.cachedData!
  }

  /**
   * Update the vault data
   * Requires password (not available after session restore - call reauthenticate() first)
   */
  async updateData(data: Partial<VaultData>): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    if (!this.cachedPassword) {
      throw new Error('Re-authentication required. Please enter your password to make changes.')
    }

    this.cachedData = { ...this.cachedData!, ...data }

    // Save to both encrypted vault and session storage
    await this.saveVault(this.cachedData, this.cachedPassword)
    await this.saveToSession(this.cachedData)
    this.resetAutoLock()
  }

  /**
   * Add a keyring to the vault
   */
  async addKeyring(keyring: SerializedKeyring): Promise<void> {
    const data = this.getData()
    const keyrings = [...data.keyrings, keyring]
    await this.updateData({ keyrings })
  }

  /**
   * Remove a keyring from the vault
   */
  async removeKeyring(index: number): Promise<void> {
    const data = this.getData()
    const keyrings = [...data.keyrings]
    keyrings.splice(index, 1)
    await this.updateData({ keyrings })
  }

  /**
   * Update a keyring in the vault
   */
  async updateKeyring(index: number, keyring: SerializedKeyring): Promise<void> {
    const data = this.getData()
    const keyrings = [...data.keyrings]
    keyrings[index] = keyring
    await this.updateData({ keyrings })
  }

  /**
   * Change the vault password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Verify old password
    await this.unlock(oldPassword)

    // Re-encrypt with new password
    await this.saveVault(this.cachedData!, newPassword)
    this.cachedPassword = newPassword

    // Update session with new password
    await this.saveToSession(this.cachedData!)
  }

  /**
   * Clear all vault data (factory reset)
   */
  async clear(): Promise<void> {
    this.lock()
    await chrome.storage.local.remove(STORAGE_KEYS.ENCRYPTED_VAULT)
    await this.clearSession()
  }

  /**
   * Try to restore vault state from session storage
   * Called on service worker restart to maintain unlocked state
   *
   * SECURITY: Password is NOT restored from session.
   * Session-restored vaults are read-only until re-authenticated via reauthenticate().
   * SEC-6: Session data is encrypted and must be decrypted using vault salt.
   *
   * @returns VaultData if session is valid and not expired, null otherwise
   */
  async tryRestoreFromSession(): Promise<VaultData | null> {
    try {
      // Check if chrome.storage.session is available (MV3)
      if (!chrome.storage.session) {
        return null
      }

      const stored = await chrome.storage.session.get(SESSION_KEYS.VAULT_SESSION)
      const encryptedOrLegacy = stored[SESSION_KEYS.VAULT_SESSION]

      if (!encryptedOrLegacy) {
        return null
      }

      // Get vault salt for decryption
      const salt = await this.getVaultSalt()
      if (!salt) {
        logger.warn('Cannot restore from session: vault salt not available')
        return null
      }

      let sessionData: VaultSessionData

      // SEC-6: Check if data is encrypted (new format) or legacy (unencrypted)
      if (isEncryptedSessionData(encryptedOrLegacy)) {
        // Decrypt session data
        try {
          sessionData = await decryptSessionData<VaultSessionData>(encryptedOrLegacy, salt)
        } catch (error) {
          logger.error('Failed to decrypt session data', error)
          await this.clearSession()
          return null
        }
      } else {
        // Legacy unencrypted format - migrate to encrypted
        logger.info('Migrating legacy unencrypted session data')
        sessionData = encryptedOrLegacy as VaultSessionData
        // Re-save with encryption
        if (sessionData.vaultData) {
          await this.saveToSession(sessionData.vaultData)
        }
      }

      if (!sessionData || !sessionData.vaultData) {
        return null
      }

      // Check if session has expired based on auto-lock timeout
      const elapsed = Date.now() - sessionData.createdAt
      const timeoutMs = sessionData.autoLockMinutes * 60 * 1000

      // If auto-lock is disabled (0), session doesn't expire
      if (sessionData.autoLockMinutes > 0 && elapsed > timeoutMs) {
        // Session expired, clear it
        await this.clearSession()
        return null
      }

      // Restore cached data only (NOT password for security)
      this.cachedData = sessionData.vaultData
      this.cachedPassword = null // SECURITY: Password not stored in session
      this.isSessionRestored = true
      this.resetAutoLock()

      return sessionData.vaultData
    } catch (error) {
      logger.error('Session restore failed', error)
      // Session storage access failed
      return null
    }
  }

  /**
   * Re-authenticate to enable write operations after session restore
   * Required for any vault modifications when restored from session
   */
  async reauthenticate(password: string): Promise<void> {
    const stored = await this.getStoredVault()
    if (!stored) {
      throw new Error('Vault is not initialized')
    }

    try {
      // Verify password by attempting to decrypt
      await decrypt(
        {
          ciphertext: stored.ciphertext,
          iv: stored.iv,
          salt: stored.salt,
          tag: stored.tag,
        },
        password
      )

      // Password verified, cache it for write operations
      this.cachedPassword = password
      this.isSessionRestored = false
      this.resetAutoLock()
    } catch {
      throw new Error('Incorrect password')
    }
  }

  /**
   * Check if vault was restored from session (password not available)
   */
  isRestoredFromSession(): boolean {
    return this.isSessionRestored
  }

  /**
   * Save vault data to session storage
   * SECURITY: Password is NOT saved to session storage
   * SEC-6: Session data is encrypted using a key derived from the vault salt
   */
  private async saveToSession(data: VaultData): Promise<void> {
    try {
      // Check if chrome.storage.session is available (MV3)
      if (!chrome.storage.session) {
        return
      }

      // Get vault salt for encryption key derivation
      const salt = await this.getVaultSalt()
      if (!salt) {
        logger.warn('Cannot save to session: vault salt not available')
        return
      }

      // SECURITY: Do NOT store password in session storage
      const sessionData: VaultSessionData = {
        vaultData: data,
        createdAt: Date.now(),
        autoLockMinutes: this.autoLockMinutes,
      }

      // SEC-6: Encrypt session data before storing
      const encryptedSession = await encryptSessionData(sessionData, salt)

      await chrome.storage.session.set({
        [SESSION_KEYS.VAULT_SESSION]: encryptedSession,
      })
    } catch (error) {
      logger.error('Failed to save to session', error)
      // Silent fail for session save
    }
  }

  /**
   * Clear session storage
   */
  private async clearSession(): Promise<void> {
    try {
      if (chrome.storage.session) {
        await chrome.storage.session.remove(SESSION_KEYS.VAULT_SESSION)
      }
    } catch {
      // Silent fail for session clear
    }
  }

  /**
   * Update session timestamp (refresh auto-lock timer)
   */
  async refreshSession(): Promise<void> {
    if (this.isUnlocked() && this.cachedData) {
      await this.saveToSession(this.cachedData)
    }
  }

  /**
   * Export vault data (for backup)
   */
  async export(password: string): Promise<string> {
    const data = await this.unlock(password)
    return JSON.stringify(data)
  }

  /**
   * Import vault data (for restore)
   */
  async import(data: string, password: string): Promise<void> {
    const parsed = JSON.parse(data) as VaultData
    await this.saveVault(parsed, password)
    this.cachedPassword = password
    this.cachedData = parsed
    this.isSessionRestored = false
    this.resetAutoLock()

    // Save to session storage
    await this.saveToSession(parsed)
  }

  /**
   * Save vault to storage
   */
  private async saveVault(data: VaultData, password: string): Promise<void> {
    const encrypted = await encrypt(JSON.stringify(data), password)

    const vault: EncryptedVault = {
      version: VAULT_VERSION,
      cipher: 'aes-256-gcm',
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      iterations: 100000,
      tag: encrypted.tag,
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.ENCRYPTED_VAULT]: vault,
    })
  }

  /**
   * Get stored vault from storage
   */
  private async getStoredVault(): Promise<EncryptedVault | null> {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_VAULT)
    return (stored[STORAGE_KEYS.ENCRYPTED_VAULT] as EncryptedVault | undefined) ?? null
  }

  /**
   * Get vault salt for session encryption
   * SEC-6: The salt is used to derive the session encryption key
   */
  private async getVaultSalt(): Promise<Uint8Array | null> {
    const vault = await this.getStoredVault()
    if (!vault || !vault.salt) {
      return null
    }

    // Convert hex string to Uint8Array
    const hex = vault.salt
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }

  /**
   * Reset auto-lock timer
   */
  private resetAutoLock(): void {
    this.clearAutoLock()
    this.lockTimeout = setTimeout(() => {
      this.lock()
    }, this.autoLockDelay)
  }

  /**
   * Clear auto-lock timer
   */
  private clearAutoLock(): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }
  }
}

// Singleton vault instance
export const vault = new Vault()
