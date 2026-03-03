import { describe, expect, it } from 'vitest'
import {
  ALL_NETWORKS,
  // Chains
  ANVIL_ADDRESSES,
  ANVIL_NETWORK,
  ANVIL_SERVICES,
  ANVIL_TOKENS,
  CHAIN_CONFIGS,
  CURRENT_ENTRY_POINT_VERSION,
  DEFAULT_CHAIN_ID,
  DEFAULT_NETWORKS,
  DEVNET_NETWORK,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_ADDRESSES,
  ENTRY_POINT_V06,
  // EntryPoints
  ENTRY_POINT_V07,
  ENTRY_POINT_V09,
  // Networks
  ETH_CURRENCY,
  getChainAddresses,
  getChainConfig,
  getChainTokens,
  getEntryPointVersion,
  getNetworkByChainId,
  getServiceUrls,
  isEntryPoint,
  isSupportedChainId,
  isTestnet,
  MAINNET_NETWORK,
  SEPOLIA_ADDRESSES,
  SEPOLIA_ETH_CURRENCY,
  SEPOLIA_NETWORK,
  SEPOLIA_SERVICES,
  SEPOLIA_TOKENS,
} from '../src'

describe('EntryPoints', () => {
  describe('Constants', () => {
    it('should have correct EntryPoint v0.7 address', () => {
      expect(ENTRY_POINT_V07).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    })

    it('should have correct EntryPoint v0.6 address', () => {
      expect(ENTRY_POINT_V06).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')
    })

    it('should have valid Ethereum addresses', () => {
      expect(ENTRY_POINT_V07).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(ENTRY_POINT_V06).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should have correct EntryPoint v0.9 address', () => {
      expect(ENTRY_POINT_V09).toBe('0xEf6817fe73741A8F10088f9511c64b666a338A14')
    })

    it('should have ENTRY_POINT_ADDRESSES with all versions', () => {
      expect(ENTRY_POINT_ADDRESSES.V09).toBe(ENTRY_POINT_V09)
      expect(ENTRY_POINT_ADDRESSES.V07).toBe(ENTRY_POINT_V07)
      expect(ENTRY_POINT_ADDRESSES.V06).toBe(ENTRY_POINT_V06)
    })

    it('should have current version as V09', () => {
      expect(CURRENT_ENTRY_POINT_VERSION).toBe('V09')
    })

    it('should have ENTRY_POINT_ADDRESS equal to v0.9', () => {
      expect(ENTRY_POINT_ADDRESS).toBe(ENTRY_POINT_V09)
    })
  })

  describe('isEntryPoint', () => {
    it('should return true for EntryPoint v0.9', () => {
      expect(isEntryPoint(ENTRY_POINT_V09)).toBe(true)
    })

    it('should return true for EntryPoint v0.7', () => {
      expect(isEntryPoint(ENTRY_POINT_V07)).toBe(true)
    })

    it('should return true for EntryPoint v0.6', () => {
      expect(isEntryPoint(ENTRY_POINT_V06)).toBe(true)
    })

    it('should return true for lowercase addresses', () => {
      expect(isEntryPoint(ENTRY_POINT_V09.toLowerCase() as `0x${string}`)).toBe(true)
    })

    it('should return false for unknown addresses', () => {
      expect(isEntryPoint('0x1234567890123456789012345678901234567890')).toBe(false)
    })
  })

  describe('getEntryPointVersion', () => {
    it('should return V09 for EntryPoint v0.9', () => {
      expect(getEntryPointVersion(ENTRY_POINT_V09)).toBe('V09')
    })

    it('should return V07 for EntryPoint v0.7', () => {
      expect(getEntryPointVersion(ENTRY_POINT_V07)).toBe('V07')
    })

    it('should return V06 for EntryPoint v0.6', () => {
      expect(getEntryPointVersion(ENTRY_POINT_V06)).toBe('V06')
    })

    it('should return null for unknown addresses', () => {
      expect(getEntryPointVersion('0x1234567890123456789012345678901234567890')).toBeNull()
    })

    it('should handle case-insensitive addresses', () => {
      expect(getEntryPointVersion(ENTRY_POINT_V07.toLowerCase() as `0x${string}`)).toBe('V07')
    })
  })
})

describe('Networks', () => {
  describe('Currency Definitions', () => {
    it('should have correct ETH currency', () => {
      expect(ETH_CURRENCY.name).toBe('Ether')
      expect(ETH_CURRENCY.symbol).toBe('ETH')
      expect(ETH_CURRENCY.decimals).toBe(18)
    })

    it('should have correct Sepolia ETH currency', () => {
      expect(SEPOLIA_ETH_CURRENCY.name).toBe('Sepolia Ether')
      expect(SEPOLIA_ETH_CURRENCY.symbol).toBe('ETH')
      expect(SEPOLIA_ETH_CURRENCY.decimals).toBe(18)
    })
  })

  describe('Network Definitions', () => {
    it('should have correct Anvil network', () => {
      expect(ANVIL_NETWORK.chainId).toBe(31337)
      expect(ANVIL_NETWORK.name).toBe('Anvil (Local)')
      expect(ANVIL_NETWORK.isTestnet).toBe(true)
    })

    it('should have correct Devnet network', () => {
      expect(DEVNET_NETWORK.chainId).toBe(1337)
      expect(DEVNET_NETWORK.isTestnet).toBe(true)
    })

    it('should have correct Sepolia network', () => {
      expect(SEPOLIA_NETWORK.chainId).toBe(11155111)
      expect(SEPOLIA_NETWORK.isTestnet).toBe(true)
    })

    it('should have correct Mainnet network', () => {
      expect(MAINNET_NETWORK.chainId).toBe(1)
      expect(MAINNET_NETWORK.isTestnet).toBe(false)
    })
  })

  describe('Network Collections', () => {
    it('should include Anvil in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === 31337)).toBe(true)
    })

    it('should include Sepolia in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === 11155111)).toBe(true)
    })

    it('should NOT include Mainnet in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === 1)).toBe(false)
    })

    it('should include Mainnet in ALL_NETWORKS', () => {
      expect(ALL_NETWORKS.some((n) => n.chainId === 1)).toBe(true)
    })

    it('should have more networks in ALL_NETWORKS than DEFAULT_NETWORKS', () => {
      expect(ALL_NETWORKS.length).toBeGreaterThanOrEqual(DEFAULT_NETWORKS.length)
    })
  })

  describe('getNetworkByChainId', () => {
    it('should return Anvil network for chainId 31337', () => {
      const network = getNetworkByChainId(31337)
      expect(network?.name).toBe('Anvil (Local)')
    })

    it('should return Sepolia network for chainId 11155111', () => {
      const network = getNetworkByChainId(11155111)
      expect(network?.name).toBe('Sepolia')
    })

    it('should return Mainnet for chainId 1', () => {
      const network = getNetworkByChainId(1)
      expect(network?.name).toBe('Ethereum')
    })

    it('should return undefined for unknown chainId', () => {
      expect(getNetworkByChainId(99999)).toBeUndefined()
    })
  })

  describe('isSupportedChainId', () => {
    it('should return true for Anvil', () => {
      expect(isSupportedChainId(31337)).toBe(true)
    })

    it('should return true for Sepolia', () => {
      expect(isSupportedChainId(11155111)).toBe(true)
    })

    it('should return true for Mainnet', () => {
      expect(isSupportedChainId(1)).toBe(true)
    })

    it('should return false for unknown chainId', () => {
      expect(isSupportedChainId(99999)).toBe(false)
    })
  })

  describe('isTestnet', () => {
    it('should return true for Anvil', () => {
      expect(isTestnet(31337)).toBe(true)
    })

    it('should return true for Sepolia', () => {
      expect(isTestnet(11155111)).toBe(true)
    })

    it('should return false for Mainnet', () => {
      expect(isTestnet(1)).toBe(false)
    })

    it('should return false for unknown chainId', () => {
      expect(isTestnet(99999)).toBe(false)
    })
  })

  describe('DEFAULT_CHAIN_ID', () => {
    it('should be Anvil chainId', () => {
      expect(DEFAULT_CHAIN_ID).toBe(31337)
    })
  })
})

describe('Chains', () => {
  describe('Address Configurations', () => {
    it('should have correct Anvil chainId', () => {
      expect(ANVIL_ADDRESSES.chainId).toBe(31337)
    })

    it('should have correct Sepolia chainId', () => {
      expect(SEPOLIA_ADDRESSES.chainId).toBe(11155111)
    })

    it('should have EntryPoint in core addresses', () => {
      expect(ANVIL_ADDRESSES.core.entryPoint).toBe(ENTRY_POINT_V07)
      expect(SEPOLIA_ADDRESSES.core.entryPoint).toBe(ENTRY_POINT_V07)
    })

    it('should have validator addresses', () => {
      expect(ANVIL_ADDRESSES.validators).toBeDefined()
      expect(SEPOLIA_ADDRESSES.validators).toBeDefined()
    })

    it('should have paymaster addresses', () => {
      expect(ANVIL_ADDRESSES.paymasters).toBeDefined()
      expect(SEPOLIA_ADDRESSES.paymasters).toBeDefined()
    })
  })

  describe('Service URLs', () => {
    it('should have Anvil service URLs', () => {
      expect(ANVIL_SERVICES.bundler).toContain('127.0.0.1')
      expect(ANVIL_SERVICES.paymaster).toContain('127.0.0.1')
    })

    it('should have Sepolia service URLs', () => {
      expect(SEPOLIA_SERVICES.bundler).toContain('stablenet.dev')
      expect(SEPOLIA_SERVICES.paymaster).toContain('stablenet.dev')
    })
  })

  describe('Tokens', () => {
    it('should have empty Anvil tokens', () => {
      expect(ANVIL_TOKENS).toEqual([])
    })

    it('should have USDC in Sepolia tokens', () => {
      expect(SEPOLIA_TOKENS.length).toBeGreaterThan(0)
      expect(SEPOLIA_TOKENS.some((t) => t.symbol === 'USDC')).toBe(true)
    })
  })

  describe('CHAIN_CONFIGS', () => {
    it('should have config for Anvil', () => {
      expect(CHAIN_CONFIGS[31337]).toBeDefined()
    })

    it('should have config for Sepolia', () => {
      expect(CHAIN_CONFIGS[11155111]).toBeDefined()
    })
  })

  describe('getChainConfig', () => {
    it('should return config for Anvil', () => {
      const config = getChainConfig(31337)
      expect(config).toBeDefined()
      expect(config?.addresses.chainId).toBe(31337)
    })

    it('should return config for Sepolia', () => {
      const config = getChainConfig(11155111)
      expect(config).toBeDefined()
      expect(config?.addresses.chainId).toBe(11155111)
    })

    it('should return undefined for unknown chainId', () => {
      expect(getChainConfig(99999)).toBeUndefined()
    })
  })

  describe('getChainAddresses', () => {
    it('should return addresses for Anvil', () => {
      const addresses = getChainAddresses(31337)
      expect(addresses).toBeDefined()
      expect(addresses?.core.entryPoint).toBe(ENTRY_POINT_V07)
    })

    it('should return undefined for unknown chainId', () => {
      expect(getChainAddresses(99999)).toBeUndefined()
    })
  })

  describe('getServiceUrls', () => {
    it('should return service URLs for Anvil', () => {
      const services = getServiceUrls(31337)
      expect(services).toBeDefined()
      expect(services?.bundler).toContain('127.0.0.1')
    })

    it('should return undefined for unknown chainId', () => {
      expect(getServiceUrls(99999)).toBeUndefined()
    })
  })

  describe('getChainTokens', () => {
    it('should return tokens for Sepolia', () => {
      const tokens = getChainTokens(11155111)
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('should return empty array for Anvil', () => {
      const tokens = getChainTokens(31337)
      expect(tokens).toEqual([])
    })

    it('should return empty array for unknown chainId', () => {
      const tokens = getChainTokens(99999)
      expect(tokens).toEqual([])
    })
  })
})

describe('Package Exports', () => {
  it('should export all entry point constants and functions', async () => {
    const exports = await import('../src')

    expect(exports.ENTRY_POINT_V07).toBeDefined()
    expect(exports.ENTRY_POINT_V06).toBeDefined()
    expect(exports.ENTRY_POINT_ADDRESSES).toBeDefined()
    expect(typeof exports.isEntryPoint).toBe('function')
    expect(typeof exports.getEntryPointVersion).toBe('function')
  })

  it('should export all network constants and functions', async () => {
    const exports = await import('../src')

    expect(exports.ETH_CURRENCY).toBeDefined()
    expect(exports.ANVIL_NETWORK).toBeDefined()
    expect(exports.DEFAULT_NETWORKS).toBeDefined()
    expect(typeof exports.getNetworkByChainId).toBe('function')
    expect(typeof exports.isSupportedChainId).toBe('function')
    expect(typeof exports.isTestnet).toBe('function')
  })

  it('should export all chain constants and functions', async () => {
    const exports = await import('../src')

    expect(exports.CHAIN_CONFIGS).toBeDefined()
    expect(typeof exports.getChainConfig).toBe('function')
    expect(typeof exports.getChainAddresses).toBe('function')
    expect(typeof exports.getServiceUrls).toBe('function')
    expect(typeof exports.getChainTokens).toBe('function')
  })
})
