import type { Address, Hash, EIP1193Provider, ProviderConnectInfo, ProviderRpcError } from 'viem'
import { walletSdkLogger } from '../logger'
import type { StableNetRpcSchema, UserOperationGasEstimate, UserOperationReceipt, UserOperationRequest } from '../rpc'
import type { TransactionRequest } from '../types'
import { filterValidAddresses, parseChainIdHex } from '../validation'

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
 * Extended provider events including transaction lifecycle
 */
export type StableNetProviderEvent =
  | 'connect'
  | 'disconnect'
  | 'accountsChanged'
  | 'chainChanged'
  | 'transactionSent'
  | 'transactionConfirmed'

/**
 * StableNet Provider wrapper
 *
 * Provides a typed interface over the EIP-1193 provider
 * with automatic state synchronization and event handling.
 */
export class StableNetProvider {
  private provider: EIP1193Provider
  private eventListeners: Map<string, Set<EventListener>> = new Map()

  // Current state
  private _isConnected = false
  private _account: Address | null = null
  private _chainId: string | null = null

  constructor(provider: EIP1193Provider) {
    this.provider = provider
    this.setupEventListeners()
  }

  /**
   * Internal RPC request helper for arbitrary methods (standard + custom).
   * Bypasses viem's strict method typing for flexibility.
   */
  // biome-ignore lint/suspicious/noExplicitAny: allows arbitrary RPC methods beyond viem's typed set
  private rpc(args: { method: string; params?: unknown[] | object }): Promise<any> {
    // biome-ignore lint/suspicious/noExplicitAny: forwarding arbitrary RPC args
    return this.provider.request(args as any)
  }

  /**
   * Type-safe request for StableNet custom RPC methods.
   *
   * @example
   * ```typescript
   * const signed = await provider.stableNetRequest(
   *   'wallet_signAuthorization',
   *   { authorization: { chainId: 1, address: '0x...', nonce: 0n } }
   * )
   * ```
   */
  async stableNetRequest<M extends keyof StableNetRpcSchema>(
    method: M,
    params: StableNetRpcSchema[M]['params']
  ): Promise<StableNetRpcSchema[M]['result']> {
    return this.rpc({ method, params: [params] })
  }

  // State getters
  get isConnected(): boolean {
    return this._isConnected
  }

  get account(): Address | null {
    return this._account
  }

  get chainId(): string | null {
    return this._chainId
  }

  get chainIdNumber(): number | null {
    if (!this._chainId) return null
    const parsed = parseChainIdHex(this._chainId)
    return Number.isNaN(parsed) ? null : parsed
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    this.provider.on('connect', (connectInfo: ProviderConnectInfo) => {
      this._isConnected = true
      this._chainId = connectInfo.chainId
      this.emit('connect', connectInfo)
    })

    this.provider.on('disconnect', (error: ProviderRpcError) => {
      this._isConnected = false
      this._account = null
      this.emit('disconnect', error)
    })

    this.provider.on('accountsChanged', (accounts: Address[]) => {
      const accountList = filterValidAddresses(accounts)
      this._account = accountList[0] ?? null
      this._isConnected = accountList.length > 0
      this.emit('accountsChanged', accountList)
    })

    this.provider.on('chainChanged', (chainId: string) => {
      this._chainId = chainId
      this.emit('chainChanged', chainId)
    })
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<Address[]> {
    const result = await this.rpc({
      method: 'eth_requestAccounts',
    })
    const accounts = Array.isArray(result) ? filterValidAddresses(result) : []

    if (accounts.length > 0) {
      this._account = accounts[0]
      this._isConnected = true
    }

    // Get chain ID
    const chainId = await this.getChainId()
    this._chainId = chainId

    return accounts
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    // Note: There's no standard RPC method for disconnecting
    // This is typically handled by the wallet UI
    // We reset local state
    this._isConnected = false
    this._account = null
  }

  /**
   * Get connected accounts
   */
  async getAccounts(): Promise<Address[]> {
    const result = await this.rpc({
      method: 'eth_accounts',
    })
    return Array.isArray(result) ? filterValidAddresses(result) : []
  }

  /**
   * Get current chain ID
   */
  async getChainId(): Promise<string> {
    const result = await this.rpc({
      method: 'eth_chainId',
    })
    return typeof result === 'string' ? result : String(result)
  }

  /**
   * Add a new chain to the wallet
   */
  async addChain(chain: {
    chainId: number
    chainName: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    rpcUrls: readonly string[]
    blockExplorerUrls?: string[]
    iconUrls?: string[]
  }): Promise<void> {
    await this.rpc({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${chain.chainId.toString(16)}`,
          chainName: chain.chainName,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls,
          blockExplorerUrls: chain.blockExplorerUrls,
          iconUrls: chain.iconUrls,
        },
      ],
    })
  }

  /**
   * Switch to a different chain.
   * If the chain is not added (4902 error), automatically attempts
   * to add it first using the provided chain config.
   */
  async switchChain(
    chainId: number,
    addChainConfig?: {
      chainName: string
      nativeCurrency: { name: string; symbol: string; decimals: number }
      rpcUrls: readonly string[]
      blockExplorerUrls?: string[]
      iconUrls?: string[]
    },
  ): Promise<void> {
    try {
      await this.rpc({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
    } catch (err) {
      const error = err as { code?: number; data?: { originalError?: { code?: number } } }
      const isChainNotAdded =
        error.code === 4902 || error.data?.originalError?.code === 4902

      if (isChainNotAdded && addChainConfig) {
        await this.addChain({ chainId, ...addChainConfig })
        return
      }

      throw err
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    const signature = (await this.rpc({
      method: 'personal_sign',
      params: [message, this._account],
    })) as string

    return signature
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: object): Promise<string> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    let serialized: string
    try {
      serialized = JSON.stringify(typedData)
    } catch {
      throw new Error('Failed to serialize typed data: ensure the object is JSON-serializable')
    }

    const signature = (await this.rpc({
      method: 'eth_signTypedData_v4',
      params: [this._account, serialized],
    })) as string

    return signature
  }

  /**
   * Send a transaction
   * Emits 'transactionSent' event immediately and optionally waits for confirmation
   */
  async sendTransaction(
    tx: TransactionRequest,
    options?: { waitForConfirmation?: boolean }
  ): Promise<Hash> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    const txHash = (await this.rpc({
      method: 'eth_sendTransaction',
      params: [
        {
          ...tx,
          from: tx.from ?? this._account,
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

    // Emit transaction sent event
    const sentEvent: TransactionSentEvent = {
      hash: txHash,
      from: tx.from ?? this._account,
      to: tx.to,
      value: tx.value ? BigInt(tx.value) : undefined,
      chainId: this.chainIdNumber ?? 1,
    }
    this.emit('transactionSent', sentEvent)

    // Optionally wait for confirmation
    if (options?.waitForConfirmation) {
      this.waitForTransaction(txHash).catch((error) => {
        walletSdkLogger.error('Transaction confirmation error:', error)
      })
    }

    return txHash
  }

  /**
   * Wait for a transaction to be confirmed
   * Emits 'transactionConfirmed' event when the transaction is mined
   */
  async waitForTransaction(hash: Hash, confirmations = 1): Promise<TransactionConfirmedEvent> {
    const timeout = 300_000 // 5 minutes
    const minInterval = 2_000
    const maxInterval = 15_000
    const startTime = Date.now()

    let attempt = 0
    while (Date.now() - startTime < timeout) {
      try {
        const receipt = (await this.rpc({
          method: 'eth_getTransactionReceipt',
          params: [hash],
        })) as {
          blockNumber: string
          status: string
          gasUsed: string
        } | null

        if (receipt?.blockNumber) {
          const currentBlock = (await this.rpc({
            method: 'eth_blockNumber',
          })) as string

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
        // Log unexpected errors (network failures, provider issues) but continue polling
        walletSdkLogger.warn('Error polling transaction receipt:', err)
      }

      // Exponential backoff: 2s, 4s, 8s, 15s, 15s, ...
      const delay = Math.min(minInterval * 2 ** attempt, maxInterval)
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt++
    }

    throw new Error(`Transaction ${hash} was not confirmed within timeout`)
  }

  /**
   * Get account balance
   */
  async getBalance(address?: Address): Promise<bigint> {
    const targetAddress = address ?? this._account
    if (!targetAddress) {
      throw new Error('No account specified')
    }

    const balance = (await this.rpc({
      method: 'eth_getBalance',
      params: [targetAddress, 'latest'],
    })) as string

    return BigInt(balance)
  }

  /**
   * Subscribe to events
   */
  on(event: 'connect', listener: (info: ProviderConnectInfo) => void): () => void
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): () => void
  on(event: 'accountsChanged', listener: (accounts: Address[]) => void): () => void
  on(event: 'chainChanged', listener: (chainId: string) => void): () => void
  on(event: 'transactionSent', listener: (event: TransactionSentEvent) => void): () => void
  on(
    event: 'transactionConfirmed',
    listener: (event: TransactionConfirmedEvent) => void
  ): () => void
  // biome-ignore lint/suspicious/noExplicitAny: overload implementation requires widest type
  on(event: string, listener: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(listener)
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (error) {
          walletSdkLogger.error(`Error in ${event} listener:`, error)
        }
      }
    }
  }

  /**
   * Get the underlying EIP-1193 provider
   */
  getProvider(): EIP1193Provider {
    return this.provider
  }

  /**
   * Generic RPC request method
   */
  async request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T> {
    return this.rpc(args) as Promise<T>
  }

  /**
   * Remove event listener
   */
  removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this.eventListeners.get(event)?.delete(listener as EventListener)
    // biome-ignore lint/suspicious/noExplicitAny: viem's removeListener requires keyof EIP1193EventMap
    this.provider.removeListener(event as any, listener as any)
  }

  // ============================================================================
  // Convenience Event Methods (on-prefix)
  // ============================================================================

  /**
   * Subscribe to connect events
   * @returns Unsubscribe function
   */
  onConnect(handler: (info: ProviderConnectInfo) => void): () => void {
    return this.on('connect', handler)
  }

  /**
   * Subscribe to disconnect events
   * @returns Unsubscribe function
   */
  onDisconnect(handler: (error: ProviderRpcError) => void): () => void {
    return this.on('disconnect', handler)
  }

  /**
   * Subscribe to account change events
   * @returns Unsubscribe function
   */
  onAccountChange(handler: (accounts: Address[]) => void): () => void {
    return this.on('accountsChanged', handler)
  }

  /**
   * Subscribe to network/chain change events
   * @returns Unsubscribe function
   */
  onNetworkChange(handler: (chainId: string) => void): () => void {
    return this.on('chainChanged', handler)
  }

  /**
   * Subscribe to transaction sent events
   * Emitted immediately when a transaction is submitted to the network
   * @returns Unsubscribe function
   */
  onTransactionSent(handler: (event: TransactionSentEvent) => void): () => void {
    return this.on('transactionSent', handler as EventListener)
  }

  /**
   * Subscribe to transaction confirmation events
   * Emitted when a transaction is confirmed on-chain
   * @returns Unsubscribe function
   */
  onTransactionConfirmed(handler: (event: TransactionConfirmedEvent) => void): () => void {
    return this.on('transactionConfirmed', handler as EventListener)
  }

  // ============================================================================
  // StableNet Custom RPC Methods
  // ============================================================================

  /**
   * Sign an EIP-7702 authorization
   * Allows the user to delegate their EOA to a smart contract
   */
  async signAuthorization(authorization: {
    chainId: bigint | number
    address: Address
    nonce: bigint | number
  }): Promise<{
    chainId: bigint
    address: Address
    nonce: bigint
    r: Hash
    s: Hash
    v: number
  }> {
    const result = await this.rpc({
      method: 'wallet_signAuthorization',
      params: [authorization],
    })
    return result as {
      chainId: bigint
      address: Address
      nonce: bigint
      r: Hash
      s: Hash
      v: number
    }
  }

  /**
   * Get the delegation status of an account
   */
  async getDelegationStatus(address?: Address): Promise<{
    isDelegated: boolean
    delegate: Address | null
    chainId: number
    nonce: bigint
  }> {
    const targetAddress = address ?? this._account
    if (!targetAddress) {
      throw new Error('No account specified')
    }

    const result = await this.rpc({
      method: 'wallet_getDelegationStatus',
      params: [{ address: targetAddress }],
    })
    return result as {
      isDelegated: boolean
      delegate: Address | null
      chainId: number
      nonce: bigint
    }
  }

  /**
   * Get installed ERC-7579 modules for the account
   */
  async getInstalledModules(account?: Address): Promise<
    {
      address: Address
      type: number
      initData: Hash
      installedAt: number
      isActive: boolean
    }[]
  > {
    const result = await this.rpc({
      method: 'wallet_getInstalledModules',
      params: [{ account: account ?? this._account }],
    })
    return result as {
      address: Address
      type: number
      initData: Hash
      installedAt: number
      isActive: boolean
    }[]
  }

  /**
   * Create a session key for delegated signing
   */
  async createSessionKey(config: {
    sessionKey: Address
    validFrom: number
    validUntil: number
    permissions: {
      target: Address
      selectors?: Hash[]
      maxValue?: bigint
    }[]
  }): Promise<{
    sessionKey: Address
    signature: Hash
    validUntil: number
    installTxHash?: Hash
  }> {
    const result = await this.rpc({
      method: 'wallet_createSessionKey',
      params: [config],
    })
    return result as {
      sessionKey: Address
      signature: Hash
      validUntil: number
      installTxHash?: Hash
    }
  }

  /**
   * Generate a stealth address for private payments (EIP-5564)
   */
  async generateStealthAddress(recipientMeta: Address): Promise<{
    stealthAddress: Address
    ephemeralPubKey: Hash
    viewTag: Hash
  }> {
    const result = await this.rpc({
      method: 'wallet_generateStealthAddress',
      params: [{ recipientMeta }],
    })
    return result as {
      stealthAddress: Address
      ephemeralPubKey: Hash
      viewTag: Hash
    }
  }

  /**
   * Scan for stealth payments received
   */
  async scanStealthPayments(options?: { fromBlock?: number; toBlock?: number }): Promise<
    {
      stealthAddress: Address
      ephemeralPubKey: Hash
      txHash: Hash
      blockNumber: number
      amount: bigint
      token: Address
      timestamp: number
    }[]
  > {
    const result = await this.rpc({
      method: 'wallet_scanStealthPayments',
      params: [options ?? {}],
    })
    return result as {
      stealthAddress: Address
      ephemeralPubKey: Hash
      txHash: Hash
      blockNumber: number
      amount: bigint
      token: Address
      timestamp: number
    }[]
  }

  /**
   * Get the stealth meta-address for this account
   */
  async getStealthMetaAddress(): Promise<{
    spendingPubKey: Hash
    viewingPubKey: Hash
    metaAddress: Address
  }> {
    const result = await this.rpc({
      method: 'wallet_getStealthMetaAddress',
      params: [{ account: this._account }],
    })
    return result as {
      spendingPubKey: Hash
      viewingPubKey: Hash
      metaAddress: Address
    }
  }

  // ============================================================================
  // EIP-4337 Account Abstraction Methods
  // ============================================================================

  /**
   * Submit a UserOperation to the bundler via the wallet
   */
  async sendUserOperation(
    userOp: UserOperationRequest,
    entryPoint: Address
  ): Promise<Hash> {
    const result = await this.rpc({
      method: 'wallet_sendUserOperation',
      params: [userOp, entryPoint],
    })
    return result as Hash
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimateUserOperationGas(
    userOp: UserOperationRequest,
    entryPoint: Address
  ): Promise<UserOperationGasEstimate> {
    const result = await this.rpc({
      method: 'wallet_estimateUserOperationGas',
      params: [userOp, entryPoint],
    })
    return result as UserOperationGasEstimate
  }

  /**
   * Get the receipt for a UserOperation by its hash
   */
  async getUserOperationReceipt(
    userOpHash: Hash
  ): Promise<UserOperationReceipt | null> {
    const result = await this.rpc({
      method: 'wallet_getUserOperationReceipt',
      params: [userOpHash],
    })
    return result as UserOperationReceipt | null
  }

  /**
   * Wait for a UserOperation to be included in a block
   * Polls getUserOperationReceipt with exponential backoff
   */
  async waitForUserOperation(
    userOpHash: Hash,
    options?: { timeout?: number; pollingInterval?: number }
  ): Promise<UserOperationReceipt> {
    const timeout = options?.timeout ?? 300_000 // 5 minutes
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

    throw new Error(
      `Timeout waiting for UserOperation ${userOpHash} after ${timeout}ms`
    )
  }
}
