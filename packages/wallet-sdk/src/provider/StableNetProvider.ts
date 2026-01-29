import type { Address } from 'viem'
import type {
  EIP1193Provider,
  ConnectInfo,
  ProviderRpcError,
  TransactionRequest,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener = (...args: any[]) => void

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
    return Number.parseInt(this._chainId, 16)
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    this.provider.on('connect', (info: unknown) => {
      const connectInfo = info as ConnectInfo
      this._isConnected = true
      this._chainId = connectInfo.chainId
      this.emit('connect', connectInfo)
    })

    this.provider.on('disconnect', (error: unknown) => {
      this._isConnected = false
      this._account = null
      this.emit('disconnect', error as ProviderRpcError)
    })

    this.provider.on('accountsChanged', (accounts: unknown) => {
      const accountList = accounts as Address[]
      this._account = accountList[0] ?? null
      this._isConnected = accountList.length > 0
      this.emit('accountsChanged', accountList)
    })

    this.provider.on('chainChanged', (chainId: unknown) => {
      this._chainId = chainId as string
      this.emit('chainChanged', chainId as string)
    })
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<Address[]> {
    const accounts = await this.provider.request({
      method: 'eth_requestAccounts',
    }) as Address[]

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
    const accounts = await this.provider.request({
      method: 'eth_accounts',
    }) as Address[]
    return accounts
  }

  /**
   * Get current chain ID
   */
  async getChainId(): Promise<string> {
    const chainId = await this.provider.request({
      method: 'eth_chainId',
    }) as string
    return chainId
  }

  /**
   * Switch to a different chain
   */
  async switchChain(chainId: number): Promise<void> {
    await this.provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    const signature = await this.provider.request({
      method: 'personal_sign',
      params: [message, this._account],
    }) as string

    return signature
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: object): Promise<string> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    const signature = await this.provider.request({
      method: 'eth_signTypedData_v4',
      params: [this._account, JSON.stringify(typedData)],
    }) as string

    return signature
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<string> {
    if (!this._account) {
      throw new Error('No account connected')
    }

    const txHash = await this.provider.request({
      method: 'eth_sendTransaction',
      params: [{
        ...tx,
        from: tx.from ?? this._account,
        value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : undefined,
        gas: tx.gas ? `0x${BigInt(tx.gas).toString(16)}` : undefined,
        gasPrice: tx.gasPrice ? `0x${BigInt(tx.gasPrice).toString(16)}` : undefined,
        maxFeePerGas: tx.maxFeePerGas ? `0x${BigInt(tx.maxFeePerGas).toString(16)}` : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? `0x${BigInt(tx.maxPriorityFeePerGas).toString(16)}` : undefined,
      }],
    }) as string

    return txHash
  }

  /**
   * Get account balance
   */
  async getBalance(address?: Address): Promise<bigint> {
    const targetAddress = address ?? this._account
    if (!targetAddress) {
      throw new Error('No account specified')
    }

    const balance = await this.provider.request({
      method: 'eth_getBalance',
      params: [targetAddress, 'latest'],
    }) as string

    return BigInt(balance)
  }

  /**
   * Subscribe to events
   */
  on(event: 'connect', listener: (info: ConnectInfo) => void): () => void
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): () => void
  on(event: 'accountsChanged', listener: (accounts: Address[]) => void): () => void
  on(event: 'chainChanged', listener: (chainId: string) => void): () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          console.error(`Error in ${event} listener:`, error)
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
}
