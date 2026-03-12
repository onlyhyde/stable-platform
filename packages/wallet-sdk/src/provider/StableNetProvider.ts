import type { Address, EIP1193Provider, Hash, ProviderConnectInfo, ProviderRpcError } from 'viem'
import type {
  StableNetRpcSchema,
  UserOperationGasEstimate,
  UserOperationReceipt,
  UserOperationRequest,
} from '../rpc'
import type { ConnectionStatus, TransactionRequest } from '../types'
import { filterValidAddresses } from '../validation'
import { ChainManager } from './ChainManager'
import { ConnectionManager } from './ConnectionManager'
import { createLogger } from './logger'
import { ReadOnlyTransport } from './ReadOnlyTransport'
import { routeRpcMethod } from './rpcRouter'
import { SessionManager } from './SessionManager'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener = (...args: unknown[]) => void

/**
 * Transaction event data emitted when a transaction is sent
 */
export interface TransactionSentEvent {
  hash: Hash
  from: Address
  to?: Address
  value?: bigint
  chainId: number
}

/**
 * Transaction confirmation event data
 */
export interface TransactionConfirmedEvent {
  hash: Hash
  blockNumber: number
  status: 'success' | 'reverted'
  gasUsed: bigint
}

/**
 * Asset information returned by wallet_getAssets
 */
export interface WalletAsset {
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
  logoURI?: string
  isVisible?: boolean
}

/**
 * Native asset information
 */
export interface WalletNativeAsset {
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
}

/**
 * Response from wallet_getAssets RPC
 */
export interface WalletAssetsResponse {
  chainId: number
  account: Address
  native: WalletNativeAsset
  tokens: WalletAsset[]
}

/**
 * Parameters for wallet_addToken RPC
 */
export interface AddTokenParams {
  address: Address
  symbol?: string
  name?: string
  decimals?: number
  logoURI?: string
}

/**
 * Response from wallet_addToken RPC
 */
export interface AddTokenResult {
  success: boolean
  token?: WalletAsset
  error?: string
}

/**
 * Assets changed event data
 */
export interface AssetsChangedEvent {
  chainId: number
  account: Address
  reason: 'token_added' | 'token_removed' | 'balance_changed' | 'chain_switched'
  timestamp: number
}

/**
 * Extended provider events including transaction lifecycle
 */
export type StableNetProviderEvent =
  | 'connect'
  | 'disconnect'
  | 'accountsChanged'
  | 'chainChanged'
  | 'transactionSent'
  | 'transactionConfirmed'
  | 'statusChanged'
  | 'assetsChanged'

/**
 * Provider configuration options
 */
export interface StableNetProviderConfig {
  /** Enable session persistence for instant reconnection (default: false) */
  enableSession?: boolean
  /** Max session age in ms (default: 24 hours) */
  sessionMaxAge?: number
  /** Public RPC URL for read-only calls without wallet connection */
  readOnlyRpcUrl?: string
}

const log = createLogger('Provider')

/**
 * StableNet Provider wrapper
 *
 * Delegates to focused managers for connection, chain, and session lifecycle.
 * Provides a typed interface over the EIP-1193 provider with event handling.
 */
export class StableNetProvider {
  private provider: EIP1193Provider
  private eventListeners: Map<string, Set<EventListener>> = new Map()
  private providerListeners: { event: string; listener: (...args: unknown[]) => void }[] = []
  private _destroyed = false

  // Managers
  private readonly connectionManager: ConnectionManager
  private readonly chainManager: ChainManager
  private readonly readOnlyTransport: ReadOnlyTransport | null

  constructor(provider: EIP1193Provider, config?: StableNetProviderConfig) {
    this.provider = provider

    // Session manager (opt-in)
    const session = config?.enableSession
      ? new SessionManager({ maxAge: config.sessionMaxAge })
      : undefined

    // Connection manager
    this.connectionManager = new ConnectionManager(
      provider,
      {
        onStatusChange: (status) => this.emit('statusChanged', status),
        onAccountsChange: (accounts) => this.emit('accountsChanged', accounts),
      },
      session
    )

    // Chain manager
    this.chainManager = new ChainManager(provider, {
      onChainChange: (chainId) => this.emit('chainChanged', chainId),
      onSessionChainUpdate: (chainId) => this.connectionManager.updateSessionChain(chainId),
    })

    // Read-only transport (optional)
    this.readOnlyTransport = config?.readOnlyRpcUrl
      ? new ReadOnlyTransport(config.readOnlyRpcUrl)
      : null

    this.setupEventListeners()
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  get isConnected(): boolean {
    return this.connectionManager.status === 'connected'
  }

  get account(): Address | null {
    return this.connectionManager.currentAccount
  }

  get chainId(): string | null {
    return this.chainManager.chainId
  }

  get chainIdNumber(): number | null {
    return this.chainManager.chainIdNumber
  }

  get status(): ConnectionStatus {
    return this.connectionManager.status
  }

  get destroyed(): boolean {
    return this._destroyed
  }

  // ============================================================================
  // Connection
  // ============================================================================

  async connect(): Promise<Address[]> {
    const accounts = await this.connectionManager.connect()
    // Sync chain manager with current chain
    await this.chainManager.getChainId()
    return accounts
  }

  async disconnect(): Promise<void> {
    this.connectionManager.disconnect()
  }

  /**
   * Attempt silent session restore (no popup).
   * Returns cached accounts if the session is still valid.
   */
  async reconnect(): Promise<Address[]> {
    return this.connectionManager.reconnect()
  }

  async getAccounts(): Promise<Address[]> {
    const result = await this.rpc({ method: 'eth_accounts' })
    return Array.isArray(result) ? filterValidAddresses(result) : []
  }

  // ============================================================================
  // Chain
  // ============================================================================

  async getChainId(): Promise<string> {
    return this.chainManager.getChainId()
  }

  async switchChain(
    chainId: number,
    addChainConfig?: {
      chainName: string
      nativeCurrency: { name: string; symbol: string; decimals: number }
      rpcUrls: readonly string[]
      blockExplorerUrls?: string[]
      iconUrls?: string[]
    }
  ): Promise<void> {
    return this.chainManager.switchChain(chainId, addChainConfig)
  }

  async addChain(chain: {
    chainId: number
    chainName: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    rpcUrls: readonly string[]
    blockExplorerUrls?: string[]
    iconUrls?: string[]
  }): Promise<void> {
    return this.chainManager.addChain(chain)
  }

  // ============================================================================
  // RPC Request (with routing)
  // ============================================================================

  /**
   * Internal RPC request helper with routing.
   */
  // biome-ignore lint/suspicious/noExplicitAny: allows arbitrary RPC methods beyond viem's typed set
  private rpc(args: { method: string; params?: unknown[] | object }): Promise<any> {
    const route = routeRpcMethod(args.method)

    // Read-only methods: use transport if available and not connected
    if (route === 'readonly' && this.readOnlyTransport && !this.isConnected) {
      return this.readOnlyTransport.request(args.method, args.params as unknown[])
    }

    // biome-ignore lint/suspicious/noExplicitAny: forwarding arbitrary RPC args
    return this.provider.request(args as any)
  }

  /**
   * Type-safe request for StableNet custom RPC methods.
   */
  async stableNetRequest<M extends keyof StableNetRpcSchema>(
    method: M,
    params: StableNetRpcSchema[M]['params']
  ): Promise<StableNetRpcSchema[M]['result']> {
    return this.rpc({ method, params: [params] })
  }

  /**
   * Generic RPC request method.
   */
  async request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T> {
    return this.rpc(args) as Promise<T>
  }

  // ============================================================================
  // Signing
  // ============================================================================

  async signMessage(message: string): Promise<string> {
    if (!this.account) throw new Error('No account connected')
    return (await this.rpc({ method: 'personal_sign', params: [message, this.account] })) as string
  }

  async signTypedData(typedData: object): Promise<string> {
    if (!this.account) throw new Error('No account connected')
    let serialized: string
    try {
      serialized = JSON.stringify(typedData)
    } catch {
      throw new Error('Failed to serialize typed data: ensure the object is JSON-serializable')
    }
    return (await this.rpc({
      method: 'eth_signTypedData_v4',
      params: [this.account, serialized],
    })) as string
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  async sendTransaction(
    tx: TransactionRequest,
    options?: { waitForConfirmation?: boolean }
  ): Promise<Hash> {
    if (!this.account) throw new Error('No account connected')

    const txHash = (await this.rpc({
      method: 'eth_sendTransaction',
      params: [
        {
          ...tx,
          from: tx.from ?? this.account,
          value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : undefined,
          gas: tx.gas ? `0x${BigInt(tx.gas).toString(16)}` : undefined,
          gasPrice: tx.gasPrice ? `0x${BigInt(tx.gasPrice).toString(16)}` : undefined,
          maxFeePerGas: tx.maxFeePerGas ? `0x${BigInt(tx.maxFeePerGas).toString(16)}` : undefined,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas
            ? `0x${BigInt(tx.maxPriorityFeePerGas).toString(16)}`
            : undefined,
        },
      ],
    })) as Hash

    const sentEvent: TransactionSentEvent = {
      hash: txHash,
      from: tx.from ?? this.account,
      to: tx.to,
      value: tx.value ? BigInt(tx.value) : undefined,
      chainId: this.chainIdNumber ?? 1,
    }
    this.emit('transactionSent', sentEvent)

    if (options?.waitForConfirmation) {
      this.waitForTransaction(txHash).catch((error) => {
        log.error('Transaction confirmation error:', error)
      })
    }

    return txHash
  }

  async waitForTransaction(hash: Hash, confirmations = 1): Promise<TransactionConfirmedEvent> {
    const timeout = 300_000
    const minInterval = 2_000
    const maxInterval = 15_000
    const startTime = Date.now()
    let attempt = 0

    while (Date.now() - startTime < timeout) {
      try {
        const receipt = (await this.rpc({
          method: 'eth_getTransactionReceipt',
          params: [hash],
        })) as { blockNumber: string; status: string; gasUsed: string } | null

        if (receipt?.blockNumber) {
          const currentBlock = (await this.rpc({ method: 'eth_blockNumber' })) as string
          const receiptBlock = Number.parseInt(receipt.blockNumber, 16)
          const currentBlockNum = Number.parseInt(currentBlock, 16)

          if (currentBlockNum - receiptBlock >= confirmations - 1) {
            const confirmedEvent: TransactionConfirmedEvent = {
              hash,
              blockNumber: receiptBlock,
              status: receipt.status === '0x1' ? 'success' : 'reverted',
              gasUsed: BigInt(receipt.gasUsed),
            }
            this.emit('transactionConfirmed', confirmedEvent)
            return confirmedEvent
          }
        }
      } catch (err) {
        log.warn('Error polling transaction receipt:', err)
      }

      const delay = Math.min(minInterval * 2 ** attempt, maxInterval)
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt++
    }

    throw new Error(`Transaction ${hash} was not confirmed within timeout`)
  }

  async getBalance(address?: Address): Promise<bigint> {
    const targetAddress = address ?? this.account
    if (!targetAddress) throw new Error('No account specified')
    const balance = (await this.rpc({
      method: 'eth_getBalance',
      params: [targetAddress, 'latest'],
    })) as string
    return BigInt(balance)
  }

  // ============================================================================
  // Event System
  // ============================================================================

  on(event: 'connect', listener: (info: ProviderConnectInfo) => void): () => void
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): () => void
  on(event: 'accountsChanged', listener: (accounts: Address[]) => void): () => void
  on(event: 'chainChanged', listener: (chainId: string) => void): () => void
  on(event: 'statusChanged', listener: (status: ConnectionStatus) => void): () => void
  on(event: 'transactionSent', listener: (event: TransactionSentEvent) => void): () => void
  on(event: 'transactionConfirmed', listener: (event: TransactionConfirmedEvent) => void): () => void
  on(event: 'assetsChanged', listener: (event: AssetsChangedEvent) => void): () => void
  // biome-ignore lint/suspicious/noExplicitAny: overload implementation requires widest type
  on(event: string, listener: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
    return () => { this.eventListeners.get(event)?.delete(listener) }
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (!listeners) return
    for (const listener of listeners) {
      try {
        listener(data)
      } catch (error) {
        log.error(`Error in ${event} listener:`, error)
      }
    }
  }

  getProvider(): EIP1193Provider {
    return this.provider
  }

  removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this.eventListeners.get(event)?.delete(listener as EventListener)
    // biome-ignore lint/suspicious/noExplicitAny: viem's removeListener requires keyof EIP1193EventMap
    this.provider.removeListener(event as any, listener as any)
  }

  // ============================================================================
  // Convenience Event Methods
  // ============================================================================

  onConnect(handler: (info: ProviderConnectInfo) => void): () => void {
    return this.on('connect', handler)
  }

  onDisconnect(handler: (error: ProviderRpcError) => void): () => void {
    return this.on('disconnect', handler)
  }

  onAccountChange(handler: (accounts: Address[]) => void): () => void {
    return this.on('accountsChanged', handler)
  }

  onNetworkChange(handler: (chainId: string) => void): () => void {
    return this.on('chainChanged', handler)
  }

  onTransactionSent(handler: (event: TransactionSentEvent) => void): () => void {
    return this.on('transactionSent', handler as EventListener)
  }

  onTransactionConfirmed(handler: (event: TransactionConfirmedEvent) => void): () => void {
    return this.on('transactionConfirmed', handler as EventListener)
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    return this.on('statusChanged', handler)
  }

  // ============================================================================
  // StableNet Custom RPC Methods
  // ============================================================================

  async signAuthorization(authorization: {
    chainId: bigint | number
    address: Address
    nonce: bigint | number
  }): Promise<{ chainId: bigint; address: Address; nonce: bigint; r: Hash; s: Hash; v: number }> {
    return this.rpc({ method: 'wallet_signAuthorization', params: [authorization] })
  }

  async getDelegationStatus(address?: Address): Promise<{
    isDelegated: boolean; delegate: Address | null; chainId: number; nonce: bigint
  }> {
    const targetAddress = address ?? this.account
    if (!targetAddress) throw new Error('No account specified')
    return this.rpc({ method: 'wallet_getDelegationStatus', params: [{ address: targetAddress }] })
  }

  async getInstalledModules(account?: Address): Promise<
    { address: Address; type: number; initData: Hash; installedAt: number; isActive: boolean }[]
  > {
    return this.rpc({ method: 'wallet_getInstalledModules', params: [{ account: account ?? this.account }] })
  }

  async createSessionKey(config: {
    sessionKey: Address
    validFrom: number
    validUntil: number
    permissions: { target: Address; selectors?: Hash[]; maxValue?: bigint }[]
  }): Promise<{ sessionKey: Address; signature: Hash; validUntil: number; installTxHash?: Hash }> {
    return this.rpc({ method: 'wallet_createSessionKey', params: [config] })
  }

  async generateStealthAddress(recipientMeta: Address): Promise<{
    stealthAddress: Address; ephemeralPubKey: Hash; viewTag: Hash
  }> {
    return this.rpc({ method: 'wallet_generateStealthAddress', params: [{ recipientMeta }] })
  }

  async scanStealthPayments(options?: { fromBlock?: number; toBlock?: number }): Promise<
    { stealthAddress: Address; ephemeralPubKey: Hash; txHash: Hash; blockNumber: number; amount: bigint; token: Address; timestamp: number }[]
  > {
    return this.rpc({ method: 'wallet_scanStealthPayments', params: [options ?? {}] })
  }

  async getStealthMetaAddress(): Promise<{
    spendingPubKey: Hash; viewingPubKey: Hash; metaAddress: Address
  }> {
    return this.rpc({ method: 'wallet_getStealthMetaAddress', params: [{ account: this.account }] })
  }

  // ============================================================================
  // Wallet Asset Methods
  // ============================================================================

  /**
   * Get wallet assets (native + ERC-20 tokens) for the connected account.
   * Calls the wallet extension's wallet_getAssets RPC method.
   */
  async getAssets(): Promise<WalletAssetsResponse> {
    return this.rpc({ method: 'wallet_getAssets', params: [] })
  }

  /**
   * Add a custom token to the wallet's tracked token list.
   */
  async addToken(params: AddTokenParams): Promise<AddTokenResult> {
    return this.rpc({ method: 'wallet_addToken', params: [params] })
  }

  /**
   * Subscribe to asset changes (token added/removed, balance changed).
   * Returns an unsubscribe function.
   */
  onAssetsChanged(handler: (event: AssetsChangedEvent) => void): () => void {
    return this.on('assetsChanged', handler)
  }

  // ============================================================================
  // EIP-4337 Account Abstraction Methods
  // ============================================================================

  async sendUserOperation(userOp: UserOperationRequest, entryPoint: Address): Promise<Hash> {
    return (await this.rpc({ method: 'wallet_sendUserOperation', params: [userOp, entryPoint] })) as Hash
  }

  async estimateUserOperationGas(
    userOp: UserOperationRequest, entryPoint: Address
  ): Promise<UserOperationGasEstimate> {
    return this.rpc({ method: 'wallet_estimateUserOperationGas', params: [userOp, entryPoint] })
  }

  async getUserOperationReceipt(userOpHash: Hash): Promise<UserOperationReceipt | null> {
    return this.rpc({ method: 'wallet_getUserOperationReceipt', params: [userOpHash] })
  }

  async waitForUserOperation(
    userOpHash: Hash,
    options?: { timeout?: number; pollingInterval?: number }
  ): Promise<UserOperationReceipt> {
    const timeout = options?.timeout ?? 300_000
    const baseInterval = options?.pollingInterval ?? 2_000
    const startTime = Date.now()
    let attempts = 0

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash)
      if (receipt) return receipt
      attempts++
      const delay = Math.min(baseInterval * 2 ** Math.min(attempts - 1, 4), 15_000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    throw new Error(`Timeout waiting for UserOperation ${userOpHash} after ${timeout}ms`)
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private setupEventListeners(): void {
    const addProviderListener = (event: string, listener: (...args: unknown[]) => void) => {
      this.provider.on(event as 'connect', listener as (connectInfo: ProviderConnectInfo) => void)
      this.providerListeners.push({ event, listener })
    }

    addProviderListener('connect', (connectInfo: unknown) => {
      const info = connectInfo as ProviderConnectInfo
      this.chainManager.setChainId(info.chainId)
      // EIP-1193: 'connect' means provider is connected to a chain
      this.connectionManager.markConnected()
      this.emit('connect', info)
    })

    addProviderListener('disconnect', (error: unknown) => {
      this.connectionManager.disconnect()
      this.emit('disconnect', error)
    })

    addProviderListener('accountsChanged', (accounts: unknown) => {
      const accountList = filterValidAddresses(accounts as Address[])
      this.connectionManager.handleAccountsChanged(accountList)
    })

    addProviderListener('chainChanged', (chainId: unknown) => {
      this.chainManager.handleChainChanged(chainId as string)
    })

    // StableNet custom event: asset changes (token add/remove, balance change)
    addProviderListener('assetsChanged', (data: unknown) => {
      this.emit('assetsChanged', data as AssetsChangedEvent)
    })
  }

  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true

    for (const { event, listener } of this.providerListeners) {
      // biome-ignore lint/suspicious/noExplicitAny: viem's removeListener requires keyof EIP1193EventMap
      this.provider.removeListener(event as any, listener as any)
    }
    this.providerListeners = []
    this.eventListeners.clear()
    this.connectionManager.disconnect()
    this.chainManager.reset()
  }
}
