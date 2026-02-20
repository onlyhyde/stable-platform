/**
 * Ledger WebHID Transport Wrapper
 *
 * Implements the HardwareTransport interface using @ledgerhq/hw-transport-webhid
 * for USB communication with Ledger devices via the WebHID API.
 */

import type Transport from '@ledgerhq/hw-transport'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import type { HardwareTransport, TransportType } from './hardwareKeyring'

export class LedgerWebHIDTransport implements HardwareTransport {
  readonly type: TransportType = 'usb'
  private transport: Transport | null = null

  get isConnected(): boolean {
    return this.transport !== null
  }

  async connect(): Promise<void> {
    if (this.transport) {
      return
    }
    this.transport = await TransportWebHID.create()
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
  }

  async send(command: Uint8Array): Promise<Uint8Array> {
    if (!this.transport) {
      throw new Error('Transport not connected')
    }
    // Low-level send — not typically used directly; LedgerKeyring uses getRawTransport()
    return this.transport.send(
      command[0]!,
      command[1]!,
      command[2]!,
      command[3]!,
      new Uint8Array(command.slice(5)) as unknown as Buffer
    )
  }

  /**
   * Get the raw @ledgerhq/hw-transport instance for use with hw-app-eth.
   * LedgerKeyring creates an Eth app instance from this transport.
   */
  getRawTransport(): Transport | null {
    return this.transport
  }
}
