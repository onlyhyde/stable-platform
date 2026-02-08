import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { clearSensitiveMap } from '../../shared/security/memorySanitizer'
import type { KeyringAccount, SimpleKeyringData } from '../../types'

/**
 * Simple Keyring - Manages imported private keys
 * Each account has its own private key (not derived from HD path)
 */

export class SimpleKeyring {
  private privateKeys: Map<Address, Hex> = new Map()
  private accounts: KeyringAccount[] = []

  constructor(data?: SimpleKeyringData) {
    if (data) {
      this.deserialize(data)
    }
  }

  /**
   * Get all accounts in this keyring
   */
  getAccounts(): KeyringAccount[] {
    return [...this.accounts]
  }

  /**
   * Get the number of accounts
   */
  getAccountCount(): number {
    return this.accounts.length
  }

  /**
   * Import an account from a private key
   */
  importAccount(privateKey: Hex): KeyringAccount {
    // Normalize private key format
    const normalizedKey = privateKey.startsWith('0x') ? privateKey : (`0x${privateKey}` as Hex)

    // Validate private key by deriving address
    let viemAccount: ReturnType<typeof privateKeyToAccount>
    try {
      viemAccount = privateKeyToAccount(normalizedKey)
    } catch (_error) {
      throw new Error('Invalid private key')
    }

    const address = viemAccount.address as Address

    // Check if already imported
    if (this.privateKeys.has(address)) {
      throw new Error('Account already exists')
    }

    this.privateKeys.set(address, normalizedKey)

    const importIndex = this.accounts.length + 1
    const account: KeyringAccount = {
      address,
      type: 'simple',
      name: `Imported ${importIndex}`,
    }

    this.accounts.push(account)
    return account
  }

  /**
   * Remove an account
   */
  removeAccount(address: Address): void {
    const normalizedAddress = address.toLowerCase() as Address

    // Find account in accounts array
    const index = this.accounts.findIndex((a) => a.address.toLowerCase() === normalizedAddress)

    if (index === -1) {
      throw new Error('Account not found')
    }

    // Find the actual address in the map
    const mapKey = Array.from(this.privateKeys.keys()).find(
      (key) => key.toLowerCase() === normalizedAddress
    )

    if (mapKey) {
      this.privateKeys.delete(mapKey)
    }
    this.accounts.splice(index, 1)
  }

  /**
   * Get the viem account for signing
   */
  getSigningAccount(address: Address): ReturnType<typeof privateKeyToAccount> | null {
    const normalizedAddress = address.toLowerCase() as Address
    const mapKey = Array.from(this.privateKeys.keys()).find(
      (key) => key.toLowerCase() === normalizedAddress
    )

    if (!mapKey) {
      return null
    }

    const privateKey = this.privateKeys.get(mapKey)
    if (!privateKey) {
      return null
    }

    return privateKeyToAccount(privateKey)
  }

  /**
   * Sign a message with an account
   */
  async signMessage(address: Address, message: Hex): Promise<Hex> {
    const account = this.getSigningAccount(address)
    if (!account) {
      throw new Error('Account not found in keyring')
    }

    return account.signMessage({ message: { raw: message } })
  }

  /**
   * Sign typed data with an account
   */
  async signTypedData(
    address: Address,
    typedData: Parameters<ReturnType<typeof privateKeyToAccount>['signTypedData']>[0]
  ): Promise<Hex> {
    const account = this.getSigningAccount(address)
    if (!account) {
      throw new Error('Account not found in keyring')
    }

    return account.signTypedData(typedData)
  }

  /**
   * Sign a transaction with an account
   */
  async signTransaction(
    address: Address,
    transaction: Parameters<ReturnType<typeof privateKeyToAccount>['signTransaction']>[0]
  ): Promise<Hex> {
    const account = this.getSigningAccount(address)
    if (!account) {
      throw new Error('Account not found in keyring')
    }

    return account.signTransaction(transaction)
  }

  /**
   * Sign a raw hash directly (without message prefix)
   * Used for EIP-7702 authorization signatures
   */
  async signRawHash(address: Address, hash: Hex): Promise<Hex> {
    const account = this.getSigningAccount(address)
    if (!account) {
      throw new Error('Account not found in keyring')
    }

    return account.sign({ hash })
  }

  /**
   * Export a private key (use with caution!)
   */
  exportPrivateKey(address: Address): Hex {
    const normalizedAddress = address.toLowerCase() as Address
    const mapKey = Array.from(this.privateKeys.keys()).find(
      (key) => key.toLowerCase() === normalizedAddress
    )

    if (!mapKey) {
      throw new Error('Account not found')
    }

    const privateKey = this.privateKeys.get(mapKey)
    if (!privateKey) {
      throw new Error('Private key not found')
    }

    return privateKey
  }

  /**
   * Serialize keyring data for storage
   */
  serialize(): SimpleKeyringData {
    return {
      privateKeys: Array.from(this.privateKeys.values()),
    }
  }

  /**
   * Deserialize keyring data from storage
   */
  private deserialize(data: SimpleKeyringData): void {
    let index = 1
    for (const privateKey of data.privateKeys) {
      const viemAccount = privateKeyToAccount(privateKey)
      const address = viemAccount.address as Address

      this.privateKeys.set(address, privateKey)
      this.accounts.push({
        address,
        type: 'simple',
        name: `Imported ${index}`,
      })
      index++
    }
  }

  /**
   * Check if this keyring contains an address
   */
  hasAccount(address: Address): boolean {
    return this.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())
  }

  /**
   * Sanitize sensitive data from memory.
   * Called when the wallet is locked.
   */
  sanitize(): void {
    clearSensitiveMap(this.privateKeys)
    this.accounts = []
  }
}
