import { beforeEach, describe, expect, it } from 'vitest'
import { NetworkRegistry, type NetworkStorage } from '../../src/config/registry'
import type { NetworkInfo } from '../../src/types'

/**
 * In-memory storage for testing
 */
class TestStorage implements NetworkStorage {
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

describe('NetworkRegistry', () => {
  let registry: NetworkRegistry

  beforeEach(() => {
    registry = new NetworkRegistry()
  })

  describe('constructor', () => {
    it('should initialize with default networks', () => {
      const networks = registry.getAllNetworks()
      expect(networks.length).toBeGreaterThan(0)
    })

    it('should include Anvil local network', () => {
      const anvil = registry.getNetwork(31337)
      expect(anvil).toBeDefined()
      expect(anvil?.name).toBe('Anvil (Local)')
    })

    it('should include StableNet networks', () => {
      expect(registry.hasNetwork(8283)).toBe(true)
      expect(registry.hasNetwork(82830)).toBe(true)
    })

    it('should accept additional default networks', () => {
      const custom = new NetworkRegistry({
        defaultNetworks: [
          {
            id: 999,
            name: 'Custom',
            nativeCurrency: { name: 'TEST', symbol: 'TST', decimals: 18 },
            rpcUrls: { default: { http: ['http://localhost:9999'] } },
          },
        ],
      })
      expect(custom.hasNetwork(999)).toBe(true)
    })
  })

  describe('getNetwork', () => {
    it('should return network by chain ID', () => {
      const network = registry.getNetwork(31337)
      expect(network).toBeDefined()
      expect(network?.id).toBe(31337)
    })

    it('should return undefined for unknown chain ID', () => {
      expect(registry.getNetwork(99999)).toBeUndefined()
    })
  })

  describe('getNetworkInfo', () => {
    it('should return minimal network info', () => {
      const info = registry.getNetworkInfo(31337)
      expect(info).toBeDefined()
      expect(info?.chainId).toBe(31337)
      expect(info?.symbol).toBe('ETH')
      expect(info?.rpcUrl).toBe('http://127.0.0.1:8545')
    })

    it('should return undefined for unknown chain ID', () => {
      expect(registry.getNetworkInfo(99999)).toBeUndefined()
    })
  })

  describe('getAllNetworks', () => {
    it('should return all registered networks', () => {
      const networks = registry.getAllNetworks()
      expect(networks.length).toBe(3) // Anvil, StableNet Local, StableNet Testnet
    })
  })

  describe('getDefaultNetworks', () => {
    it('should return only non-custom networks', () => {
      const defaults = registry.getDefaultNetworks()
      expect(defaults.every((n) => !n.isCustom)).toBe(true)
    })
  })

  describe('getSupportedChainIds', () => {
    it('should return all chain IDs', () => {
      const ids = registry.getSupportedChainIds()
      expect(ids).toContain(31337)
      expect(ids).toContain(8283)
      expect(ids).toContain(82830)
    })
  })

  describe('isTestnet', () => {
    it('should identify testnets', () => {
      expect(registry.isTestnet(31337)).toBe(true)
      expect(registry.isTestnet(82830)).toBe(true)
    })

    it('should return false for unknown networks', () => {
      expect(registry.isTestnet(99999)).toBe(false)
    })
  })

  describe('addNetwork', () => {
    it('should add a network from NetworkInfo', async () => {
      const info: NetworkInfo = {
        chainId: 42161,
        name: 'Arbitrum One',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
      }

      const config = await registry.addNetwork(info)
      expect(config.id).toBe(42161)
      expect(config.isCustom).toBe(true)
      expect(registry.hasNetwork(42161)).toBe(true)
    })
  })

  describe('addNetworkConfig', () => {
    it('should add a network from NetworkConfig', async () => {
      await registry.addNetworkConfig({
        id: 10,
        name: 'Optimism',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['https://mainnet.optimism.io'] } },
        isCustom: true,
      })

      expect(registry.hasNetwork(10)).toBe(true)
      const net = registry.getNetwork(10)
      expect(net?.name).toBe('Optimism')
    })
  })

  describe('updateNetwork', () => {
    it('should update an existing network', async () => {
      const updated = await registry.updateNetwork(31337, { name: 'Renamed Anvil' })
      expect(updated).toBeDefined()
      expect(updated?.name).toBe('Renamed Anvil')
    })

    it('should return undefined for unknown network', async () => {
      const result = await registry.updateNetwork(99999, { name: 'Nope' })
      expect(result).toBeUndefined()
    })
  })

  describe('removeNetwork', () => {
    it('should remove custom networks', async () => {
      await registry.addNetwork({
        chainId: 42161,
        name: 'Arb',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
      })

      const removed = await registry.removeNetwork(42161)
      expect(removed).toBe(true)
      expect(registry.hasNetwork(42161)).toBe(false)
    })

    it('should not remove default networks', async () => {
      const removed = await registry.removeNetwork(31337)
      expect(removed).toBe(false)
      expect(registry.hasNetwork(31337)).toBe(true)
    })
  })

  describe('clearCustomNetworks', () => {
    it('should remove only custom networks', async () => {
      await registry.addNetwork({
        chainId: 42161,
        name: 'Arb',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
      })

      expect(registry.hasNetwork(42161)).toBe(true)
      await registry.clearCustomNetworks()
      expect(registry.hasNetwork(42161)).toBe(false)
      // Default networks should remain
      expect(registry.hasNetwork(31337)).toBe(true)
    })
  })

  describe('persistence', () => {
    it('should persist custom networks when configured', async () => {
      const storage = new TestStorage()
      const persistentRegistry = new NetworkRegistry({
        storage,
        persist: true,
      })

      await persistentRegistry.addNetwork({
        chainId: 42161,
        name: 'Arb',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
      })

      const stored = await storage.get('custom_networks')
      expect(stored).toBeDefined()

      const parsed = JSON.parse(stored!)
      expect(parsed.length).toBe(1)
      expect(parsed[0].id).toBe(42161)
    })

    it('should load persisted networks on initialize', async () => {
      const storage = new TestStorage()

      // Pre-store a custom network
      await storage.set(
        'custom_networks',
        JSON.stringify([
          {
            id: 42161,
            name: 'Arb',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: { default: { http: ['https://arb1.arbitrum.io/rpc'] } },
            isCustom: true,
            addedAt: Date.now(),
          },
        ])
      )

      const newRegistry = new NetworkRegistry({ storage, persist: true })
      await newRegistry.initialize()

      expect(newRegistry.hasNetwork(42161)).toBe(true)
    })

    it('should not load non-custom networks from storage', async () => {
      const storage = new TestStorage()

      // Try to store a non-custom network
      await storage.set(
        'custom_networks',
        JSON.stringify([
          {
            id: 1,
            name: 'Fake Mainnet',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: { default: { http: ['http://fake'] } },
            isCustom: false,
          },
        ])
      )

      const newRegistry = new NetworkRegistry({ storage, persist: true })
      await newRegistry.initialize()

      // The fake non-custom network should not be loaded
      expect(newRegistry.getNetwork(1)?.name).not.toBe('Fake Mainnet')
    })
  })
})
