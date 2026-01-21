import { encrypt, decrypt, bufferToHex, getRandomBytes } from './crypto'
import type { EncryptedVault, VaultData, SerializedKeyring } from '../../types'
import { STORAGE_KEYS } from '../../shared/constants'

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
  private readonly autoLockDelay: number

  constructor(autoLockMinutes: number = 15) {
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
   */
  isUnlocked(): boolean {
    return this.cachedPassword !== null && this.cachedData !== null
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
    this.resetAutoLock()
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
      this.resetAutoLock()

      return data
    } catch (error) {
      throw new Error('Incorrect password')
    }
  }

  /**
   * Lock the vault
   */
  lock(): void {
    this.cachedPassword = null
    this.cachedData = null
    this.clearAutoLock()
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
   */
  async updateData(data: Partial<VaultData>): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    this.cachedData = { ...this.cachedData!, ...data }
    await this.saveVault(this.cachedData, this.cachedPassword!)
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
  }

  /**
   * Clear all vault data (factory reset)
   */
  async clear(): Promise<void> {
    this.lock()
    await chrome.storage.local.remove(STORAGE_KEYS.ENCRYPTED_VAULT)
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
    this.resetAutoLock()
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
    return stored[STORAGE_KEYS.ENCRYPTED_VAULT] ?? null
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
