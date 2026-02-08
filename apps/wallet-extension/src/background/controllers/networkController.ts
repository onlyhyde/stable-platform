/**
 * NetworkController
 * Manages network configuration and switching
 */

import type { Hex } from 'viem'
import type {
  AddNetworkParams,
  NetworkConfig,
  NetworkControllerOptions,
  NetworkControllerState,
  NetworkState,
  NetworkStatus,
} from './networkController.types'

type NetworkEventType =
  | 'network:added'
  | 'network:removed'
  | 'network:switched'
  | 'network:statusChanged'
  | 'chainChanged'

type EventHandler = (...args: unknown[]) => void

export class NetworkController {
  private state: NetworkControllerState
  private options: NetworkControllerOptions
  private eventHandlers: Map<NetworkEventType, Set<EventHandler>>

  constructor(options: NetworkControllerOptions) {
    this.options = options
    this.eventHandlers = new Map()

    // Initialize state with default networks
    const networks: Record<number, NetworkState> = {}
    for (const config of options.defaultNetworks) {
      networks[config.chainId] = {
        config,
        status: 'disconnected',
      }
    }

    this.state = {
      selectedChainId: options.defaultChainId,
      networks,
      customNetworks: [],
    }
  }

  /**
   * Add a new network (EIP-3085)
   */
  async addNetwork(params: AddNetworkParams): Promise<NetworkConfig> {
    const chainId = this.chainIdHexToNumber(params.chainId)

    // Check if network already exists
    if (this.state.networks[chainId]) {
      throw new Error('Network already exists')
    }

    // Validate RPC URL
    const rpcUrl = params.rpcUrls[0]
    if (!params.rpcUrls.length || !rpcUrl || !this.validateRpcUrl(rpcUrl)) {
      throw new Error('Invalid RPC URL')
    }

    const config: NetworkConfig = {
      chainId,
      chainIdHex: params.chainId,
      name: params.chainName,
      rpcUrl: rpcUrl,
      nativeCurrency: params.nativeCurrency,
      blockExplorerUrl: params.blockExplorerUrls?.[0],
      isCustom: true,
    }

    this.state.networks[chainId] = {
      config,
      status: 'disconnected',
    }

    this.state.customNetworks.push(chainId)

    this.emit('network:added', config)

    return config
  }

  /**
   * Remove a custom network
   */
  async removeNetwork(chainId: number): Promise<void> {
    // Check if it's a default network
    const isDefault = this.options.defaultNetworks.some((n) => n.chainId === chainId)
    if (isDefault) {
      throw new Error('Cannot remove default network')
    }

    // Check if network exists
    if (!this.state.networks[chainId]) {
      return
    }

    // If removing selected network, switch to default
    if (this.state.selectedChainId === chainId) {
      await this.switchNetwork(this.options.defaultChainId)
    }

    // Remove from state
    delete this.state.networks[chainId]

    // Remove from custom networks list
    const index = this.state.customNetworks.indexOf(chainId)
    if (index > -1) {
      this.state.customNetworks.splice(index, 1)
    }

    this.emit('network:removed', chainId)
  }

  /**
   * Switch to a different network (EIP-3326)
   */
  async switchNetwork(chainId: number): Promise<void> {
    const network = this.state.networks[chainId]
    if (!network) {
      throw new Error('Network not found')
    }

    this.state.selectedChainId = chainId

    this.emit('network:switched', chainId)
    this.emit('chainChanged', network.config.chainIdHex)
  }

  /**
   * Get network by chain ID
   */
  getNetwork(chainId: number): NetworkState | undefined {
    return this.state.networks[chainId]
  }

  /**
   * Get the currently selected network
   */
  getSelectedNetwork(): NetworkState {
    const network = this.state.networks[this.state.selectedChainId]
    if (!network) {
      throw new Error('Selected network not found')
    }
    return network
  }

  /**
   * Get the selected chain ID as number
   */
  getSelectedChainId(): number {
    return this.state.selectedChainId
  }

  /**
   * Get the selected chain ID as hex
   */
  getSelectedChainIdHex(): Hex {
    const network = this.state.networks[this.state.selectedChainId]
    if (!network) {
      throw new Error('Selected network not found')
    }
    return network.config.chainIdHex
  }

  /**
   * Get all configured networks
   */
  getAllNetworks(): NetworkState[] {
    return Object.values(this.state.networks)
  }

  /**
   * Get only custom networks
   */
  getCustomNetworks(): NetworkState[] {
    return this.state.customNetworks
      .map((chainId) => this.state.networks[chainId])
      .filter((network): network is NetworkState => network !== undefined)
  }

  /**
   * Update network connection status
   */
  async updateNetworkStatus(chainId: number, status: NetworkStatus): Promise<void> {
    const network = this.state.networks[chainId]
    if (!network) {
      return
    }

    network.status = status

    this.emit('network:statusChanged', chainId, status)
  }

  /**
   * Update the latest block number for a network
   */
  async updateLatestBlock(chainId: number, blockNumber: number): Promise<void> {
    const network = this.state.networks[chainId]
    if (!network) {
      return
    }

    network.latestBlock = blockNumber
  }

  /**
   * Validate an RPC URL format.
   */
  validateRpcUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) return false
      if (!parsed.hostname) return false
      // Block obvious localhost in production if needed
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate an RPC URL by connecting and verifying chain ID.
   * Returns the actual chain ID from the endpoint, or null if unreachable.
   */
  async validateRpcUrlWithChainId(url: string, expectedChainId?: number): Promise<number | null> {
    if (!this.validateRpcUrl(url)) return null

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) return null

      const data = (await response.json()) as { result?: string }
      if (!data.result) return null

      const actualChainId = Number.parseInt(data.result, 16)
      if (expectedChainId !== undefined && actualChainId !== expectedChainId) {
        return null
      }

      return actualChainId
    } catch {
      return null
    }
  }

  /**
   * Convert hex chain ID to number
   */
  chainIdHexToNumber(hex: Hex): number {
    return Number.parseInt(hex, 16)
  }

  /**
   * Convert number chain ID to hex
   */
  chainIdNumberToHex(num: number): Hex {
    return `0x${num.toString(16)}` as Hex
  }

  /**
   * Get the current state
   */
  getState(): NetworkControllerState {
    return { ...this.state }
  }

  /**
   * Subscribe to network events
   */
  on(event: NetworkEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Unsubscribe from network events
   */
  off(event: NetworkEventType, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  // ============================================================================
  // Health Check & Failover
  // ============================================================================

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Start periodic health checks for the selected network.
   * Checks every `intervalMs` (default: 30s).
   */
  startHealthChecks(intervalMs = 30_000): void {
    this.stopHealthChecks()
    this.healthCheckTimer = setInterval(() => {
      this.checkSelectedNetworkHealth().catch(() => {})
    }, intervalMs)
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /**
   * Perform a health check on the selected network.
   * On failure, attempts failover to backup RPCs.
   */
  async checkSelectedNetworkHealth(): Promise<boolean> {
    const chainId = this.state.selectedChainId
    const network = this.state.networks[chainId]
    if (!network) return false

    const rpcUrl = network.activeRpcUrl ?? network.config.rpcUrl
    const healthy = await this.pingRpc(rpcUrl)

    if (healthy) {
      network.status = 'connected'
      network.lastHealthCheck = Date.now()
      network.consecutiveFailures = 0
      return true
    }

    // RPC failed - increment failure count
    network.consecutiveFailures = (network.consecutiveFailures ?? 0) + 1
    network.lastError = `RPC ${rpcUrl} unreachable`

    // Attempt failover after 3 consecutive failures
    if (network.consecutiveFailures >= 3) {
      const didFailover = await this.attemptFailover(chainId)
      if (!didFailover) {
        network.status = 'error'
        this.emit('network:statusChanged', chainId, 'error')
      }
      return didFailover
    }

    return false
  }

  /**
   * Try each fallback RPC until one responds.
   * Returns true if failover succeeded.
   */
  private async attemptFailover(chainId: number): Promise<boolean> {
    const network = this.state.networks[chainId]
    if (!network) return false

    const fallbacks = network.config.fallbackRpcUrls ?? []
    const currentUrl = network.activeRpcUrl ?? network.config.rpcUrl

    // Try primary URL first (if not already the active one)
    const candidates = [network.config.rpcUrl, ...fallbacks].filter((url) => url !== currentUrl)

    for (const url of candidates) {
      const healthy = await this.pingRpc(url)
      if (healthy) {
        network.activeRpcUrl = url
        network.status = 'connected'
        network.consecutiveFailures = 0
        network.lastHealthCheck = Date.now()
        this.emit('network:statusChanged', chainId, 'connected')
        return true
      }
    }

    return false
  }

  /**
   * Ping an RPC endpoint with eth_chainId to check availability.
   * Returns true if the endpoint responds within timeout.
   */
  private async pingRpc(url: string, timeoutMs = 5_000): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get the active RPC URL for a network (considers failover state).
   */
  getActiveRpcUrl(chainId: number): string | undefined {
    const network = this.state.networks[chainId]
    if (!network) return undefined
    return network.activeRpcUrl ?? network.config.rpcUrl
  }

  // Private methods

  private emit(event: NetworkEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }
}
