/**
 * Hardware Keyring
 *
 * Abstract base for hardware wallet integrations (Ledger, Trezor).
 * Private keys never leave the hardware device - all signing is delegated.
 */

import type { Address, Hex } from 'viem'
import { hashDomain } from 'viem'
import { hashStruct, serializeTransaction, toHex } from 'viem/utils'
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
// Ledger Keyring Implementation
// ============================================================================

const DEFAULT_HD_PATH = "m/44'/60'/0'/0"

/**
 * Build the EIP712Domain type array based on which domain fields are present.
 */
function getTypesForEIP712Domain(domain: Record<string, unknown>) {
  const types: Array<{ name: string; type: string }> = []
  if (domain.name !== undefined) types.push({ name: 'name', type: 'string' })
  if (domain.version !== undefined) types.push({ name: 'version', type: 'string' })
  if (domain.chainId !== undefined) types.push({ name: 'chainId', type: 'uint256' })
  if (domain.verifyingContract !== undefined)
    types.push({ name: 'verifyingContract', type: 'address' })
  if (domain.salt !== undefined) types.push({ name: 'salt', type: 'bytes32' })
  return types
}

/**
 * Ledger hardware wallet keyring.
 * Uses @ledgerhq/hw-app-eth to communicate with the Ledger device.
 */
export class LedgerKeyring implements IHardwareKeyring {
  readonly deviceType: HardwareDeviceType = 'ledger'

  private hdPath: string
  private accounts: HardwareAccountInfo[] = []
  private transport: HardwareTransport | null = null
  private ethApp: import('@ledgerhq/hw-app-eth').default | null = null

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

  async discoverAccounts(startIndex: number, count: number): Promise<KeyringAccount[]> {
    this.ensureConnected()
    const ethApp = this.ensureEthApp()

    const discovered: KeyringAccount[] = []

    for (let i = startIndex; i < startIndex + count; i++) {
      const path = `${this.hdPath}/${i}`
      const result = await ethApp.getAddress(path)
      const address = result.address as Address

      discovered.push({
        address,
        type: 'hardware' as const,
        name: `Ledger ${i + 1}`,
        index: i,
        path,
      })
    }

    return discovered
  }

  addDiscoveredAccount(account: HardwareAccountInfo): void {
    if (!this.hasAccount(account.address)) {
      this.accounts.push(account)
    }
  }

  async signMessage(address: Address, message: string): Promise<Hex> {
    this.ensureConnected()
    const ethApp = this.ensureEthApp()
    const accountInfo = this.getAccountInfo(address)

    // Convert message to hex without 0x prefix for Ledger
    const messageHex = toHex(new TextEncoder().encode(message)).slice(2)
    const result = await ethApp.signPersonalMessage(accountInfo.path, messageHex)

    return this.composeSignature(result.v, result.r, result.s)
  }

  async signTypedData(address: Address, typedData: unknown): Promise<Hex> {
    this.ensureConnected()
    const ethApp = this.ensureEthApp()
    const accountInfo = this.getAccountInfo(address)

    // Parse typed data
    const typed = typedData as {
      domain: Record<string, unknown>
      types: Record<string, Array<{ name: string; type: string }>>
      primaryType: string
      message: Record<string, unknown>
    }

    // Build full types including EIP712Domain
    const fullTypes = {
      EIP712Domain: getTypesForEIP712Domain(typed.domain),
      ...typed.types,
    }

    // Compute domain separator and struct hash using viem
    const domainSeparatorHash = hashDomain({
      domain: typed.domain,
      types: fullTypes,
    } as Parameters<typeof hashDomain>[0])

    const structHash = hashStruct({
      data: typed.message,
      primaryType: typed.primaryType,
      types: fullTypes,
    } as Parameters<typeof hashStruct>[0])

    // Remove 0x prefix for Ledger
    const result = await ethApp.signEIP712HashedMessage(
      accountInfo.path,
      domainSeparatorHash.slice(2),
      structHash.slice(2)
    )

    return this.composeSignature(result.v, result.r, result.s)
  }

  async signTransaction(address: Address, tx: unknown): Promise<Hex> {
    this.ensureConnected()
    const ethApp = this.ensureEthApp()
    const accountInfo = this.getAccountInfo(address)

    // Serialize the transaction using viem
    const serialized = serializeTransaction(tx as Parameters<typeof serializeTransaction>[0])

    // Remove 0x prefix for Ledger
    const rawTxHex = serialized.slice(2)
    const result = await ethApp.signTransaction(accountInfo.path, rawTxHex)

    return this.composeSignature(result.v, result.r, result.s)
  }

  async signRawHash(address: Address, hash: Hex): Promise<Hex> {
    this.ensureConnected()
    const ethApp = this.ensureEthApp()
    const accountInfo = this.getAccountInfo(address)

    // Ledger does not natively support raw hash signing.
    // Use signPersonalMessage as a fallback — note this adds the EIP-191 prefix.
    // For EIP-7702 authorization, the caller should be aware of this limitation.
    const hashHex = hash.startsWith('0x') ? hash.slice(2) : hash
    const result = await ethApp.signPersonalMessage(accountInfo.path, hashHex)

    return this.composeSignature(result.v, result.r, result.s)
  }

  serialize(): HardwareKeyringData {
    return {
      deviceType: 'ledger',
      accounts: [...this.accounts],
    }
  }

  sanitize(): void {
    // Hardware keyrings don't hold sensitive data in memory
    // but we clear the transport reference and eth app
    this.ethApp = null
    this.transport = null
  }

  isDeviceConnected(): boolean {
    return this.transport?.isConnected ?? false
  }

  async connectDevice(transport: HardwareTransport): Promise<void> {
    this.transport = transport
    await transport.connect()

    // Create Eth app instance from the raw transport
    const rawTransport = (transport as { getRawTransport?: () => unknown }).getRawTransport?.()
    if (rawTransport) {
      const { default: Eth } = await import('@ledgerhq/hw-app-eth')
      this.ethApp = new Eth(rawTransport as import('@ledgerhq/hw-transport').default)
    }
  }

  async disconnectDevice(): Promise<void> {
    this.ethApp = null
    if (this.transport) {
      await this.transport.disconnect()
      this.transport = null
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private ensureConnected(): void {
    if (!this.transport?.isConnected) {
      throw new Error('Ledger device is not connected. Call connectDevice() first.')
    }
  }

  private ensureEthApp(): import('@ledgerhq/hw-app-eth').default {
    if (!this.ethApp) {
      throw new Error('Ledger Ethereum app not initialized. Reconnect the device.')
    }
    return this.ethApp
  }

  private getAccountInfo(address: Address): HardwareAccountInfo {
    const info = this.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase())
    if (!info) {
      throw new Error(`Account ${address} not found in Ledger keyring`)
    }
    return info
  }

  /**
   * Compose v, r, s into a single 65-byte hex signature.
   */
  private composeSignature(v: number | string, r: string, s: string): Hex {
    const vNum = typeof v === 'string' ? Number.parseInt(v, 16) : v
    const rHex = r.length === 64 ? r : r.padStart(64, '0')
    const sHex = s.length === 64 ? s : s.padStart(64, '0')
    const vHex = (vNum >= 27 ? vNum : vNum + 27).toString(16).padStart(2, '0')
    return `0x${rHex}${sHex}${vHex}` as Hex
  }
}
