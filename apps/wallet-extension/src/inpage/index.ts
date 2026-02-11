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
 *
 * Security:
 * - SEC-2: Configuration passed via data attribute instead of localStorage
 *   to prevent page scripts from reading/modifying wallet settings
 */

import { MESSAGE_TYPES, PROVIDER_EVENTS, TIMING } from '../shared/constants'
import { createLogger } from '../shared/utils/logger'
import { validateExtensionMessage } from '../shared/validation/messageSchema'
import type { EIP1193Provider, ExtensionMessage, JsonRpcRequest, JsonRpcResponse } from '../types'

// Logger for inpage provider
const logger = createLogger('InpageProvider')

type EventListener = (...args: unknown[]) => void

/**
 * Read configuration from the injected script's data attribute
 * SEC-2: Use data attribute instead of localStorage for security
 */
function getInjectedConfig(): { metamaskMode: boolean } {
  try {
    // Find the script element that was injected with our configuration
    const scripts = document.querySelectorAll('script[data-stablenet-config]')
    for (const script of scripts) {
      const configStr = (script as HTMLScriptElement).dataset.stablenetConfig
      if (configStr) {
        return JSON.parse(configStr)
      }
    }
  } catch {
    // Configuration parsing failed
  }
  return { metamaskMode: false }
}

// Read MetaMask appearance mode from injected script data attribute
const injectedConfig = getInjectedConfig()
const appearAsMetaMask = injectedConfig.metamaskMode

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
// StableNet shield logo SVG (base64 encoded)
const STABLENET_ICON_SVG = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#4F46E5"/>
    </linearGradient>
  </defs>
  <path d="M16 18 Q16 12 22 12 L106 12 Q112 12 112 18 L112 76 Q112 86 104 94 L64 116 L24 94 Q16 86 16 76 Z" fill="url(#g)"/>
  <path d="M48 32 L80 32 A16 16 0 0 1 80 64 L48 64 A16 16 0 0 0 48 96 L80 96" stroke="white" stroke-width="10" stroke-linecap="round" fill="none"/>
</svg>`)}`

let walletInfo = {
  uuid: WALLET_UUID,
  name: appearAsMetaMask ? 'MetaMask' : 'StableNet Wallet',
  icon: STABLENET_ICON_SVG,
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

  constructor(asMetaMask = false) {
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
      this._metamask = undefined
    }

    // Update global mode tracker
    currentMetaMaskMode = enabled

    // Update wallet info for EIP-6963
    updateWalletInfo(enabled)

    logger.info(`MetaMask mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Track connection state
   */
  private _isConnected = false

  /**
   * Get connection state (EIP-1193)
   */
  get isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Initialize provider state
   * Checks existing connection and emits connect event if already connected
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
        this._isConnected = true

        // Emit connect event for dApps that listen on page load
        this.emit(PROVIDER_EVENTS.CONNECT, { chainId: this.chainId })
        this.emit(PROVIDER_EVENTS.ACCOUNTS_CHANGED, accounts)

        logger.info('Provider initialized with existing connection', {
          chainId: this.chainId,
          account: this.selectedAddress,
        })
      }
    } catch {
      // Initialization might fail if not connected
      this._isConnected = false
    }
  }

  /**
   * Set up message listener for responses from content script
   * Handles RPC responses, state updates, and provider events
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      if (event.data?.target !== 'stablenet-inpage') return

      // Validate message structure before processing
      const message = validateExtensionMessage(event.data.data)
      if (!message) return

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

        // Handle EIP-1193 provider events from EventBroadcaster
        case MESSAGE_TYPES.PROVIDER_EVENT: {
          this.handleProviderEvent(message)
          break
        }
      }
    })
  }

  /**
   * Handle provider events from EventBroadcaster
   * Routes events to appropriate handlers and updates internal state
   */
  private handleProviderEvent(message: ExtensionMessage): void {
    // PROVIDER_EVENT messages from EventBroadcaster have event and data
    // directly on the message object (not nested in payload)
    const providerMsg = message as unknown as { event?: string; data?: unknown }
    if (!providerMsg.event || typeof providerMsg.event !== 'string') return

    const { event, data } = providerMsg

    switch (event) {
      case PROVIDER_EVENTS.CONNECT: {
        const connectInfo = data as { chainId: string }
        this._isConnected = true
        if (connectInfo.chainId) {
          this.chainId = connectInfo.chainId
        }
        this.emit(PROVIDER_EVENTS.CONNECT, connectInfo)
        logger.info('Provider connected', connectInfo)
        break
      }

      case PROVIDER_EVENTS.DISCONNECT: {
        const error = data as { code: number; message: string }
        this._isConnected = false
        this.selectedAddress = null
        this.emit(PROVIDER_EVENTS.DISCONNECT, error)
        logger.info('Provider disconnected', error)
        break
      }

      case PROVIDER_EVENTS.ACCOUNTS_CHANGED: {
        const accounts = data as string[]
        const newSelectedAddress = accounts[0] ?? null

        // Only emit if accounts actually changed
        if (newSelectedAddress !== this.selectedAddress || accounts.length === 0) {
          this.selectedAddress = newSelectedAddress
          this._isConnected = accounts.length > 0
          this.emit(PROVIDER_EVENTS.ACCOUNTS_CHANGED, accounts)
          logger.debug('Accounts changed', { accounts })
        }
        break
      }

      case PROVIDER_EVENTS.CHAIN_CHANGED: {
        const chainId = data as string
        if (chainId !== this.chainId) {
          this.chainId = chainId
          this.emit(PROVIDER_EVENTS.CHAIN_CHANGED, chainId)
          logger.debug('Chain changed', { chainId })
        }
        break
      }

      case 'assetsChanged': {
        // StableNet custom event for asset changes
        this.emit('assetsChanged', data)
        logger.debug('Assets changed', { data })
        break
      }
    }
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

      // Timeout after configured duration
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new ProviderError('Request timeout', -32000))
        }
      }, TIMING.RPC_REQUEST_TIMEOUT_MS)
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
   * Alias for on (Node.js EventEmitter compatibility)
   */
  addListener(event: string, listener: EventListener): this {
    return this.on(event, listener)
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
    const callback = paramsOrCallback as (error: Error | null, response?: JsonRpcResponse) => void

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
let eip6963ListenerRegistered = false

function announceEIP6963Provider(): void {
  // Create detail with current walletInfo (not cached)
  const createDetail = () =>
    Object.freeze({
      info: Object.freeze(walletInfo),
      provider,
    })

  // Dispatch announce event with current info
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: createDetail() }))

  // Only register the request listener once to prevent duplicates
  if (!eip6963ListenerRegistered) {
    eip6963ListenerRegistered = true
    window.addEventListener('eip6963:requestProvider', () => {
      // Use current walletInfo when responding to requests
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: createDetail() }))
    })
  }
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
        {
          target: 'stablenet-contentscript',
          data: { type: MESSAGE_TYPES.RPC_REQUEST, id: `embedded-${Date.now()}`, payload },
        },
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
