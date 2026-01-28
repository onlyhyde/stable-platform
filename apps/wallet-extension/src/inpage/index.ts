/**
 * StableNet Wallet Inpage Provider
 *
 * This script is injected into web pages and provides an EIP-1193 compatible
 * Ethereum provider interface at window.stablenet (and optionally window.ethereum)
 *
 * Features:
 * - EIP-1193 Ethereum Provider
 * - EIP-6963 Provider Announcement for multi-wallet discovery
 * - MetaMask Compatibility Mode for legacy dApp support
 */

import type { EIP1193Provider, ExtensionMessage, JsonRpcRequest, JsonRpcResponse } from '../types'
import { MESSAGE_TYPES, PROVIDER_EVENTS } from '../shared/constants'
import { createLogger } from '../shared/utils/logger'

// Logger for inpage provider
const logger = createLogger('InpageProvider')

type EventListener = (...args: unknown[]) => void

// Read MetaMask appearance mode from localStorage
let appearAsMetaMask = false
try {
  const stored = window.localStorage.getItem('__stablenetAppearAsMM__')
  appearAsMetaMask = stored ? JSON.parse(stored) : false
} catch {
  appearAsMetaMask = false
}

// Track current mode for dynamic updates
let currentMetaMaskMode = appearAsMetaMask

/**
 * Generate a deterministic UUID for EIP-6963
 * Uses a fixed UUID for consistent wallet identification
 */
const WALLET_UUID = 'd8f3b2a1-5c4e-4f6d-9a8b-7e1c2d3f4a5b'

/**
 * Wallet info for EIP-6963 announcement
 * Made mutable to support dynamic MetaMask mode switching
 */
let walletInfo = {
  uuid: WALLET_UUID,
  name: appearAsMetaMask ? 'MetaMask' : 'StableNet Wallet',
  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM0RjQ2RTUiLz48dGV4dCB4PSIxNiIgeT0iMjEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0iQXJpYWwiPjwvdGV4dD48cGF0aCBkPSJNOCAxMmgxNnYySDh6TTggMTZoMTJ2Mkg4ek04IDIwaDh2Mkg4eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
  rdns: appearAsMetaMask ? 'io.metamask' : 'dev.stablenet.wallet',
}

/**
 * Update wallet info for MetaMask mode change
 */
function updateWalletInfo(asMetaMask: boolean): void {
  walletInfo = {
    uuid: WALLET_UUID,
    name: asMetaMask ? 'MetaMask' : 'StableNet Wallet',
    icon: walletInfo.icon,
    rdns: asMetaMask ? 'io.metamask' : 'dev.stablenet.wallet',
  }
}

/**
 * StableNet Provider Class
 * Implements EIP-1193 Ethereum Provider interface
 */
class StableNetProvider implements EIP1193Provider {
  readonly isStableNet = true
  chainId: string | null = null
  selectedAddress: string | null = null

  // MetaMask compatibility flags
  isMetaMask: boolean
  _metamask?: {
    isUnlocked: () => Promise<boolean>
  }

  private eventListeners: Map<string, Set<EventListener>> = new Map()
  private requestId = 0
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map()

  constructor(asMetaMask: boolean = false) {
    this.isMetaMask = asMetaMask

    if (asMetaMask) {
      this._metamask = {
        isUnlocked: () => Promise.resolve(true),
      }
    }

    this.setupMessageListener()
    this.initialize()
  }

  /**
   * Update MetaMask compatibility mode dynamically
   * This allows changing the mode without page refresh
   */
  setMetaMaskMode(enabled: boolean): void {
    this.isMetaMask = enabled

    if (enabled) {
      this._metamask = {
        isUnlocked: () => Promise.resolve(true),
      }
    } else {
      delete this._metamask
    }

    // Update global mode tracker
    currentMetaMaskMode = enabled

    // Update wallet info for EIP-6963
    updateWalletInfo(enabled)

    logger.info(`MetaMask mode ${enabled ? 'enabled' : 'disabled'}`)
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
   * Set max listeners (for compatibility)
   */
  setMaxListeners(_n: number): this {
    // No-op for compatibility
    return this
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

// Create provider with MetaMask compatibility mode if enabled
const provider = new StableNetProvider(appearAsMetaMask)

// Set max listeners to avoid warnings
provider.setMaxListeners(100)

/**
 * Set provider on window.ethereum
 */
function setProvider(): void {
  const existingProvider = Object.getOwnPropertyDescriptor(window, 'ethereum')

  if (existingProvider?.configurable !== false) {
    Object.defineProperty(window, 'ethereum', {
      value: provider,
      writable: true,
      configurable: true,
      enumerable: true,
    })
  } else {
    // If not configurable, try direct assignment
    try {
      window.ethereum = provider
    } catch {
      // Cannot set window.ethereum
    }
  }
}

// Expose at window.stablenet (always)
Object.defineProperty(window, 'stablenet', {
  value: provider,
  writable: false,
  configurable: false,
})

// Set as window.ethereum
setProvider()

// Re-set on document ready state changes (some dApps check early)
document.addEventListener('readystatechange', () => {
  if (document.readyState === 'interactive') {
    setProvider()
  }
})

/**
 * Shim for legacy web3 (deprecated but some dApps still check for it)
 */
function shimWeb3(provider: StableNetProvider, asMetaMask: boolean): void {
  if (window.web3) return

  const SHIM_IDENTIFIER = asMetaMask ? '__isMetaMaskShim__' : '__isStableNetShim__'

  const shim: Record<string, unknown> = { currentProvider: provider }
  Object.defineProperty(shim, SHIM_IDENTIFIER, {
    value: true,
    enumerable: true,
    configurable: false,
    writable: false,
  })

  let loggedCurrentProvider = false
  let loggedWeb3Set = false

  const web3Shim = new Proxy(shim, {
    get: (target, property, ...args) => {
      if (property === 'currentProvider' && !loggedCurrentProvider) {
        loggedCurrentProvider = true
        logger.warn('window.web3.currentProvider is deprecated; use window.ethereum instead')
      } else if (property !== 'currentProvider' && property !== SHIM_IDENTIFIER) {
        logger.warn(`window.web3.${String(property)} is not supported; use window.ethereum instead`)
      }
      return Reflect.get(target, property, ...args)
    },
    set: (...args) => {
      if (!loggedWeb3Set) {
        loggedWeb3Set = true
        logger.warn('window.web3 is deprecated; use window.ethereum instead')
      }
      return Reflect.set(...args)
    },
  })

  Object.defineProperty(window, 'web3', {
    value: web3Shim,
    enumerable: false,
    configurable: true,
    writable: true,
  })
}

// Set up web3 shim
shimWeb3(provider, appearAsMetaMask)

/**
 * EIP-6963: Announce provider for multi-wallet discovery
 * This allows dApps to discover all installed wallets
 */
function announceEIP6963Provider(): void {
  const detail = Object.freeze({
    info: Object.freeze(walletInfo),
    provider,
  })

  // Dispatch announce event
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', { detail })
  )

  // Listen for request events and re-announce
  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', { detail })
    )
  })
}

// Announce via EIP-6963
announceEIP6963Provider()

/**
 * Listen for MetaMask mode change from contentscript
 * This enables dynamic mode switching without page refresh
 */
function listenForMetaMaskModeChange(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.target !== 'stablenet-inpage') return
    if (event.data?.data?.type !== 'METAMASK_MODE_CHANGED') return

    const { enabled } = event.data.data.payload as { enabled: boolean }

    // Only update if mode actually changed
    if (enabled !== currentMetaMaskMode) {
      provider.setMetaMaskMode(enabled)

      // Re-announce via EIP-6963 with updated info
      announceEIP6963Provider()

      // Update window.ethereum reference if needed
      setProvider()

      // Note: web3 shim's currentProvider already points to the same provider object,
      // so it will automatically reflect the updated isMetaMask flag

      logger.info(`MetaMask mode dynamically switched to: ${enabled}`)
    }
  })
}

// Start listening for mode changes
listenForMetaMaskModeChange()

/**
 * Handle embedded actions from extension
 */
const embeddedActions: Record<string, (action: unknown) => Promise<unknown>> = {
  getChainId: async () => ({
    chainId: await provider.request({ method: 'eth_chainId' }),
  }),
}

window.addEventListener('message', async (event) => {
  if (
    event &&
    event.source === window &&
    event.data &&
    event.data.type === 'embedded:action' &&
    window.self === window.top
  ) {
    const action = event.data.action as { type: string }
    const handler = embeddedActions[action.type]
    if (action && handler) {
      const res = await handler(action)
      const payload = { method: 'embedded_action_res', params: [action, res] }
      window.postMessage(
        { target: 'stablenet-contentscript', data: { type: MESSAGE_TYPES.RPC_REQUEST, id: `embedded-${Date.now()}`, payload } },
        window.location.origin
      )
    }
  }
})

// Declare window types
declare global {
  interface Window {
    stablenet: StableNetProvider
    ethereum?: StableNetProvider
    web3?: unknown
  }
}
