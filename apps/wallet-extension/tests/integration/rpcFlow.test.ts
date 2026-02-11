/**
 * RPC Flow Integration Tests
 *
 * Tests end-to-end RPC request handling through handleRpcRequest,
 * covering connect → sign → transaction → permission flows.
 */

// Mock @stablenet/core before any imports that depend on it
jest.mock('@stablenet/core', () => {
  const mockRateLimiter = {
    checkLimit: jest
      .fn()
      .mockReturnValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
    getStatus: jest.fn().mockReturnValue({ allowed: true, remaining: 100 }),
    reset: jest.fn(),
    resetAll: jest.fn(),
    destroy: jest.fn(),
    getLimitConfig: jest.fn().mockReturnValue({ maxRequests: 100, windowMs: 60000 }),
    setLimits: jest.fn(),
    getStats: jest
      .fn()
      .mockReturnValue({ totalOrigins: 0, blockedOrigins: 0, requestsByCategory: {} }),
  }
  const mockTypedDataValidator = {
    validateTypedData: jest.fn().mockReturnValue({ isValid: true, warnings: [], errors: [] }),
    getRiskLevel: jest.fn().mockReturnValue('low'),
    formatWarningsForDisplay: jest.fn().mockReturnValue([]),
  }
  return {
    InputValidator: jest.fn().mockImplementation(() => ({
      validateAddress: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateHex: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateRpcRequest: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateTransaction: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateChainId: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateUrl: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    })),
    createRateLimiter: jest.fn().mockReturnValue(mockRateLimiter),
    createTypedDataValidator: jest.fn().mockReturnValue(mockTypedDataValidator),
    createBundlerClient: jest.fn(),
    createModuleOperationClient: jest.fn(),
    getUserOperationHash: jest.fn(),
    getModuleTypeName: jest.fn(),
    createAuthorizationHash: jest.fn(),
    createAuthorization: jest.fn(),
    createSignedAuthorization: jest.fn(),
  }
})

jest.mock('@stablenet/plugin-stealth', () => ({
  createStealthPlugin: jest.fn(),
  generateStealthAddress: jest.fn(),
  deriveStealthKeys: jest.fn(),
}))

import type { Hex } from 'viem'
import { approvalController } from '../../src/background/controllers/approvalController'
import { keyringController } from '../../src/background/keyring'
import { handleRpcRequest } from '../../src/background/rpc/handler'
import { walletState } from '../../src/background/state/store'
import { RPC_ERRORS } from '../../src/shared/constants'
import { createMockRpcRequest, TEST_ACCOUNTS, TEST_ORIGINS } from '../utils/testUtils'

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../../src/background/state/store', () => ({
  walletState: {
    getConnectedAccounts: jest.fn(),
    isConnected: jest.fn(),
    getState: jest.fn(),
    getCurrentNetwork: jest.fn(),
    connectOrigin: jest.fn(),
    selectNetwork: jest.fn(),
  },
}))

jest.mock('../../src/background/keyring', () => ({
  keyringController: {
    signMessage: jest.fn(),
    signTypedData: jest.fn(),
    signTransaction: jest.fn(),
    isUnlocked: jest.fn(),
    getAllAccounts: jest.fn(),
  },
}))

jest.mock('../../src/background/controllers/approvalController', () => ({
  approvalController: {
    requestConnection: jest.fn(),
    requestSignMessage: jest.fn(),
    requestSignTypedData: jest.fn(),
    requestTransaction: jest.fn(),
  },
}))

jest.mock('../../src/background/security/phishingGuard', () => ({
  checkOrigin: jest.fn().mockResolvedValue({ isPhishing: false }),
}))

jest.mock('../../src/background/utils/eventBroadcaster', () => ({
  eventBroadcaster: {
    broadcastChainChanged: jest.fn().mockResolvedValue(undefined),
    broadcastAccountsChanged: jest.fn().mockResolvedValue(undefined),
  },
}))

// Properly mock viem
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn().mockReturnValue({
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(12345)),
      getGasPrice: jest.fn().mockResolvedValue(BigInt(20000000000)),
      getChainId: jest.fn().mockResolvedValue(1),
      getTransactionReceipt: jest.fn().mockResolvedValue(null),
      getTransaction: jest.fn().mockResolvedValue(null),
      getBlock: jest.fn().mockResolvedValue(null),
      call: jest.fn().mockResolvedValue({ data: '0x' }),
      estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
      getTransactionCount: jest.fn().mockResolvedValue(0),
      readContract: jest.fn().mockResolvedValue(null),
      getFeeHistory: jest.fn().mockResolvedValue({
        baseFeePerGas: [BigInt(10000000000)],
        gasUsedRatio: [0.5],
        oldestBlock: BigInt(12345),
        reward: [[BigInt(1500000000)]],
      }),
    }),
  }
})

const mockState = walletState as jest.Mocked<typeof walletState>
const mockKeyring = keyringController as jest.Mocked<typeof keyringController>
const mockApproval = approvalController as jest.Mocked<typeof approvalController>

const testAddress = TEST_ACCOUNTS.account1.address
const testOrigin = TEST_ORIGINS.trusted
const mockSignature = ('0x' + 'ab'.repeat(65)) as Hex

// ============================================================================
// Default Mock Setup
// ============================================================================

function setupConnectedState() {
  mockState.getConnectedAccounts.mockReturnValue([testAddress])
  mockState.isConnected.mockReturnValue(true)
  mockState.getCurrentNetwork.mockReturnValue({
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.rpc.example.com',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  })
  mockState.getState.mockReturnValue({
    accounts: {
      accounts: [{ address: testAddress, type: 'hd', name: 'Account 1' }],
      selectedAccount: testAddress,
    },
    networks: {
      networks: [
        {
          chainId: 1,
          name: 'Ethereum',
          rpcUrl: 'https://eth.rpc.example.com',
          currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        },
      ],
      selectedChainId: 1,
    },
    connections: {
      connectedSites: [{ origin: testOrigin, accounts: [testAddress], connectedAt: Date.now() }],
    },
  })
  mockKeyring.isUnlocked.mockReturnValue(true)
}

// ============================================================================
// Tests
// ============================================================================

describe('RPC Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupConnectedState()
  })

  // --------------------------------------------------------------------------
  // Connection Flow
  // --------------------------------------------------------------------------

  describe('connect → getAccounts flow', () => {
    it('should return empty accounts before connection', async () => {
      mockState.getConnectedAccounts.mockReturnValue([])

      const response = await handleRpcRequest(createMockRpcRequest('eth_accounts'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toEqual([])
    })

    it('should return accounts after connection', async () => {
      const response = await handleRpcRequest(createMockRpcRequest('eth_accounts'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toContain(testAddress)
    })

    it('should return chain ID for connected network', async () => {
      const response = await handleRpcRequest(createMockRpcRequest('eth_chainId'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toBe('0x1')
    })
  })

  // --------------------------------------------------------------------------
  // Sign Message Flow
  // --------------------------------------------------------------------------

  describe('connected → sign message flow', () => {
    it('should sign message when connected and approved', async () => {
      mockApproval.requestSignMessage.mockResolvedValue({ approved: true })
      mockKeyring.signMessage.mockResolvedValue(mockSignature)

      const message = '0x48656c6c6f' as Hex // "Hello"
      const response = await handleRpcRequest(
        createMockRpcRequest('personal_sign', [message, testAddress]),
        testOrigin
      )

      expect(response.error).toBeUndefined()
      expect(response.result).toBe(mockSignature)
      expect(mockApproval.requestSignMessage).toHaveBeenCalled()
      expect(mockKeyring.signMessage).toHaveBeenCalledWith(testAddress, message)
    })

    it('should reject sign when not connected', async () => {
      mockState.getConnectedAccounts.mockReturnValue([])

      const message = '0x48656c6c6f' as Hex
      const response = await handleRpcRequest(
        createMockRpcRequest('personal_sign', [message, testAddress]),
        testOrigin
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject sign when approval denied', async () => {
      mockApproval.requestSignMessage.mockRejectedValue({ code: 4001, message: 'User rejected' })

      const message = '0x48656c6c6f' as Hex
      const response = await handleRpcRequest(
        createMockRpcRequest('personal_sign', [message, testAddress]),
        testOrigin
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(4001)
    })
  })

  // --------------------------------------------------------------------------
  // Read-Only RPC Methods
  // --------------------------------------------------------------------------

  describe('read-only RPC methods', () => {
    it('eth_blockNumber should return block number', async () => {
      const response = await handleRpcRequest(createMockRpcRequest('eth_blockNumber'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    })

    it('eth_getBalance should return balance', async () => {
      const response = await handleRpcRequest(
        createMockRpcRequest('eth_getBalance', [testAddress, 'latest']),
        testOrigin
      )

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    })

    it('eth_gasPrice should return gas price', async () => {
      const response = await handleRpcRequest(createMockRpcRequest('eth_gasPrice'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    })

    it('net_version should return network version', async () => {
      const response = await handleRpcRequest(createMockRpcRequest('net_version'), testOrigin)

      expect(response.error).toBeUndefined()
      expect(response.result).toBe('1')
    })
  })

  // --------------------------------------------------------------------------
  // Permission Flow
  // --------------------------------------------------------------------------

  describe('permission management flow', () => {
    it('wallet_getPermissions should return empty when not connected', async () => {
      mockState.getConnectedAccounts.mockReturnValue([])

      const response = await handleRpcRequest(
        createMockRpcRequest('wallet_getPermissions'),
        testOrigin
      )

      expect(response.error).toBeUndefined()
      expect(response.result).toEqual([])
    })

    it('wallet_getPermissions should return eth_accounts when connected', async () => {
      const response = await handleRpcRequest(
        createMockRpcRequest('wallet_getPermissions'),
        testOrigin
      )

      expect(response.error).toBeUndefined()
      const permissions = response.result as Array<{ parentCapability: string }>
      expect(permissions.some((p) => p.parentCapability === 'eth_accounts')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  describe('error handling', () => {
    it('should return METHOD_NOT_FOUND for unsupported methods', async () => {
      const response = await handleRpcRequest(
        createMockRpcRequest('eth_nonExistentMethod'),
        testOrigin
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(RPC_ERRORS.METHOD_NOT_FOUND.code)
    })

    it('should return INVALID_PARAMS for malformed params', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'personal_sign',
        params: [] as unknown[], // Missing required params
      }

      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(RPC_ERRORS.INVALID_PARAMS.code)
    })

    it('should return CHAIN_DISCONNECTED when no network configured', async () => {
      mockState.getCurrentNetwork.mockReturnValue(undefined)

      const response = await handleRpcRequest(
        createMockRpcRequest('eth_getBalance', [testAddress, 'latest']),
        testOrigin
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(RPC_ERRORS.CHAIN_DISCONNECTED.code)
    })
  })

  // --------------------------------------------------------------------------
  // Network Switching Flow
  // --------------------------------------------------------------------------

  describe('network switching flow', () => {
    it('should switch to known network', async () => {
      mockState.getState.mockReturnValue({
        accounts: {
          accounts: [{ address: testAddress, type: 'hd', name: 'Account 1' }],
          selectedAccount: testAddress,
        },
        networks: {
          networks: [
            {
              chainId: 1,
              name: 'Ethereum',
              rpcUrl: 'https://eth.rpc.example.com',
              currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            },
            {
              chainId: 11155111,
              name: 'Sepolia',
              rpcUrl: 'https://sepolia.rpc.example.com',
              currency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              isTestnet: true,
            },
          ],
          selectedChainId: 1,
        },
        connections: {
          connectedSites: [
            { origin: testOrigin, accounts: [testAddress], connectedAt: Date.now() },
          ],
        },
      })

      const response = await handleRpcRequest(
        createMockRpcRequest('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]),
        testOrigin
      )

      expect(response.error).toBeUndefined()
      expect(mockState.selectNetwork).toHaveBeenCalledWith(11155111)
    })

    it('should reject switching to unknown network', async () => {
      const response = await handleRpcRequest(
        createMockRpcRequest('wallet_switchEthereumChain', [{ chainId: '0xdeadbeef' }]),
        testOrigin
      )

      expect(response.error).toBeDefined()
    })
  })
})
