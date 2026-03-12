/**
 * Connection lifecycle management with state machine.
 *
 * Handles connect/disconnect/reconnect and tracks connection status.
 * Delegates session persistence to SessionManager when enabled.
 */
import type { Address, EIP1193Provider } from 'viem'
import type { ConnectionStatus } from '../types'
import { filterValidAddresses } from '../validation'
import { createLogger } from './logger'
import type { SessionManager } from './SessionManager'

const log = createLogger('Connection')

export interface ConnectionManagerCallbacks {
  onStatusChange: (status: ConnectionStatus) => void
  onAccountsChange: (accounts: Address[]) => void
}

export class ConnectionManager {
  private readonly provider: EIP1193Provider
  private readonly session: SessionManager | null
  private readonly callbacks: ConnectionManagerCallbacks

  private _status: ConnectionStatus = 'disconnected'
  private _accounts: Address[] = []

  constructor(
    provider: EIP1193Provider,
    callbacks: ConnectionManagerCallbacks,
    session?: SessionManager
  ) {
    this.provider = provider
    this.callbacks = callbacks
    this.session = session ?? null
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get accounts(): readonly Address[] {
    return this._accounts
  }

  get currentAccount(): Address | null {
    return this._accounts[0] ?? null
  }

  /**
   * Full connection: eth_requestAccounts + state update
   */
  async connect(): Promise<Address[]> {
    this.setStatus('connecting')

    try {
      // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
      const result = await (this.provider as any).request({ method: 'eth_requestAccounts' })
      const accounts = Array.isArray(result) ? filterValidAddresses(result) : []

      this._accounts = accounts
      this.setStatus(accounts.length > 0 ? 'connected' : 'disconnected')
      this.callbacks.onAccountsChange(accounts)

      // Persist session
      if (this.session && accounts.length > 0) {
        // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
        const chainId = (await (this.provider as any).request({ method: 'eth_chainId' })) as string
        this.session.save({ accounts, chainId, connectedAt: Date.now() })
      }

      log.info('Connected', { accounts: accounts.length })
      return accounts
    } catch (err) {
      this.setStatus('disconnected')
      throw err
    }
  }

  /**
   * Attempt session restore without user interaction.
   * Verifies the cached session with eth_accounts (silent check).
   */
  async reconnect(): Promise<Address[]> {
    if (!this.session) return []

    const cached = this.session.load()
    if (!cached || cached.accounts.length === 0) return []

    this.setStatus('reconnecting')
    log.debug('Attempting session restore', { cachedAccounts: cached.accounts.length })

    try {
      // Verify cached accounts are still authorized (no popup)
      // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
      const result = await (this.provider as any).request({ method: 'eth_accounts' })
      const accounts = Array.isArray(result) ? filterValidAddresses(result) : []

      if (accounts.length > 0) {
        this._accounts = accounts
        this.setStatus('connected')
        this.callbacks.onAccountsChange(accounts)

        // Update session with fresh data
        // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
        const chainId = (await (this.provider as any).request({ method: 'eth_chainId' })) as string
        this.session.save({ accounts, chainId, connectedAt: Date.now() })

        log.info('Session restored', { accounts: accounts.length })
        return accounts
      }

      // Cached session is stale
      this.session.clear()
      this.setStatus('disconnected')
      return []
    } catch {
      this.session.clear()
      this.setStatus('disconnected')
      return []
    }
  }

  /**
   * Disconnect: clear state and session
   */
  disconnect(): void {
    this._accounts = []
    this.setStatus('disconnected')
    this.session?.clear()
    log.info('Disconnected')
  }

  /**
   * Handle external accountsChanged event from the provider.
   */
  handleAccountsChanged(accounts: Address[]): void {
    this._accounts = accounts

    if (accounts.length === 0) {
      this.setStatus('disconnected')
      this.session?.clear()
    } else {
      this.setStatus('connected')
    }

    this.callbacks.onAccountsChange(accounts)
  }

  /**
   * Mark the connection as connected (called on EIP-1193 'connect' event).
   * Per spec, the 'connect' event indicates the provider is connected to a chain.
   */
  markConnected(): void {
    this.setStatus('connected')
  }

  /**
   * Update session with current chain (called by ChainManager on chain change).
   */
  updateSessionChain(chainId: string): void {
    if (!this.session || this._accounts.length === 0) return
    this.session.save({ accounts: this._accounts, chainId, connectedAt: Date.now() })
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status
    this.callbacks.onStatusChange(status)
  }
}
