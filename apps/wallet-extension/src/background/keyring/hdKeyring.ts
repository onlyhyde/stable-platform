import type { Address, Hex } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { bytesToHex } from 'viem/utils'
import { generateMnemonic } from '@scure/bip39'
import { wordlist as english } from '@scure/bip39/wordlists/english'
import { clearString } from '../../shared/security/memorySanitizer'
import type { HDKeyringData, KeyringAccount } from '../../types'

/**
 * HD Keyring - Hierarchical Deterministic wallet
 * Derives accounts from a mnemonic seed phrase using BIP-44 path
 */

const DEFAULT_HD_PATH = "m/44'/60'/0'/0"

export class HDKeyring {
  private mnemonic: string
  private hdPath: string
  private accounts: KeyringAccount[] = []

  constructor(data?: HDKeyringData) {
    if (data) {
      this.mnemonic = data.mnemonic
      this.hdPath = data.hdPath
      this.deserialize(data)
    } else {
      this.mnemonic = ''
      this.hdPath = DEFAULT_HD_PATH
    }
  }

  /**
   * Initialize with a new mnemonic
   */
  initializeNewMnemonic(wordCount: 12 | 24 = 12): string {
    const strength = wordCount === 24 ? 256 : 128
    this.mnemonic = generateMnemonic(english, strength)
    this.accounts = []
    return this.mnemonic
  }

  /**
   * Initialize with an existing mnemonic
   */
  initializeFromMnemonic(mnemonic: string, hdPath?: string): void {
    // Validate mnemonic by trying to derive an account
    try {
      mnemonicToAccount(mnemonic, { addressIndex: 0 })
    } catch (_error) {
      throw new Error('Invalid mnemonic phrase')
    }

    this.mnemonic = mnemonic
    this.hdPath = hdPath ?? DEFAULT_HD_PATH
    this.accounts = []
  }

  /**
   * Get the mnemonic (only when unlocked)
   */
  getMnemonic(): string {
    return this.mnemonic
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
   * Add a new account (derive next index)
   */
  addAccount(): KeyringAccount {
    const index = this.accounts.length
    const account = this.deriveAccount(index)
    this.accounts.push(account)
    return account
  }

  /**
   * Add multiple accounts at once
   */
  addAccounts(count: number): KeyringAccount[] {
    const newAccounts: KeyringAccount[] = []
    for (let i = 0; i < count; i++) {
      newAccounts.push(this.addAccount())
    }
    return newAccounts
  }

  /**
   * Derive an account at a specific index
   */
  private deriveAccount(index: number): KeyringAccount {
    const viemAccount = mnemonicToAccount(this.mnemonic, {
      addressIndex: index,
    })

    return {
      address: viemAccount.address as Address,
      type: 'hd',
      name: `Account ${index + 1}`,
      index,
      path: `${this.hdPath}/${index}`,
    }
  }

  /**
   * Get the viem account for signing
   */
  getSigningAccount(address: Address): ReturnType<typeof mnemonicToAccount> | null {
    const account = this.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase())
    if (!account || account.index === undefined) {
      return null
    }

    return mnemonicToAccount(this.mnemonic, {
      addressIndex: account.index,
    })
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
    typedData: Parameters<ReturnType<typeof mnemonicToAccount>['signTypedData']>[0]
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
    transaction: Parameters<ReturnType<typeof mnemonicToAccount>['signTransaction']>[0]
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
   * Serialize keyring data for storage
   */
  serialize(): HDKeyringData {
    return {
      mnemonic: this.mnemonic,
      hdPath: this.hdPath,
      numberOfAccounts: this.accounts.length,
    }
  }

  /**
   * Deserialize keyring data from storage
   */
  private deserialize(data: HDKeyringData): void {
    this.mnemonic = data.mnemonic
    this.hdPath = data.hdPath

    // Re-derive all accounts
    for (let i = 0; i < data.numberOfAccounts; i++) {
      this.accounts.push(this.deriveAccount(i))
    }
  }

  /**
   * Check if this keyring contains an address
   */
  hasAccount(address: Address): boolean {
    return this.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())
  }

  /**
   * Export private key for an account
   */
  exportPrivateKey(address: Address): Hex {
    const account = this.getSigningAccount(address)
    if (!account) {
      throw new Error('Account not found in keyring')
    }

    // viem's mnemonicToAccount returns an account with getHdKey() method
    // that provides access to the private key
    const hdKey = account.getHdKey()
    if (!hdKey.privateKey) {
      throw new Error('Private key not available')
    }

    // Convert Uint8Array to hex string using viem's bytesToHex
    return bytesToHex(hdKey.privateKey)
  }

  /**
   * Sanitize sensitive data from memory.
   * Called when the wallet is locked.
   */
  sanitize(): void {
    this.mnemonic = clearString(this.mnemonic)
    this.accounts = []
  }
}
