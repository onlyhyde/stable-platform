import { createPublicClient, http } from 'viem'
import { PROVIDER_EVENTS } from '../../shared/constants'
import type { Network } from '../../types'
import { walletState } from '../state/store'

/**
 * Network Controller
 * Manages network connections and switching
 */
export class NetworkController {
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map()

  /**
   * Get current network
   */
  getCurrentNetwork(): Network | undefined {
    return walletState.getCurrentNetwork()
  }

  /**
   * Get all networks
   */
  getNetworks(): Network[] {
    return walletState.getState().networks.networks
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(chainId: number): Promise<void> {
    const network = this.getNetworks().find((n) => n.chainId === chainId)

    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`)
    }

    // Verify network connectivity
    await this.verifyNetwork(network)

    const previousChainId = walletState.getState().networks.selectedChainId
    await walletState.selectNetwork(chainId)

    // Emit chain changed event
    if (previousChainId !== chainId) {
      this.emit(PROVIDER_EVENTS.CHAIN_CHANGED, `0x${chainId.toString(16)}`)
    }
  }

  /**
   * Add a custom network
   */
  async addNetwork(network: Network): Promise<void> {
    // Verify network configuration
    await this.verifyNetwork(network)

    // Check for duplicate
    const existing = this.getNetworks().find((n) => n.chainId === network.chainId)
    if (existing) {
      throw new Error(`Network with chainId ${network.chainId} already exists`)
    }

    await walletState.addNetwork(network)
  }

  /**
   * Remove a custom network
   */
  async removeNetwork(chainId: number): Promise<void> {
    const state = walletState.getState()
    const networks = state.networks.networks.filter((n) => n.chainId !== chainId)

    // Cannot remove if currently selected
    if (state.networks.selectedChainId === chainId) {
      throw new Error('Cannot remove currently selected network')
    }

    await walletState.setState({
      networks: {
        ...state.networks,
        networks,
      },
    })
  }

  /**
   * Update network configuration
   */
  async updateNetwork(chainId: number, updates: Partial<Network>): Promise<void> {
    const networks = walletState
      .getState()
      .networks.networks.map((n) => (n.chainId === chainId ? { ...n, ...updates } : n))

    await walletState.setState({
      networks: {
        ...walletState.getState().networks,
        networks,
      },
    })
  }

  /**
   * Verify network connectivity
   */
  async verifyNetwork(network: Network): Promise<boolean> {
    try {
      const client = createPublicClient({
        transport: http(network.rpcUrl),
      })

      const chainId = await client.getChainId()

      if (chainId !== network.chainId) {
        throw new Error(`Chain ID mismatch: expected ${network.chainId}, got ${chainId}`)
      }

      return true
    } catch (error) {
      throw new Error(
        `Failed to connect to network: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get network chain ID in hex format
   */
  getChainIdHex(): string | null {
    const network = this.getCurrentNetwork()
    return network ? `0x${network.chainId.toString(16)}` : null
  }

  /**
   * Subscribe to network events
   */
  on(event: string, listener: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(listener)
  }

  /**
   * Unsubscribe from network events
   */
  off(event: string, listener: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(listener)
  }

  /**
   * Emit a network event
   */
  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      listener(data)
    })
  }
}

// Singleton instance
export const networkController = new NetworkController()
