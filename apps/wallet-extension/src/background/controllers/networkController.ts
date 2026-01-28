/**
 * NetworkController
 * Manages network configuration and switching
 */

import type { Hex } from 'viem'
import type {
  NetworkConfig,
  NetworkStatus,
  NetworkState,
  NetworkControllerState,
  NetworkControllerOptions,
  AddNetworkParams,
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
   * Validate an RPC URL
   */
  validateRpcUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  /**
   * Convert hex chain ID to number
   */
  chainIdHexToNumber(hex: Hex): number {
    return parseInt(hex, 16)
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
