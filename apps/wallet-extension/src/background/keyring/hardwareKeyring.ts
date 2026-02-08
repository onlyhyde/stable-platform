/**
 * Hardware Keyring
 *
 * Abstract base for hardware wallet integrations (Ledger, Trezor).
 * Private keys never leave the hardware device - all signing is delegated.
 */

import type { Address, Hex } from 'viem'
import type {
  HardwareAccountInfo,
  HardwareDeviceType,
  HardwareKeyringData,
  KeyringAccount,
} from '../../types'

// ============================================================================
// Transport Abstraction
// ============================================================================

export type TransportType = 'usb' | 'bluetooth'

export interface HardwareTransport {
  readonly type: TransportType
  readonly isConnected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(command: Uint8Array): Promise<Uint8Array>
}

// ============================================================================
// Hardware Keyring Interface
// ============================================================================

/**
 * Common interface for all hardware keyring implementations.
 * Mirrors HDKeyring/SimpleKeyring method signatures for compatibility
 * with the KeyringController.
 */
export interface IHardwareKeyring {
  readonly deviceType: HardwareDeviceType

  // Account management
  getAccounts(): KeyringAccount[]
  getAccountCount(): number
  hasAccount(address: Address): boolean

  // Hardware-specific: discover accounts from device
  discoverAccounts(startIndex: number, count: number): Promise<KeyringAccount[]>
  addDiscoveredAccount(account: HardwareAccountInfo): void

  // Signing (delegates to hardware device)
  signMessage(address: Address, message: string): Promise<Hex>
  signTypedData(address: Address, typedData: unknown): Promise<Hex>
  signTransaction(address: Address, tx: unknown): Promise<Hex>
  signRawHash(address: Address, hash: Hex): Promise<Hex>

  // Private key export is NOT supported for hardware wallets
  // exportPrivateKey will always throw

  // Serialization
  serialize(): HardwareKeyringData
  sanitize(): void

  // Transport management
  isDeviceConnected(): boolean
  connectDevice(transport: HardwareTransport): Promise<void>
  disconnectDevice(): Promise<void>
}

// ============================================================================
// Ledger Keyring Stub
// ============================================================================

const DEFAULT_HD_PATH = "m/44'/60'/0'/0"

/**
 * Ledger hardware wallet keyring.
 * Stub implementation - requires @ledgerhq/hw-app-eth for full functionality.
 */
export class LedgerKeyring implements IHardwareKeyring {
  readonly deviceType: HardwareDeviceType = 'ledger'

  private accounts: HardwareAccountInfo[] = []
  private transport: HardwareTransport | null = null
  private hdPath: string

  constructor(data?: HardwareKeyringData) {
    this.hdPath = DEFAULT_HD_PATH
    if (data) {
      this.accounts = data.accounts
    }
  }

  getAccounts(): KeyringAccount[] {
    return this.accounts.map((a) => ({
      address: a.address,
      type: 'hardware' as const,
      name: `Ledger ${a.index + 1}`,
      index: a.index,
      path: a.path,
    }))
  }

  getAccountCount(): number {
    return this.accounts.length
  }

  hasAccount(address: Address): boolean {
    return this.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())
  }

  async discoverAccounts(_startIndex: number, _count: number): Promise<KeyringAccount[]> {
    this.ensureConnected()
    // TODO: Implement with @ledgerhq/hw-app-eth
    // 1. Get Ethereum app on Ledger
    // 2. For each index, derive address from path
    // 3. Return discovered accounts
    throw new Error('Ledger account discovery not yet implemented. Install @ledgerhq/hw-app-eth.')
  }

  addDiscoveredAccount(account: HardwareAccountInfo): void {
    if (!this.hasAccount(account.address)) {
      this.accounts.push(account)
    }
  }

  async signMessage(_address: Address, _message: string): Promise<Hex> {
    this.ensureConnected()
    // TODO: Implement with Ledger personal_sign
    throw new Error('Ledger message signing not yet implemented. Install @ledgerhq/hw-app-eth.')
  }

  async signTypedData(_address: Address, _typedData: unknown): Promise<Hex> {
    this.ensureConnected()
    // TODO: Implement with Ledger EIP-712 signing
    throw new Error('Ledger typed data signing not yet implemented. Install @ledgerhq/hw-app-eth.')
  }

  async signTransaction(_address: Address, _tx: unknown): Promise<Hex> {
    this.ensureConnected()
    // TODO: Implement with Ledger transaction signing
    throw new Error('Ledger transaction signing not yet implemented. Install @ledgerhq/hw-app-eth.')
  }

  async signRawHash(_address: Address, _hash: Hex): Promise<Hex> {
    this.ensureConnected()
    throw new Error('Ledger raw hash signing not yet implemented. Install @ledgerhq/hw-app-eth.')
  }

  serialize(): HardwareKeyringData {
    return {
      deviceType: 'ledger',
      accounts: [...this.accounts],
    }
  }

  sanitize(): void {
    // Hardware keyrings don't hold sensitive data in memory
    // but we clear the transport reference
    this.transport = null
  }

  isDeviceConnected(): boolean {
    return this.transport?.isConnected ?? false
  }

  async connectDevice(transport: HardwareTransport): Promise<void> {
    this.transport = transport
    await transport.connect()
  }

  async disconnectDevice(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect()
      this.transport = null
    }
  }

  private ensureConnected(): void {
    if (!this.transport?.isConnected) {
      throw new Error('Ledger device is not connected. Call connectDevice() first.')
    }
  }

  private getDerivationPath(index: number): string {
    return `${this.hdPath}/${index}`
  }
}
