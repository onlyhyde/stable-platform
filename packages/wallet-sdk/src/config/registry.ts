/**
 * NetworkRegistry - Dynamic network configuration management
 *
 * Provides runtime network management with persistence support
 */

import type { NetworkConfig, NetworkInfo } from '../types'
import { DEFAULT_NETWORKS, toNetworkConfig, toNetworkInfo } from './networks'

/**
 * Storage interface for network persistence
 */
export interface NetworkStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/**
 * In-memory storage (default fallback)
 */
class MemoryStorage implements NetworkStorage {
  private store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }
}

/**
 * localStorage-based storage
 */
export class LocalStorage implements NetworkStorage {
  constructor(private prefix = 'stablenet_') {}

  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.prefix + key)
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, value)
    } catch {
      // Storage might be full or unavailable
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key)
    } catch {
      // Ignore removal errors
    }
  }
}

/**
 * Network registry configuration
 */
export interface NetworkRegistryConfig {
  /** Custom storage implementation */
  storage?: NetworkStorage
  /** Additional default networks */
  defaultNetworks?: NetworkConfig[]
  /** Persist custom networks */
  persist?: boolean
}

const STORAGE_KEY = 'custom_networks'

/**
 * NetworkRegistry class for managing blockchain networks
 *
 * @example
 * ```typescript
 * const registry = new NetworkRegistry()
 *
 * // Add custom network
 * registry.addNetwork({
 *   chainId: 42161,
 *   name: 'Arbitrum One',
 *   symbol: 'ETH',
 *   rpcUrl: 'https://arb1.arbitrum.io/rpc',
 *   explorerUrl: 'https://arbiscan.io'
 * })
 *
 * // Get network
 * const network = registry.getNetwork(42161)
 * ```
 */
export class NetworkRegistry {
  private networks: Map<number, NetworkConfig> = new Map()
  private storage: NetworkStorage
  private persist: boolean
  private initialized = false

  constructor(config: NetworkRegistryConfig = {}) {
    this.storage = config.storage ?? new MemoryStorage()
    this.persist = config.persist ?? false

    // Initialize with default networks
    for (const network of DEFAULT_NETWORKS) {
      this.networks.set(network.id, network)
    }

    // Add additional default networks if provided
    if (config.defaultNetworks) {
      for (const network of config.defaultNetworks) {
        this.networks.set(network.id, network)
      }
    }
  }

  /**
   * Initialize registry and load persisted networks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (this.persist) {
      await this.loadPersistedNetworks()
    }

    this.initialized = true
  }

  /**
   * Load networks from storage
   */
  private async loadPersistedNetworks(): Promise<void> {
    try {
      const data = await this.storage.get(STORAGE_KEY)
      if (data) {
        const networks = JSON.parse(data) as NetworkConfig[]
        for (const network of networks) {
          if (network.isCustom) {
            this.networks.set(network.id, network)
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  /**
   * Persist custom networks to storage
   */
  private async persistNetworks(): Promise<void> {
    if (!this.persist) return

    try {
      const customNetworks = Array.from(this.networks.values()).filter((n) => n.isCustom)
      await this.storage.set(STORAGE_KEY, JSON.stringify(customNetworks))
    } catch {
      // Ignore persistence errors
    }
  }

  /**
   * Get a network by chain ID
   */
  getNetwork(chainId: number): NetworkConfig | undefined {
    return this.networks.get(chainId)
  }

  /**
   * Get network info (minimal format)
   */
  getNetworkInfo(chainId: number): NetworkInfo | undefined {
    const network = this.networks.get(chainId)
    return network ? toNetworkInfo(network) : undefined
  }

  /**
   * Get all registered networks
   */
  getAllNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values())
  }

  /**
   * Get all networks as NetworkInfo (minimal format)
   */
  getAllNetworkInfos(): NetworkInfo[] {
    return this.getAllNetworks().map(toNetworkInfo)
  }

  /**
   * Get default networks only
   */
  getDefaultNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values()).filter((n) => !n.isCustom)
  }

  /**
   * Get custom networks only
   */
  getCustomNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values()).filter((n) => n.isCustom)
  }

  /**
   * Check if a network is registered
   */
  hasNetwork(chainId: number): boolean {
    return this.networks.has(chainId)
  }

  /**
   * Add a network from NetworkInfo
   */
  async addNetwork(info: NetworkInfo): Promise<NetworkConfig> {
    const config = toNetworkConfig(info)
    this.networks.set(config.id, config)
    await this.persistNetworks()
    return config
  }

  /**
   * Add a network from NetworkConfig
   */
  async addNetworkConfig(config: NetworkConfig): Promise<void> {
    this.networks.set(config.id, {
      ...config,
      isCustom: config.isCustom ?? true,
      addedAt: config.addedAt ?? Date.now(),
    })
    await this.persistNetworks()
  }

  /**
   * Update a network
   */
  async updateNetwork(
    chainId: number,
    updates: Partial<NetworkInfo>
  ): Promise<NetworkConfig | undefined> {
    const existing = this.networks.get(chainId)
    if (!existing) return undefined

    const updatedInfo = {
      ...toNetworkInfo(existing),
      ...updates,
      chainId, // Ensure chainId is preserved
    }

    const updated = toNetworkConfig(updatedInfo)
    updated.isCustom = existing.isCustom
    updated.addedAt = existing.addedAt

    this.networks.set(chainId, updated)
    await this.persistNetworks()

    return updated
  }

  /**
   * Remove a custom network
   */
  async removeNetwork(chainId: number): Promise<boolean> {
    const network = this.networks.get(chainId)

    // Only allow removing custom networks
    if (!network?.isCustom) {
      return false
    }

    const result = this.networks.delete(chainId)
    await this.persistNetworks()
    return result
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChainIds(): number[] {
    return Array.from(this.networks.keys())
  }

  /**
   * Check if a chain is a testnet
   */
  isTestnet(chainId: number): boolean {
    return this.networks.get(chainId)?.testnet ?? false
  }

  /**
   * Clear all custom networks
   */
  async clearCustomNetworks(): Promise<void> {
    for (const [chainId, network] of this.networks.entries()) {
      if (network.isCustom) {
        this.networks.delete(chainId)
      }
    }
    await this.persistNetworks()
  }
}

// Export singleton instance for convenience
export const networkRegistry = new NetworkRegistry()
