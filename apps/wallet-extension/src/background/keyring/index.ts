import type { Address, Hex } from 'viem'
import type {
  HardwareAccountInfo,
  HardwareKeyringData,
  HDKeyringData,
  KeyringAccount,
  KeyringControllerState,
  KeyringType,
  SerializedKeyring,
  SimpleKeyringData,
  VaultData,
} from '../../types'
import { LedgerKeyring } from './hardwareKeyring'
import { HDKeyring } from './hdKeyring'
import { LedgerWebHIDTransport } from './ledgerTransport'
import { SimpleKeyring } from './simpleKeyring'
import { vault } from './vault'

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
  private hardwareKeyrings: LedgerKeyring[] = []
  private selectedAddress: Address | null = null
  private listeners: Set<KeyringListener> = new Set()

  /**
   * Initialize the keyring controller
   * Attempts to restore state from session storage if available
   */
  async initialize(): Promise<void> {
    // Check if vault is initialized
    if (!(await vault.isInitialized())) {
      // No vault exists yet
      return
    }

    // Try to restore from session storage (service worker restart case)
    const sessionData = await vault.tryRestoreFromSession()
    if (sessionData) {
      // Reconstruct keyrings from session data
      this.reconstructKeyrings(sessionData)
    }
    // If no session data, vault remains locked until user unlocks
  }

  /**
   * Reconstruct keyrings from vault data
   */
  private reconstructKeyrings(data: VaultData): void {
    this.hdKeyrings = []
    this.simpleKeyrings = []
    this.hardwareKeyrings = []

    for (const serialized of data.keyrings) {
      if (serialized.type === 'hd') {
        this.hdKeyrings.push(new HDKeyring(serialized.data as HDKeyringData))
      } else if (serialized.type === 'simple') {
        this.simpleKeyrings.push(new SimpleKeyring(serialized.data as SimpleKeyringData))
      } else if (serialized.type === 'hardware') {
        this.hardwareKeyrings.push(new LedgerKeyring(serialized.data as HardwareKeyringData))
      }
    }

    // Restore selected address or set default
    this.selectedAddress = data.selectedAddress ?? this.getAllAccounts()[0]?.address ?? null

    this.emit('unlock')
    this.emit('accountsChanged', this.getAllAccounts())
    this.emit('selectedChanged', this.selectedAddress)
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

    const keyrings: SerializedKeyring[] = [{ type: 'hd', data: hdKeyring.serialize() }]

    await vault.initialize(password, keyrings)

    this.emit('unlock')
    this.emit('accountsChanged', this.getAllAccounts())
    this.emit('selectedChanged', this.selectedAddress)

    return { mnemonic, account }
  }

  /**
   * Restore wallet from mnemonic
   */
  async restoreFromMnemonic(password: string, mnemonic: string): Promise<KeyringAccount> {
    const hdKeyring = new HDKeyring()
    hdKeyring.initializeFromMnemonic(mnemonic)
    const account = hdKeyring.addAccount()

    this.hdKeyrings = [hdKeyring]
    this.simpleKeyrings = []
    this.selectedAddress = account.address

    const keyrings: SerializedKeyring[] = [{ type: 'hd', data: hdKeyring.serialize() }]

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
    this.reconstructKeyrings(data)
  }

  /**
   * Lock the vault
   */
  lock(): void {
    // Sanitize keyring data from memory before releasing references
    for (const keyring of this.hdKeyrings) {
      keyring.sanitize()
    }
    for (const keyring of this.simpleKeyrings) {
      keyring.sanitize()
    }
    for (const keyring of this.hardwareKeyrings) {
      keyring.sanitize()
    }

    vault.lock()
    this.hdKeyrings = []
    this.simpleKeyrings = []
    this.hardwareKeyrings = []
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

    for (const keyring of this.hardwareKeyrings) {
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
    const exists = accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())

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
    if (!hdKeyring) {
      throw new Error('HD keyring not found')
    }
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
    const existingSimple = this.simpleKeyrings[0]
    if (this.simpleKeyrings.length > 0 && existingSimple) {
      simpleKeyring = existingSimple
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
        if (keyring) {
          return { type: 'simple' as KeyringType, data: keyring.serialize() }
        }
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

    for (const keyring of this.hardwareKeyrings) {
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
        return keyring.signTypedData(
          address,
          typedData as Parameters<typeof keyring.signTypedData>[1]
        )
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTypedData(
          address,
          typedData as Parameters<typeof keyring.signTypedData>[1]
        )
      }
    }

    for (const keyring of this.hardwareKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTypedData(address, typedData)
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Sign a transaction
   */
  async signTransaction(address: Address, transaction: unknown): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Find keyring with this address
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTransaction(
          address,
          transaction as Parameters<typeof keyring.signTransaction>[1]
        )
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTransaction(
          address,
          transaction as Parameters<typeof keyring.signTransaction>[1]
        )
      }
    }

    for (const keyring of this.hardwareKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signTransaction(address, transaction)
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Sign an EIP-7702 authorization hash
   * Returns the signature components (v, r, s) for the authorization
   */
  async signAuthorizationHash(
    address: Address,
    hash: Hex
  ): Promise<{ v: number; r: Hex; s: Hex; signature: Hex }> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Sign the hash using signMessage (which uses personal_sign internally)
    // For EIP-7702, we need to sign the raw hash directly
    const signature = await this.signRawHash(address, hash)

    // Parse signature into v, r, s components
    const sig = signature.slice(2) // Remove 0x prefix

    if (sig.length !== 130) {
      throw new Error(`Invalid signature length: expected 130 hex chars, got ${sig.length}`)
    }

    const r = `0x${sig.slice(0, 64)}` as Hex
    const s = `0x${sig.slice(64, 128)}` as Hex
    let v = Number.parseInt(sig.slice(128, 130), 16)

    // Normalize v to 0 or 1 (EIP-7702 uses 0/1, not 27/28)
    if (v >= 27) {
      v -= 27
    }

    return { v, r, s, signature }
  }

  /**
   * Sign a raw hash (without personal_sign prefix)
   * Used for EIP-7702 authorization signatures
   */
  private async signRawHash(address: Address, hash: Hex): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Find keyring with this address and use its sign capability
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signRawHash(address, hash)
      }
    }

    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signRawHash(address, hash)
      }
    }

    for (const keyring of this.hardwareKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.signRawHash(address, hash)
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Verify password without changing vault state
   * Used for re-authentication before sensitive operations
   */
  async verifyPassword(password: string): Promise<boolean> {
    try {
      // Use vault's reauthenticate which verifies password
      await vault.reauthenticate(password)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get mnemonic with password verification (secure method)
   * Requires password re-entry for security
   */
  async getMnemonicWithPassword(password: string): Promise<string | null> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Verify password before returning sensitive data
    const isValid = await this.verifyPassword(password)
    if (!isValid) {
      throw new Error('Incorrect password')
    }

    const hdKeyring = this.hdKeyrings[0]
    if (!hdKeyring) {
      return null
    }

    return hdKeyring.getMnemonic()
  }

  /**
   * Export private key with password verification (secure method)
   * Requires password re-entry for security
   */
  async exportPrivateKeyWithPassword(address: Address, password: string): Promise<Hex> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Verify password before returning sensitive data
    const isValid = await this.verifyPassword(password)
    if (!isValid) {
      throw new Error('Incorrect password')
    }

    return this.exportPrivateKey(address)
  }

  /**
   * Export private key
   */
  exportPrivateKey(address: Address): Hex {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    // Check HD keyrings first
    for (const keyring of this.hdKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.exportPrivateKey(address)
      }
    }

    // Check simple keyrings
    for (const keyring of this.simpleKeyrings) {
      if (keyring.hasAccount(address)) {
        return keyring.exportPrivateKey(address)
      }
    }

    throw new Error('Account not found')
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await vault.changePassword(oldPassword, newPassword)
  }

  // ==========================================================================
  // Ledger Hardware Wallet Methods
  // ==========================================================================

  /**
   * Connect a Ledger device via WebHID
   */
  async connectLedger(): Promise<void> {
    const transport = new LedgerWebHIDTransport()

    // Create or reuse existing hardware keyring
    let ledgerKeyring = this.hardwareKeyrings[0]
    if (!ledgerKeyring) {
      ledgerKeyring = new LedgerKeyring()
      this.hardwareKeyrings.push(ledgerKeyring)
    }

    await ledgerKeyring.connectDevice(transport)
  }

  /**
   * Discover Ledger accounts from the connected device
   */
  async discoverLedgerAccounts(startIndex: number, count: number): Promise<KeyringAccount[]> {
    const ledgerKeyring = this.hardwareKeyrings[0]
    if (!ledgerKeyring) {
      throw new Error('No Ledger keyring found. Connect a Ledger device first.')
    }
    return ledgerKeyring.discoverAccounts(startIndex, count)
  }

  /**
   * Add a discovered Ledger account to the keyring and persist to vault
   */
  async addLedgerAccount(account: HardwareAccountInfo): Promise<void> {
    if (!vault.isUnlocked()) {
      throw new Error('Vault is locked')
    }

    let ledgerKeyring = this.hardwareKeyrings[0]
    if (!ledgerKeyring) {
      ledgerKeyring = new LedgerKeyring()
      this.hardwareKeyrings.push(ledgerKeyring)
    }

    ledgerKeyring.addDiscoveredAccount(account)

    // Persist hardware keyring to vault
    const data = vault.getData()
    const keyrings = [...data.keyrings]
    const hwIndex = keyrings.findIndex((k) => k.type === 'hardware')
    if (hwIndex >= 0) {
      keyrings[hwIndex] = { type: 'hardware', data: ledgerKeyring.serialize() }
    } else {
      keyrings.push({ type: 'hardware', data: ledgerKeyring.serialize() })
    }

    await vault.updateData({ keyrings })

    this.emit('accountsChanged', this.getAllAccounts())
  }

  /**
   * Disconnect the Ledger device
   */
  async disconnectLedger(): Promise<void> {
    const ledgerKeyring = this.hardwareKeyrings[0]
    if (ledgerKeyring) {
      await ledgerKeyring.disconnectDevice()
    }
  }

  /**
   * Check if a Ledger device is connected
   */
  isLedgerConnected(): boolean {
    const ledgerKeyring = this.hardwareKeyrings[0]
    return ledgerKeyring?.isDeviceConnected() ?? false
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
