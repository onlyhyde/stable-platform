import type { Address, Hex } from 'viem'
import { HDKeyring } from './hdKeyring'
import { SimpleKeyring } from './simpleKeyring'
import { vault } from './vault'
import type {
  KeyringAccount,
  KeyringControllerState,
  SerializedKeyring,
  KeyringType,
} from '../../types'

/**
 * Keyring Controller
 * Orchestrates multiple keyrings (HD and Simple) and manages
 * the encrypted vault for secure key storage
 */

type KeyringEventType = 'lock' | 'unlock' | 'accountsChanged' | 'selectedChanged'
type KeyringListener = (event: KeyringEventType, data?: unknown) => void

export class KeyringController {
  private hdKeyrings: HDKeyring[] = []
  private simpleKeyrings: SimpleKeyring[] = []
  private selectedAddress: Address | null = null
  private listeners: Set<KeyringListener> = new Set()

  /**
   * Initialize the keyring controller
   */
  async initialize(): Promise<void> {
    // Check if vault is initialized but locked
    if (await vault.isInitialized()) {
      // Vault exists, waiting for unlock
      return
    }
  }

  /**
   * Get current state
   */
  getState(): KeyringControllerState {
    return {
      isUnlocked: vault.isUnlocked(),
      isInitialized: false, // Will be set async
      accounts: this.getAllAccounts(),
      selectedAddress: this.selectedAddress,
    }
  }

  /**
   * Get async state (includes initialization check)
   */
  async getAsyncState(): Promise<KeyringControllerState> {
    return {
      isUnlocked: vault.isUnlocked(),
      isInitialized: await vault.isInitialized(),
      accounts: this.getAllAccounts(),
      selectedAddress: this.selectedAddress,
    }
  }

  /**
   * Check if initialized
   */
  async isInitialized(): Promise<boolean> {
    return vault.isInitialized()
  }

  /**
   * Check if unlocked
   */
  isUnlocked(): boolean {
    return vault.isUnlocked()
  }

  /**
   * Create a new wallet with a mnemonic
   */
  async createNewVault(password: string): Promise<{ mnemonic: string; account: KeyringAccount }> {
    const hdKeyring = new HDKeyring()
    const mnemonic = hdKeyring.initializeNewMnemonic(12)
    const account = hdKeyring.addAccount()

    this.hdKeyrings = [hdKeyring]
    this.simpleKeyrings = []
    this.selectedAddress = account.address

    const keyrings: SerializedKeyring[] = [
      { type: 'hd', data: hdKeyring.serialize() },
    ]

    await vault.initialize(password, keyrings)

    this.emit('unlock')
    this.emit('accountsChanged', this.getAllAccounts())
    this.emit('selectedChanged', this.selectedAddress)

    return { mnemonic, account }
  }

  /**
   * Restore wallet from mnemonic
   */
  async restoreFromMnemonic(
    password: string,
    mnemonic: string
  ): Promise<KeyringAccount> {
    const hdKeyring = new HDKeyring()
    hdKeyring.initializeFromMnemonic(mnemonic)
    const account = hdKeyring.addAccount()

    this.hdKeyrings = [hdKeyring]
    this.simpleKeyrings = []
    this.selectedAddress = account.address

    const keyrings: SerializedKeyring[] = [
      { type: 'hd', data: hdKeyring.serialize() },
    ]

    // Clear any existing vault and create new one
    await vault.clear()
    await vault.initialize(password, keyrings)

    this.emit('unlock')
    this.emit('accountsChanged', this.getAllAccounts())
    this.emit('selectedChanged', this.selectedAddress)

    return account
  }

  /**
   * Unlock the vault
   */
  async unlock(password: string): Promise<void> {
    const data = await vault.unlock(password)

    // Reconstruct keyrings from vault data
    this.hdKeyrings = []
    this.simpleKeyrings = []

    for (const serialized of data.keyrings) {
      if (serialized.type === 'hd') {
        this.hdKeyrings.push(new HDKeyring(serialized.data as typeof serialized.data & { mnemonic: string }))
      } else if (serialized.type === 'simple') {
        this.simpleKeyrings.push(new SimpleKeyring(serialized.data as typeof serialized.data & { privateKeys: Hex[] }))
      }
    }

    // Restore selected address or set default
    this.selectedAddress = data.selectedAddress ?? this.getAllAccounts()[0]?.address ?? null

    this.emit('unlock')
    this.emit('accountsChanged', this.getAllAccounts())
    this.emit('selectedChanged', this.selectedAddress)
  }

  /**
   * Lock the vault
   */
  lock(): void {
    vault.lock()
    this.hdKeyrings = []
    this.simpleKeyrings = []
    // Keep selectedAddress to restore on unlock

    this.emit('lock')
  }

  /**
   * Get all accounts from all keyrings
   */
  getAllAccounts(): KeyringAccount[] {
    const accounts: KeyringAccount[] = []

    for (const keyring of this.hdKeyrings) {
      accounts.push(...keyring.getAccounts())
    }

    for (const keyring of this.simpleKeyrings) {
      accounts.push(...keyring.getAccounts())
    }

    return accounts
  }

  /**
   * Get selected address
   */
  getSelectedAddress(): Address | null {
    return this.selectedAddress
  }

  /**
   * Set selected address
   */
  async setSelectedAddress(address: Address): Promise<void> {
    const accounts = this.getAllAccounts()
    const exists = accounts.some(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    )

    if (!exists) {
      throw new Error('Address not found in keyrings')
    }

    this.selectedAddress = address

    // Save to vault
    if (vault.isUnlocked()) {
      await vault.updateData({ selectedAddress: address })
    }

    this.emit('selectedChanged', this.selectedAddress)
  }

  /**
   * Add a new HD account
   */
  async addHDAccount(): Promise<KeyringAccount> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    if (this.hdKeyrings.length === 0) {
      throw new Error('No HD keyring found')
    }

    const hdKeyring = this.hdKeyrings[0]
    const account = hdKeyring.addAccount()

    // Update vault
    const data = vault.getData()
    const keyrings = data.keyrings.map((k, i) => {
      if (k.type === 'hd' && i === 0) {
        return { type: 'hd' as KeyringType, data: hdKeyring.serialize() }
      }
      return k
    })

    await vault.updateData({ keyrings })

    this.emit('accountsChanged', this.getAllAccounts())

    return account
  }

  /**
   * Import an account from private key
   */
  async importPrivateKey(privateKey: Hex): Promise<KeyringAccount> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Check if account already exists
    const existingAccounts = this.getAllAccounts()
    const tempKeyring = new SimpleKeyring()
    const tempAccount = tempKeyring.importAccount(privateKey)

    const exists = existingAccounts.some(
      (a) => a.address.toLowerCase() === tempAccount.address.toLowerCase()
    )

    if (exists) {
      throw new Error('Account already exists')
    }

    // Add to existing simple keyring or create new one
    let simpleKeyring: SimpleKeyring
    if (this.simpleKeyrings.length > 0) {
      simpleKeyring = this.simpleKeyrings[0]
    } else {
      simpleKeyring = new SimpleKeyring()
      this.simpleKeyrings.push(simpleKeyring)
    }

    const account = simpleKeyring.importAccount(privateKey)

    // Update vault
    const data = vault.getData()
    const keyrings = [...data.keyrings]

    // Find and update simple keyring or add new one
    const simpleIndex = keyrings.findIndex((k) => k.type === 'simple')
    if (simpleIndex >= 0) {
      keyrings[simpleIndex] = { type: 'simple', data: simpleKeyring.serialize() }
    } else {
      keyrings.push({ type: 'simple', data: simpleKeyring.serialize() })
    }

    await vault.updateData({ keyrings })

    this.emit('accountsChanged', this.getAllAccounts())

    return account
  }

  /**
   * Remove an imported account
   */
  async removeAccount(address: Address): Promise<void> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Can only remove simple keyring accounts
    let found = false
    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        keyring.removeAccount(address)
        found = true
        break
      }
    }

    if (!found) {
      throw new Error('Cannot remove HD accounts or account not found')
    }

    // Update vault
    const data = vault.getData()
    const keyrings = data.keyrings.map((k) => {
      if (k.type === 'simple') {
        const keyring = this.simpleKeyrings[0]
        return { type: 'simple' as KeyringType, data: keyring.serialize() }
      }
      return k
    })

    await vault.updateData({ keyrings })

    // Update selected address if removed
    if (this.selectedAddress?.toLowerCase() === address.toLowerCase()) {
      const accounts = this.getAllAccounts()
      this.selectedAddress = accounts[0]?.address ?? null
      await vault.updateData({ selectedAddress: this.selectedAddress ?? undefined })
      this.emit('selectedChanged', this.selectedAddress)
    }

    this.emit('accountsChanged', this.getAllAccounts())
  }

  /**
   * Sign a message
   */
  async signMessage(address: Address, message: Hex): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Find keyring with this address
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signMessage(address, message)
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signMessage(address, message)
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Sign typed data
   */
  async signTypedData(address: Address, typedData: unknown): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Find keyring with this address
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTypedData(address, typedData as Parameters<typeof keyring.signTypedData>[1])
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTypedData(address, typedData as Parameters<typeof keyring.signTypedData>[1])
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Sign a transaction
   */
  async signTransaction(
    address: Address,
    transaction: unknown
  ): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Find keyring with this address
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTransaction(address, transaction as Parameters<typeof keyring.signTransaction>[1])
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTransaction(address, transaction as Parameters<typeof keyring.signTransaction>[1])
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Get mnemonic (for backup)
   */
  getMnemonic(): string | null {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    if (this.hdKeyrings.length === 0) {
      return null
    }

    return this.hdKeyrings[0].getMnemonic()
  }

  /**
   * Export private key
   */
  exportPrivateKey(address: Address): Hex {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.exportPrivateKey(address)
      }
    }

    throw new Error('Can only export private keys from imported accounts')
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await vault.changePassword(oldPassword, newPassword)
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: KeyringListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Emit event
   */
  private emit(event: KeyringEventType, data?: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data)
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// Singleton instance
export const keyringController = new KeyringController()
