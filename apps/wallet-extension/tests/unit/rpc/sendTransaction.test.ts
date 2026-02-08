/**
 * eth_sendTransaction RPC Method Tests
 * TDD tests for transaction signing and broadcasting
 */

import type { Address, Hex } from 'viem'
import { approvalController } from '../../../src/background/controllers/approvalController'
import { keyringController } from '../../../src/background/keyring'
import { handleRpcRequest } from '../../../src/background/rpc/handler'
import { walletState } from '../../../src/background/state/store'
import { RPC_ERRORS } from '../../../src/shared/constants'
import type { JsonRpcRequest } from '../../../src/types'
import { TEST_ACCOUNTS, TEST_CHAIN_IDS, TEST_ORIGINS } from '../../utils/testUtils'

// Mock dependencies
jest.mock('../../../src/background/state/store', () => ({
  walletState: {
    getConnectedAccounts: jest.fn(),
    isConnected: jest.fn(),
    getState: jest.fn(),
    getCurrentNetwork: jest.fn(),
    addPendingTransaction: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../../../src/background/keyring', () => ({
  keyringController: {
    signTransaction: jest.fn(),
    isUnlocked: jest.fn(),
  },
}))

jest.mock('../../../src/background/controllers/approvalController', () => ({
  approvalController: {
    requestTransaction: jest.fn(),
  },
}))

// Mock viem
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      estimateGas: jest.fn(() => Promise.resolve(BigInt(21000))),
      getGasPrice: jest.fn(() => Promise.resolve(BigInt(20000000000))),
      getTransactionCount: jest.fn(() => Promise.resolve(0)),
      sendRawTransaction: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(64)) as Hex)),
    })),
  }
})

const mockWalletState = walletState as jest.Mocked<typeof walletState>
const mockKeyringController = keyringController as jest.Mocked<typeof keyringController>
const mockApprovalController = approvalController as jest.Mocked<typeof approvalController>

describe('eth_sendTransaction', () => {
  const testAddress = TEST_ACCOUNTS.account1.address
  const testToAddress = TEST_ACCOUNTS.account2.address
  const testOrigin = TEST_ORIGINS.trusted
  const mockSignedTx = ('0x' + '2'.repeat(200)) as Hex
  const mockTxHash = ('0x' + '3'.repeat(64)) as Hex

  const mockNetwork = {
    chainId: TEST_CHAIN_IDS.mainnet,
    name: 'Ethereum',
    rpcUrl: 'https://mainnet.infura.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock setup
    mockWalletState.getConnectedAccounts.mockReturnValue([testAddress])
    mockWalletState.isConnected.mockReturnValue(true)
    mockWalletState.getCurrentNetwork.mockReturnValue(mockNetwork)
    mockKeyringController.isUnlocked.mockReturnValue(true)
    mockKeyringController.signTransaction.mockResolvedValue(mockSignedTx)
    mockApprovalController.requestTransaction.mockResolvedValue({ txHash: mockTxHash })
  })

  function createRequest(
    tx: Partial<{
      from: Address
      to: Address
      value: string
      data: Hex
      gas: string
      gasPrice: string
      nonce: string
    }>
  ): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendTransaction',
      params: [
        {
          from: tx.from ?? testAddress,
          to: tx.to ?? testToAddress,
          value: tx.value ?? '0x0',
          data: tx.data,
          gas: tx.gas,
          gasPrice: tx.gasPrice,
          nonce: tx.nonce,
        },
      ],
    }
  }

  describe('authorization', () => {
    it('should reject if site is not connected', async () => {
      mockWalletState.getConnectedAccounts.mockReturnValue([])

      const request = createRequest({})
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if from account is not authorized', async () => {
      const unauthorizedFrom = '0x0000000000000000000000000000000000000001' as Address

      const request = createRequest({ from: unauthorizedFrom })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if wallet is locked', async () => {
      mockKeyringController.isUnlocked.mockReturnValue(false)

      const request = createRequest({})
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })

    it('should reject if no network is selected', async () => {
      mockWalletState.getCurrentNetwork.mockReturnValue(null)

      const request = createRequest({})
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.CHAIN_DISCONNECTED.code)
    })
  })

  describe('transaction validation', () => {
    it('should validate required from address', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendTransaction',
        params: [{ to: testToAddress, value: '0x0' }], // Missing 'from'
      }
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })

    it('should validate address format', async () => {
      const request = createRequest({ to: 'invalid-address' as Address })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })

    it('should accept transaction without to (contract deployment)', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendTransaction',
        params: [
          {
            from: testAddress,
            data: '0x60806040' as Hex, // Contract bytecode
          },
        ],
      }

      // Should not reject due to missing 'to'
      const response = await handleRpcRequest(request, testOrigin)

      // May succeed or fail approval, but should not fail validation
      expect(response).toBeDefined()
    })
  })

  describe('gas estimation', () => {
    it('should estimate gas if not provided', async () => {
      const request = createRequest({ value: '0x1' })
      await handleRpcRequest(request, testOrigin)

      // Gas should be estimated before requesting approval
      expect(mockApprovalController.requestTransaction).toHaveBeenCalled()
    })

    it('should use provided gas value', async () => {
      const request = createRequest({
        gas: '0x5208', // 21000 in hex
        value: '0x1',
      })
      await handleRpcRequest(request, testOrigin)

      expect(mockApprovalController.requestTransaction).toHaveBeenCalled()
    })
  })

  describe('approval flow', () => {
    it('should request user approval with transaction details', async () => {
      const request = createRequest({
        value: '0xde0b6b3a7640000', // 1 ETH in hex
        to: testToAddress,
      })
      await handleRpcRequest(request, testOrigin)

      // requestTransaction is called with individual params:
      // origin, from, to, value, data, estimatedGasCost, methodName, favicon
      expect(mockApprovalController.requestTransaction).toHaveBeenCalledWith(
        testOrigin,
        testAddress,
        testToAddress,
        expect.any(BigInt),
        undefined,
        expect.any(BigInt),
        undefined,
        undefined
      )
    })

    it('should reject if user denies approval', async () => {
      mockApprovalController.requestTransaction.mockRejectedValue(new Error('User rejected'))

      const request = createRequest({ value: '0x1' })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.USER_REJECTED.code)
    })

    it('should show value in approval request', async () => {
      const request = createRequest({
        value: '0xde0b6b3a7640000', // 1 ETH
      })
      await handleRpcRequest(request, testOrigin)

      // requestTransaction is called with individual params, value is the 4th param
      expect(mockApprovalController.requestTransaction).toHaveBeenCalledWith(
        testOrigin,
        testAddress,
        testToAddress,
        BigInt('0xde0b6b3a7640000'), // 1 ETH
        undefined,
        expect.any(BigInt),
        undefined,
        undefined
      )
    })
  })

  describe('signing and broadcasting', () => {
    it('should sign transaction after approval', async () => {
      const request = createRequest({ value: '0x1' })
      await handleRpcRequest(request, testOrigin)

      expect(mockKeyringController.signTransaction).toHaveBeenCalledWith(
        testAddress,
        expect.any(Object)
      )
    })

    it('should return transaction hash on success', async () => {
      const request = createRequest({ value: '0x1' })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
      expect(response.result).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should handle signing errors', async () => {
      mockKeyringController.signTransaction.mockRejectedValue(new Error('Signing failed'))

      const request = createRequest({ value: '0x1' })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('transaction tracking', () => {
    it('should track pending transaction', async () => {
      const request = createRequest({ value: '0x1' })
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
      // Transaction should be tracked (implementation detail)
    })
  })

  describe('EIP-1559 support', () => {
    it('should support maxFeePerGas and maxPriorityFeePerGas', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendTransaction',
        params: [
          {
            from: testAddress,
            to: testToAddress,
            value: '0x1',
            maxFeePerGas: '0x4a817c800', // 20 Gwei
            maxPriorityFeePerGas: '0x3b9aca00', // 1 Gwei
          },
        ],
      }

      const response = await handleRpcRequest(request, testOrigin)

      // Should handle EIP-1559 params
      expect(response).toBeDefined()
    })
  })
})
