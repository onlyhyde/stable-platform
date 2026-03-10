import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_NETWORKS,
  ANVIL_NETWORK,
  CHAIN_IDS,
  CURRENT_ENTRY_POINT_VERSION,
  DEFAULT_CHAIN_ID,
  DEFAULT_NETWORKS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_ADDRESSES,
  ENTRY_POINT_V06,
  ENTRY_POINT_V07,
  ENTRY_POINT_V09,
  ENTRY_POINT_V09_CANONICAL,
  ETH_CURRENCY,
  getAnvilNetwork,
  getChainAddresses,
  getChainConfig,
  getChainTokens,
  getEntryPointVersion,
  getLocalNetwork,
  getMainnetNetwork,
  getNetworkByChainId,
  getSepoliaNetwork,
  getServiceUrls,
  isEntryPoint,
  isSupportedChainId,
  isTestnet,
  LOCAL_NETWORK,
  MAINNET_NETWORK,
  SEPOLIA_ETH_CURRENCY,
  SEPOLIA_NETWORK,
  WKRC_CURRENCY,
} from '../src'
import {
  applyEnvOverrides,
  getAnvilConfig,
  getDefaultChainId,
  getLocalConfig,
  getMainnetConfig,
  getNetworkConfigByChainId,
  getSDKEnvHelp,
  getSepoliaConfig,
} from '../src/env'

describe('CHAIN_IDS', () => {
  it('should have correct chain IDs', () => {
    expect(CHAIN_IDS.LOCAL).toBe(8283)
    expect(CHAIN_IDS.ANVIL).toBe(31337)
    expect(CHAIN_IDS.SEPOLIA).toBe(11155111)
    expect(CHAIN_IDS.MAINNET).toBe(1)
  })

  it('should not have devnet chain ID', () => {
    expect(Object.values(CHAIN_IDS)).not.toContain(1337)
  })
})

describe('EntryPoints', () => {
  describe('Constants', () => {
    it('should have correct EntryPoint v0.9 address', () => {
      expect(ENTRY_POINT_V09).toBe('0xEf6817fe73741A8F10088f9511c64b666a338A14')
    })

    it('should have correct EntryPoint v0.7 address', () => {
      expect(ENTRY_POINT_V07).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    })

    it('should have correct EntryPoint v0.6 address', () => {
      expect(ENTRY_POINT_V06).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')
    })

    it('should have valid Ethereum addresses', () => {
      expect(ENTRY_POINT_V09).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(ENTRY_POINT_V07).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(ENTRY_POINT_V06).toMatch(/^0x[a-fA-F0-9]{40}$/)
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

    it('should have canonical v0.9 address', () => {
      expect(ENTRY_POINT_V09_CANONICAL).toMatch(/^0x[a-fA-F0-9]{40}$/)
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

    it('should have correct WKRC currency', () => {
      expect(WKRC_CURRENCY.name).toBe('WKRC Coin')
      expect(WKRC_CURRENCY.symbol).toBe('WKRC')
      expect(WKRC_CURRENCY.decimals).toBe(18)
    })
  })

  describe('Network Definitions', () => {
    it('should have correct Anvil network', () => {
      expect(ANVIL_NETWORK.chainId).toBe(CHAIN_IDS.ANVIL)
      expect(ANVIL_NETWORK.name).toBe('Anvil (Local)')
      expect(ANVIL_NETWORK.isTestnet).toBe(true)
    })

    it('should have correct LOCAL network (chain 8283)', () => {
      expect(LOCAL_NETWORK.chainId).toBe(CHAIN_IDS.LOCAL)
      expect(LOCAL_NETWORK.name).toBe('StableNet Local')
      expect(LOCAL_NETWORK.isTestnet).toBe(true)
      expect(LOCAL_NETWORK.currency).toEqual(WKRC_CURRENCY)
    })

    it('should have correct Sepolia network', () => {
      expect(SEPOLIA_NETWORK.chainId).toBe(CHAIN_IDS.SEPOLIA)
      expect(SEPOLIA_NETWORK.isTestnet).toBe(true)
    })

    it('should have correct Mainnet network', () => {
      expect(MAINNET_NETWORK.chainId).toBe(CHAIN_IDS.MAINNET)
      expect(MAINNET_NETWORK.isTestnet).toBe(false)
    })
  })

  describe('Network Factory Functions', () => {
    it('getAnvilNetwork() should return correct network', () => {
      const network = getAnvilNetwork()
      expect(network.chainId).toBe(CHAIN_IDS.ANVIL)
      expect(network.rpcUrl).toContain('127.0.0.1')
    })

    it('getLocalNetwork() should return correct network', () => {
      const network = getLocalNetwork()
      expect(network.chainId).toBe(CHAIN_IDS.LOCAL)
      expect(network.currency).toEqual(WKRC_CURRENCY)
    })

    it('getSepoliaNetwork() should return correct network', () => {
      const network = getSepoliaNetwork()
      expect(network.chainId).toBe(CHAIN_IDS.SEPOLIA)
    })

    it('getMainnetNetwork() should return correct network', () => {
      const network = getMainnetNetwork()
      expect(network.chainId).toBe(CHAIN_IDS.MAINNET)
      expect(network.isTestnet).toBe(false)
    })
  })

  describe('Network Collections', () => {
    it('should include LOCAL in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === CHAIN_IDS.LOCAL)).toBe(true)
    })

    it('should include Anvil in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === CHAIN_IDS.ANVIL)).toBe(true)
    })

    it('should include Sepolia in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === CHAIN_IDS.SEPOLIA)).toBe(true)
    })

    it('should NOT include Mainnet in DEFAULT_NETWORKS', () => {
      expect(DEFAULT_NETWORKS.some((n) => n.chainId === CHAIN_IDS.MAINNET)).toBe(false)
    })

    it('should NOT include Devnet (1337) in any network list', () => {
      expect(ALL_NETWORKS.some((n) => n.chainId === 1337)).toBe(false)
    })

    it('should include Mainnet in ALL_NETWORKS', () => {
      expect(ALL_NETWORKS.some((n) => n.chainId === CHAIN_IDS.MAINNET)).toBe(true)
    })

    it('should have more networks in ALL_NETWORKS than DEFAULT_NETWORKS', () => {
      expect(ALL_NETWORKS.length).toBeGreaterThan(DEFAULT_NETWORKS.length)
    })
  })

  describe('getNetworkByChainId', () => {
    it('should return Anvil network for chainId 31337', () => {
      const network = getNetworkByChainId(CHAIN_IDS.ANVIL)
      expect(network?.name).toBe('Anvil (Local)')
    })

    it('should return LOCAL network for chainId 8283', () => {
      const network = getNetworkByChainId(CHAIN_IDS.LOCAL)
      expect(network?.name).toBe('StableNet Local')
    })

    it('should return Sepolia network for chainId 11155111', () => {
      const network = getNetworkByChainId(CHAIN_IDS.SEPOLIA)
      expect(network?.name).toBe('Sepolia')
    })

    it('should return Mainnet for chainId 1', () => {
      const network = getNetworkByChainId(CHAIN_IDS.MAINNET)
      expect(network?.name).toBe('Ethereum')
    })

    it('should return undefined for unknown chainId', () => {
      expect(getNetworkByChainId(99999)).toBeUndefined()
    })
  })

  describe('isSupportedChainId', () => {
    it('should return true for LOCAL', () => {
      expect(isSupportedChainId(CHAIN_IDS.LOCAL)).toBe(true)
    })

    it('should return true for Anvil', () => {
      expect(isSupportedChainId(CHAIN_IDS.ANVIL)).toBe(true)
    })

    it('should return true for Sepolia', () => {
      expect(isSupportedChainId(CHAIN_IDS.SEPOLIA)).toBe(true)
    })

    it('should return true for Mainnet', () => {
      expect(isSupportedChainId(CHAIN_IDS.MAINNET)).toBe(true)
    })

    it('should return false for unknown chainId', () => {
      expect(isSupportedChainId(99999)).toBe(false)
    })

    it('should return false for removed Devnet (1337)', () => {
      expect(isSupportedChainId(1337)).toBe(false)
    })
  })

  describe('isTestnet', () => {
    it('should return true for LOCAL', () => {
      expect(isTestnet(CHAIN_IDS.LOCAL)).toBe(true)
    })

    it('should return true for Anvil', () => {
      expect(isTestnet(CHAIN_IDS.ANVIL)).toBe(true)
    })

    it('should return true for Sepolia', () => {
      expect(isTestnet(CHAIN_IDS.SEPOLIA)).toBe(true)
    })

    it('should return false for Mainnet', () => {
      expect(isTestnet(CHAIN_IDS.MAINNET)).toBe(false)
    })

    it('should return false for unknown chainId', () => {
      expect(isTestnet(99999)).toBe(false)
    })
  })

  describe('DEFAULT_CHAIN_ID', () => {
    it('should be LOCAL chainId (8283)', () => {
      expect(DEFAULT_CHAIN_ID).toBe(CHAIN_IDS.LOCAL)
    })
  })
})

describe('Chains (delegated to @stablenet/contracts)', () => {
  describe('getChainConfig', () => {
    it('should return config for LOCAL (8283)', () => {
      const config = getChainConfig(CHAIN_IDS.LOCAL)
      expect(config).toBeDefined()
      expect(config?.addresses.chainId).toBe(CHAIN_IDS.LOCAL)
    })

    it('should return undefined for unknown chainId', () => {
      expect(getChainConfig(99999)).toBeUndefined()
    })
  })

  describe('getChainAddresses', () => {
    it('should return addresses for LOCAL (8283)', () => {
      const addresses = getChainAddresses(CHAIN_IDS.LOCAL)
      expect(addresses).toBeDefined()
      expect(addresses?.core.entryPoint).toBe(ENTRY_POINT_V09)
    })

    it('should return undefined for unknown chainId', () => {
      expect(getChainAddresses(99999)).toBeUndefined()
    })
  })

  describe('getServiceUrls', () => {
    it('should return service URLs for LOCAL (8283)', () => {
      const services = getServiceUrls(CHAIN_IDS.LOCAL)
      expect(services).toBeDefined()
      expect(services?.bundler).toBeDefined()
    })

    it('should return undefined for unknown chainId', () => {
      expect(getServiceUrls(99999)).toBeUndefined()
    })
  })

  describe('getChainTokens', () => {
    it('should return tokens for LOCAL (8283)', () => {
      const tokens = getChainTokens(CHAIN_IDS.LOCAL)
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('should return empty array for unknown chainId', () => {
      const tokens = getChainTokens(99999)
      expect(tokens).toEqual([])
    })
  })
})

describe('Environment Configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env to clean state
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('STABLENET_')) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('STABLENET_')) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
  })

  describe('getAnvilConfig', () => {
    it('should return default values', () => {
      const config = getAnvilConfig()
      expect(config.rpcUrl).toBe('http://127.0.0.1:8545')
      expect(config.bundlerUrl).toBe('http://127.0.0.1:4337')
    })

    it('should override with env vars', () => {
      process.env.STABLENET_ANVIL_RPC_URL = 'http://custom:9999'
      const config = getAnvilConfig()
      expect(config.rpcUrl).toBe('http://custom:9999')
    })

    it('should use default for empty string env var', () => {
      process.env.STABLENET_ANVIL_RPC_URL = ''
      const config = getAnvilConfig()
      expect(config.rpcUrl).toBe('http://127.0.0.1:8545')
    })
  })

  describe('getLocalConfig', () => {
    it('should return default values', () => {
      const config = getLocalConfig()
      expect(config.rpcUrl).toBe('http://127.0.0.1:8501')
      expect(config.explorerUrl).toBe('http://127.0.0.1:3001')
    })

    it('should include indexerUrl for LOCAL', () => {
      const config = getLocalConfig()
      expect(config.indexerUrl).toBe('http://127.0.0.1:8080')
    })

    it('should override with env vars', () => {
      process.env.STABLENET_LOCAL_RPC_URL = 'http://stablenet-local:8501'
      const config = getLocalConfig()
      expect(config.rpcUrl).toBe('http://stablenet-local:8501')
    })
  })

  describe('getSepoliaConfig', () => {
    it('should return default values', () => {
      const config = getSepoliaConfig()
      expect(config.rpcUrl).toBe('https://rpc.sepolia.org')
      expect(config.explorerUrl).toBe('https://sepolia.etherscan.io')
    })
  })

  describe('getMainnetConfig', () => {
    it('should return default values', () => {
      const config = getMainnetConfig()
      expect(config.rpcUrl).toBe('https://eth.llamarpc.com')
      expect(config.explorerUrl).toBe('https://etherscan.io')
    })
  })

  describe('getDefaultChainId', () => {
    it('should return 8283 by default', () => {
      const chainId = getDefaultChainId()
      expect(chainId).toBe(8283)
    })

    it('should override from env var', () => {
      process.env.STABLENET_DEFAULT_CHAIN_ID = '11155111'
      const chainId = getDefaultChainId()
      expect(chainId).toBe(11155111)
    })

    it('should return default for non-numeric env var', () => {
      process.env.STABLENET_DEFAULT_CHAIN_ID = 'invalid'
      const chainId = getDefaultChainId()
      expect(chainId).toBe(8283)
    })
  })

  describe('getNetworkConfigByChainId', () => {
    it('should return config for Anvil', () => {
      const config = getNetworkConfigByChainId(31337)
      expect(config?.rpcUrl).toBe('http://127.0.0.1:8545')
    })

    it('should return config for LOCAL', () => {
      const config = getNetworkConfigByChainId(8283)
      expect(config?.rpcUrl).toBe('http://127.0.0.1:8501')
    })

    it('should return config for Sepolia', () => {
      const config = getNetworkConfigByChainId(11155111)
      expect(config?.rpcUrl).toBe('https://rpc.sepolia.org')
    })

    it('should return config for Mainnet', () => {
      const config = getNetworkConfigByChainId(1)
      expect(config?.rpcUrl).toBe('https://eth.llamarpc.com')
    })

    it('should return undefined for unknown chain', () => {
      expect(getNetworkConfigByChainId(99999)).toBeUndefined()
    })

    it('should return undefined for removed Devnet (1337)', () => {
      expect(getNetworkConfigByChainId(1337)).toBeUndefined()
    })
  })

  describe('applyEnvOverrides', () => {
    it('should override network URLs from env', () => {
      process.env.STABLENET_ANVIL_RPC_URL = 'http://overridden:8545'
      const network = applyEnvOverrides({
        chainId: 31337,
        name: 'Test',
        rpcUrl: 'http://original:8545',
        bundlerUrl: 'http://original:4337',
        paymasterUrl: 'http://original:4338',
        currency: ETH_CURRENCY,
        isTestnet: true,
      })
      expect(network.rpcUrl).toBe('http://overridden:8545')
    })

    it('should return network unchanged for unknown chainId', () => {
      const original = {
        chainId: 99999,
        name: 'Unknown',
        rpcUrl: 'http://original',
        bundlerUrl: 'http://original',
        paymasterUrl: 'http://original',
        currency: ETH_CURRENCY,
        isTestnet: true,
      }
      const result = applyEnvOverrides(original)
      expect(result).toEqual(original)
    })
  })

  describe('getSDKEnvHelp', () => {
    it('should return help text with all chain prefixes', () => {
      const help = getSDKEnvHelp()
      expect(help).toContain('STABLENET_ANVIL_RPC_URL')
      expect(help).toContain('STABLENET_LOCAL_RPC_URL')
      expect(help).toContain('STABLENET_SEPOLIA_RPC_URL')
      expect(help).toContain('STABLENET_MAINNET_RPC_URL')
    })

    it('should not contain devnet references', () => {
      const help = getSDKEnvHelp()
      expect(help).not.toContain('DEVNET')
    })
  })
})

describe('Package Exports', () => {
  it('should export all entry point constants and functions', async () => {
    const exports = await import('../src')

    expect(exports.ENTRY_POINT_V09).toBeDefined()
    expect(exports.ENTRY_POINT_V07).toBeDefined()
    expect(exports.ENTRY_POINT_V06).toBeDefined()
    expect(exports.ENTRY_POINT_ADDRESS).toBeDefined()
    expect(exports.ENTRY_POINT_ADDRESSES).toBeDefined()
    expect(exports.ENTRY_POINT_V09_CANONICAL).toBeDefined()
    expect(typeof exports.isEntryPoint).toBe('function')
    expect(typeof exports.getEntryPointVersion).toBe('function')
  })

  it('should export all network constants and functions', async () => {
    const exports = await import('../src')

    expect(exports.CHAIN_IDS).toBeDefined()
    expect(exports.ETH_CURRENCY).toBeDefined()
    expect(exports.WKRC_CURRENCY).toBeDefined()
    expect(exports.ANVIL_NETWORK).toBeDefined()
    expect(exports.LOCAL_NETWORK).toBeDefined()
    expect(exports.DEFAULT_NETWORKS).toBeDefined()
    expect(exports.ALL_NETWORKS).toBeDefined()
    expect(typeof exports.getNetworkByChainId).toBe('function')
    expect(typeof exports.isSupportedChainId).toBe('function')
    expect(typeof exports.isTestnet).toBe('function')
  })

  it('should export chain functions (delegated to @stablenet/contracts)', async () => {
    const exports = await import('../src')

    expect(typeof exports.getChainConfig).toBe('function')
    expect(typeof exports.getChainAddresses).toBe('function')
    expect(typeof exports.getServiceUrls).toBe('function')
    expect(typeof exports.getChainTokens).toBe('function')
  })
})
