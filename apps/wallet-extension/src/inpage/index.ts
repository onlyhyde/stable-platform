/**
 * StableNet Wallet Inpage Provider
 *
 * This script is injected into web pages and provides an EIP-1193 compatible
 * Ethereum provider interface at window.stablenet (and optionally window.ethereum)
 */

import type { EIP1193Provider, ExtensionMessage, JsonRpcRequest, JsonRpcResponse } from '../types'
import { MESSAGE_TYPES, PROVIDER_EVENTS } from '../shared/constants'

type EventListener = (...args: unknown[]) => void

/**
 * StableNet Provider Class
 * Implements EIP-1193 Ethereum Provider interface
 */
class StableNetProvider implements EIP1193Provider {
  readonly isStableNet = true
  chainId: string | null = null
  selectedAddress: string | null = null

  private eventListeners: Map<string, Set<EventListener>> = new Map()
  private requestId = 0
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map()

  constructor() {
    this.setupMessageListener()
    this.initialize()
  }

  /**
   * Initialize provider state
   */
  private async initialize(): Promise<void> {
    try {
      // Get initial chain ID
      const chainId = await this.request({ method: 'eth_chainId' })
      this.chainId = chainId as string

      // Get initial accounts (if already connected)
      const accounts = await this.request({ method: 'eth_accounts' })
      if (Array.isArray(accounts) && accounts.length > 0) {
        this.selectedAddress = accounts[0] as string
      }
    } catch {
      // Initialization might fail if not connected
    }
  }

  /**
   * Set up message listener for responses from content script
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      if (event.data?.target !== 'stablenet-inpage') return

      const message = event.data.data as ExtensionMessage

      switch (message.type) {
        case MESSAGE_TYPES.RPC_RESPONSE: {
          const pending = this.pendingRequests.get(message.id)
          if (pending) {
            const response = message.payload as JsonRpcResponse
            if (response.error) {
              pending.reject(new ProviderError(response.error.message, response.error.code))
            } else {
              pending.resolve(response.result)
            }
            this.pendingRequests.delete(message.id)
          }
          break
        }

        case MESSAGE_TYPES.STATE_UPDATE: {
          const payload = message.payload as {
            chainId?: string
            accounts?: string[]
          }

          // Handle chain change
          if (payload.chainId && payload.chainId !== this.chainId) {
            this.chainId = payload.chainId
            this.emit(PROVIDER_EVENTS.CHAIN_CHANGED, payload.chainId)
          }

          // Handle accounts change
          if (payload.accounts) {
            const newSelectedAddress = payload.accounts[0] ?? null
            if (newSelectedAddress !== this.selectedAddress) {
              this.selectedAddress = newSelectedAddress
              this.emit(PROVIDER_EVENTS.ACCOUNTS_CHANGED, payload.accounts)
            }
          }
          break
        }
      }
    })
  }

  /**
   * Send an RPC request (EIP-1193)
   */
  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const { method, params } = args

    const id = `${++this.requestId}-${Date.now()}`

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    const message: ExtensionMessage = {
      type: MESSAGE_TYPES.RPC_REQUEST,
      id,
      payload: request,
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      // Send to content script
      window.postMessage(
        {
          target: 'stablenet-contentscript',
          data: message,
        },
        window.location.origin
      )

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new ProviderError('Request timeout', -32000))
        }
      }, 60000)
    })
  }

  /**
   * Subscribe to events (EIP-1193)
   */
  on(event: string, listener: EventListener): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(listener)
    return this
  }

  /**
   * Unsubscribe from events (EIP-1193)
   */
  removeListener(event: string, listener: EventListener): this {
    this.eventListeners.get(event)?.delete(listener)
    return this
  }

  /**
   * Alias for removeListener
   */
  off(event: string, listener: EventListener): this {
    return this.removeListener(event, listener)
  }

  /**
   * Subscribe once (EIP-1193)
   */
  once(event: string, listener: EventListener): this {
    const onceListener: EventListener = (...args) => {
      this.removeListener(event, onceListener)
      listener(...args)
    }
    return this.on(event, onceListener)
  }

  /**
   * Emit an event
   */
  private emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      try {
        listener(...args)
      } catch {
        // Listener error
      }
    })
  }

  /**
   * Legacy method: enable (deprecated but some dApps still use it)
   */
  async enable(): Promise<string[]> {
    return this.request({ method: 'eth_requestAccounts' }) as Promise<string[]>
  }

  /**
   * Legacy method: send (deprecated but some dApps still use it)
   */
  send(
    methodOrPayload: string | JsonRpcRequest,
    paramsOrCallback?: unknown[] | ((error: Error | null, response?: JsonRpcResponse) => void)
  ): Promise<unknown> | undefined {
    if (typeof methodOrPayload === 'string') {
      // New signature: send(method, params)
      return this.request({
        method: methodOrPayload,
        params: paramsOrCallback as unknown[],
      })
    }

    // Old signature: send(payload, callback)
    const payload = methodOrPayload
    const callback = paramsOrCallback as (
      error: Error | null,
      response?: JsonRpcResponse
    ) => void

    this.request({ method: payload.method, params: payload.params as unknown[] })
      .then((result) => {
        callback(null, {
          jsonrpc: '2.0',
          id: payload.id,
          result,
        })
      })
      .catch((error) => {
        callback(error as Error)
      })
  }

  /**
   * Legacy method: sendAsync (deprecated but some dApps still use it)
   */
  sendAsync(
    payload: JsonRpcRequest,
    callback: (error: Error | null, response?: JsonRpcResponse) => void
  ): void {
    this.request({ method: payload.method, params: payload.params as unknown[] })
      .then((result) => {
        callback(null, {
          jsonrpc: '2.0',
          id: payload.id,
          result,
        })
      })
      .catch((error) => {
        callback(error as Error)
      })
  }
}

/**
 * Provider Error class
 */
class ProviderError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.code = code
    this.name = 'ProviderError'
  }
}

// Create and expose the provider
const provider = new StableNetProvider()

// Expose at window.stablenet
Object.defineProperty(window, 'stablenet', {
  value: provider,
  writable: false,
  configurable: false,
})

// Announce provider (EIP-6963)
announceProvider(provider)

/**
 * Announce provider via EIP-6963
 */
function announceProvider(provider: StableNetProvider): void {
  const info = {
    uuid: 'stablenet-wallet',
    name: 'StableNet Wallet',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%234F46E5"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-family="Arial">S</text></svg>',
    rdns: 'dev.stablenet.wallet',
  }

  const detail = Object.freeze({ info, provider })

  // Dispatch announce event
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail,
    })
  )

  // Listen for request events
  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail,
      })
    )
  })
}

// Declare window types
declare global {
  interface Window {
    stablenet: StableNetProvider
    ethereum?: StableNetProvider
  }
}
