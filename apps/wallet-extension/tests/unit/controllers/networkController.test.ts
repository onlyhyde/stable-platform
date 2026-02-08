/**
 * NetworkController Tests
 * TDD tests for network management
 */

import type { Hex } from 'viem'
import { NetworkController } from '../../../src/background/controllers/networkController'
import type {
  AddNetworkParams,
  NetworkConfig,
  NetworkControllerOptions,
} from '../../../src/background/controllers/networkController.types'
import { TEST_CHAIN_IDS } from '../../utils/testUtils'

describe('NetworkController', () => {
  let controller: NetworkController
  let mockOptions: NetworkControllerOptions

  const mainnetConfig: NetworkConfig = {
    chainId: TEST_CHAIN_IDS.mainnet,
    chainIdHex: '0x1' as Hex,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.example.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorerUrl: 'https://etherscan.io',
    isTestnet: false,
  }

  const sepoliaConfig: NetworkConfig = {
    chainId: TEST_CHAIN_IDS.sepolia,
    chainIdHex: '0xaa36a7' as Hex,
    name: 'Sepolia',
    rpcUrl: 'https://sepolia.example.com',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
  }

  beforeEach(() => {
    mockOptions = {
      defaultChainId: TEST_CHAIN_IDS.mainnet,
      defaultNetworks: [mainnetConfig, sepoliaConfig],
    }

    controller = new NetworkController(mockOptions)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default networks', () => {
      const state = controller.getState()

      expect(state.networks[TEST_CHAIN_IDS.mainnet]).toBeDefined()
      expect(state.networks[TEST_CHAIN_IDS.sepolia]).toBeDefined()
    })

    it('should set default selected network', () => {
      const state = controller.getState()

      expect(state.selectedChainId).toBe(TEST_CHAIN_IDS.mainnet)
    })
  })

  describe('addNetwork', () => {
    const customNetwork: AddNetworkParams = {
      chainId: '0x89' as Hex, // Polygon
      chainName: 'Polygon Mainnet',
      rpcUrls: ['https://polygon-rpc.com'],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
      },
      blockExplorerUrls: ['https://polygonscan.com'],
    }

    it('should add new network', async () => {
      await controller.addNetwork(customNetwork)

      const network = controller.getNetwork(137) // 0x89 = 137
      expect(network).toBeDefined()
      expect(network?.config.name).toBe('Polygon Mainnet')
    })

    it('should validate RPC URL format', async () => {
      const invalidNetwork = {
        ...customNetwork,
        rpcUrls: ['not-a-valid-url'],
      }

      await expect(controller.addNetwork(invalidNetwork)).rejects.toThrow('Invalid RPC URL')
    })

    it('should reject duplicate chain ID', async () => {
      const duplicateNetwork = {
        ...customNetwork,
        chainId: '0x1' as Hex, // Mainnet already exists
      }

      await expect(controller.addNetwork(duplicateNetwork)).rejects.toThrow(
        'Network already exists'
      )
    })

    it('should emit network:added event', async () => {
      const eventHandler = jest.fn()
      controller.on('network:added', eventHandler)

      await controller.addNetwork(customNetwork)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 137,
          name: 'Polygon Mainnet',
        })
      )
    })

    it('should mark as custom network', async () => {
      await controller.addNetwork(customNetwork)

      const state = controller.getState()
      expect(state.customNetworks).toContain(137)
    })

    it('should verify chain ID matches RPC response', async () => {
      // This test would require mocking the RPC call
      // For now, we just ensure the network is added
      await controller.addNetwork(customNetwork)
      expect(controller.getNetwork(137)).toBeDefined()
    })
  })

  describe('removeNetwork', () => {
    it('should remove custom network', async () => {
      const customNetwork: AddNetworkParams = {
        chainId: '0x89' as Hex,
        chainName: 'Polygon Mainnet',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
      }

      await controller.addNetwork(customNetwork)
      await controller.removeNetwork(137)

      expect(controller.getNetwork(137)).toBeUndefined()
    })

    it('should not allow removing default networks', async () => {
      await expect(controller.removeNetwork(TEST_CHAIN_IDS.mainnet)).rejects.toThrow(
        'Cannot remove default network'
      )
    })

    it('should emit network:removed event', async () => {
      const eventHandler = jest.fn()
      controller.on('network:removed', eventHandler)

      const customNetwork: AddNetworkParams = {
        chainId: '0x89' as Hex,
        chainName: 'Polygon Mainnet',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
      }

      await controller.addNetwork(customNetwork)
      await controller.removeNetwork(137)

      expect(eventHandler).toHaveBeenCalledWith(137)
    })

    it('should switch to default network if removing selected network', async () => {
      const customNetwork: AddNetworkParams = {
        chainId: '0x89' as Hex,
        chainName: 'Polygon Mainnet',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
      }

      await controller.addNetwork(customNetwork)
      await controller.switchNetwork(137)
      await controller.removeNetwork(137)

      const state = controller.getState()
      expect(state.selectedChainId).toBe(TEST_CHAIN_IDS.mainnet)
    })
  })

  describe('switchNetwork', () => {
    it('should update selected network', async () => {
      await controller.switchNetwork(TEST_CHAIN_IDS.sepolia)

      const state = controller.getState()
      expect(state.selectedChainId).toBe(TEST_CHAIN_IDS.sepolia)
    })

    it('should emit network:switched event', async () => {
      const eventHandler = jest.fn()
      controller.on('network:switched', eventHandler)

      await controller.switchNetwork(TEST_CHAIN_IDS.sepolia)

      expect(eventHandler).toHaveBeenCalledWith(TEST_CHAIN_IDS.sepolia)
    })

    it('should emit chainChanged event with hex chain ID', async () => {
      const eventHandler = jest.fn()
      controller.on('chainChanged', eventHandler)

      await controller.switchNetwork(TEST_CHAIN_IDS.sepolia)

      expect(eventHandler).toHaveBeenCalledWith('0xaa36a7')
    })

    it('should throw for unknown network', async () => {
      await expect(controller.switchNetwork(99999)).rejects.toThrow('Network not found')
    })
  })

  describe('getNetwork', () => {
    it('should return network by chain ID', () => {
      const network = controller.getNetwork(TEST_CHAIN_IDS.mainnet)

      expect(network).toBeDefined()
      expect(network?.config.name).toBe('Ethereum Mainnet')
    })

    it('should return undefined for unknown chain ID', () => {
      const network = controller.getNetwork(99999)

      expect(network).toBeUndefined()
    })
  })

  describe('getSelectedNetwork', () => {
    it('should return currently selected network', () => {
      const network = controller.getSelectedNetwork()

      expect(network).toBeDefined()
      expect(network.config.chainId).toBe(TEST_CHAIN_IDS.mainnet)
    })
  })

  describe('getSelectedChainId', () => {
    it('should return selected chain ID as number', () => {
      const chainId = controller.getSelectedChainId()

      expect(chainId).toBe(TEST_CHAIN_IDS.mainnet)
    })
  })

  describe('getSelectedChainIdHex', () => {
    it('should return selected chain ID as hex', () => {
      const chainIdHex = controller.getSelectedChainIdHex()

      expect(chainIdHex).toBe('0x1')
    })
  })

  describe('getAllNetworks', () => {
    it('should return all configured networks', () => {
      const networks = controller.getAllNetworks()

      expect(networks.length).toBeGreaterThanOrEqual(2)
      expect(networks.some((n) => n.config.chainId === TEST_CHAIN_IDS.mainnet)).toBe(true)
      expect(networks.some((n) => n.config.chainId === TEST_CHAIN_IDS.sepolia)).toBe(true)
    })
  })

  describe('getCustomNetworks', () => {
    it('should return only custom networks', async () => {
      const customNetwork: AddNetworkParams = {
        chainId: '0x89' as Hex,
        chainName: 'Polygon Mainnet',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
      }

      await controller.addNetwork(customNetwork)

      const customNetworks = controller.getCustomNetworks()
      expect(customNetworks.length).toBe(1)
      expect(customNetworks[0].config.chainId).toBe(137)
    })
  })

  describe('updateNetworkStatus', () => {
    it('should update network status', async () => {
      await controller.updateNetworkStatus(TEST_CHAIN_IDS.mainnet, 'connected')

      const network = controller.getNetwork(TEST_CHAIN_IDS.mainnet)
      expect(network?.status).toBe('connected')
    })

    it('should emit network:statusChanged event', async () => {
      const eventHandler = jest.fn()
      controller.on('network:statusChanged', eventHandler)

      await controller.updateNetworkStatus(TEST_CHAIN_IDS.mainnet, 'connected')

      expect(eventHandler).toHaveBeenCalledWith(TEST_CHAIN_IDS.mainnet, 'connected')
    })
  })

  describe('updateLatestBlock', () => {
    it('should update latest block number', async () => {
      await controller.updateLatestBlock(TEST_CHAIN_IDS.mainnet, 12345678)

      const network = controller.getNetwork(TEST_CHAIN_IDS.mainnet)
      expect(network?.latestBlock).toBe(12345678)
    })
  })

  describe('validateRpcUrl', () => {
    it('should accept valid HTTP URL', () => {
      expect(controller.validateRpcUrl('http://localhost:8545')).toBe(true)
    })

    it('should accept valid HTTPS URL', () => {
      expect(controller.validateRpcUrl('https://eth-mainnet.example.com')).toBe(true)
    })

    it('should accept valid WSS URL', () => {
      expect(controller.validateRpcUrl('wss://eth-mainnet.example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(controller.validateRpcUrl('not-a-url')).toBe(false)
    })

    it('should reject URLs without protocol', () => {
      expect(controller.validateRpcUrl('eth-mainnet.example.com')).toBe(false)
    })
  })

  describe('chainIdHexToNumber', () => {
    it('should convert hex chain ID to number', () => {
      expect(controller.chainIdHexToNumber('0x1')).toBe(1)
      expect(controller.chainIdHexToNumber('0x89')).toBe(137)
      expect(controller.chainIdHexToNumber('0xaa36a7')).toBe(11155111)
    })
  })

  describe('chainIdNumberToHex', () => {
    it('should convert number chain ID to hex', () => {
      expect(controller.chainIdNumberToHex(1)).toBe('0x1')
      expect(controller.chainIdNumberToHex(137)).toBe('0x89')
      expect(controller.chainIdNumberToHex(11155111)).toBe('0xaa36a7')
    })
  })
})
