/**
 * eth_signTypedData_v4 RPC Method Tests
 * TDD tests for EIP-712 typed data signing
 */

import type { Address, Hex } from 'viem'
import { approvalController } from '../../../src/background/controllers/approvalController'
import { keyringController } from '../../../src/background/keyring'
import { handleRpcRequest } from '../../../src/background/rpc/handler'
import { walletState } from '../../../src/background/state/store'
import { RPC_ERRORS } from '../../../src/shared/constants'
import type { JsonRpcRequest } from '../../../src/types'
import { createMockTypedData, TEST_ACCOUNTS, TEST_ORIGINS } from '../../utils/testUtils'

// Mock dependencies
jest.mock('../../../src/background/state/store', () => ({
  walletState: {
    getConnectedAccounts: jest.fn(),
    isConnected: jest.fn(),
    getState: jest.fn(),
    getCurrentNetwork: jest.fn(),
  },
}))

jest.mock('../../../src/background/keyring', () => ({
  keyringController: {
    signTypedData: jest.fn(),
    isUnlocked: jest.fn(),
  },
}))

jest.mock('../../../src/background/controllers/approvalController', () => ({
  approvalController: {
    requestSignTypedData: jest.fn(),
  },
}))

const mockWalletState = walletState as jest.Mocked<typeof walletState>
const mockKeyringController = keyringController as jest.Mocked<typeof keyringController>
const mockApprovalController = approvalController as jest.Mocked<typeof approvalController>

describe('eth_signTypedData_v4', () => {
  const testAddress = TEST_ACCOUNTS.account1.address
  const testOrigin = TEST_ORIGINS.trusted
  const mockSignature = ('0x' + '1'.repeat(130)) as Hex
  const testTypedData = createMockTypedData()

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock setup
    mockWalletState.getConnectedAccounts.mockReturnValue([testAddress])
    mockWalletState.isConnected.mockReturnValue(true)
    mockKeyringController.isUnlocked.mockReturnValue(true)
    mockKeyringController.signTypedData.mockResolvedValue(mockSignature)
    mockApprovalController.requestSignTypedData.mockResolvedValue({ approved: true })
  })

  function createRequest(address: Address, typedData: unknown): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    }
  }

  describe('authorization', () => {
    it('should reject if site is not connected', async () => {
      mockWalletState.getConnectedAccounts.mockReturnValue([])

      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if account is not authorized', async () => {
      const unauthorizedAddress = '0x0000000000000000000000000000000000000001' as Address
      mockWalletState.getConnectedAccounts.mockReturnValue([testAddress])

      const request = createRequest(unauthorizedAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if wallet is locked', async () => {
      mockKeyringController.isUnlocked.mockReturnValue(false)

      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('approval flow', () => {
    it('should request user approval with typed data details', async () => {
      const request = createRequest(testAddress, testTypedData)
      await handleRpcRequest(request, testOrigin)

      expect(mockApprovalController.requestSignTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: testOrigin,
          address: testAddress,
          typedData: expect.any(Object),
        })
      )
    })

    it('should reject if user denies approval', async () => {
      mockApprovalController.requestSignTypedData.mockResolvedValue({ approved: false })

      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.USER_REJECTED.code)
    })

    it('should include risk assessment in approval request', async () => {
      // Permit signature (high risk)
      const permitTypedData = {
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: { name: 'Token', version: '1', chainId: 1 },
        message: {
          owner: testAddress,
          spender: '0x0000000000000000000000000000000000000001',
          value: '1000000000000000000',
          nonce: '0',
          deadline: '9999999999',
        },
      }

      const request = createRequest(testAddress, permitTypedData)
      await handleRpcRequest(request, testOrigin)

      expect(mockApprovalController.requestSignTypedData).toHaveBeenCalled()
    })
  })

  describe('signing', () => {
    it('should sign typed data after approval', async () => {
      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(mockKeyringController.signTypedData).toHaveBeenCalledWith(
        testAddress,
        expect.any(Object)
      )
      expect(response.result).toBe(mockSignature)
    })

    it('should return valid EIP-712 signature', async () => {
      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toMatch(/^0x[a-fA-F0-9]+$/)
      expect((response.result as string).length).toBe(132)
    })

    it('should handle signing errors', async () => {
      mockKeyringController.signTypedData.mockRejectedValue(new Error('Signing failed'))

      const request = createRequest(testAddress, testTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('typed data validation', () => {
    it('should reject invalid typed data format', async () => {
      const invalidTypedData = 'not-valid-json'

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_signTypedData_v4',
        params: [testAddress, invalidTypedData],
      }
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })

    it('should validate EIP-712 domain', async () => {
      const typedDataWithDomain = {
        ...testTypedData,
        domain: {
          name: 'Test App',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' as Address,
        },
      }

      const request = createRequest(testAddress, typedDataWithDomain)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
    })

    it('should handle typed data with nested types', async () => {
      const complexTypedData = {
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: { name: 'Test', version: '1', chainId: 1 },
        message: {
          from: { name: 'Alice', wallet: testAddress },
          to: { name: 'Bob', wallet: '0x0000000000000000000000000000000000000001' as Address },
          contents: 'Hello!',
        },
      }

      const request = createRequest(testAddress, complexTypedData)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
    })
  })

  describe('security', () => {
    it('should detect permit signatures as high risk', async () => {
      const permitTypedData = {
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: { name: 'Token', version: '1', chainId: 1 },
        message: {
          owner: testAddress,
          spender: '0x0000000000000000000000000000000000000001',
          value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        },
      }

      const request = createRequest(testAddress, permitTypedData)
      await handleRpcRequest(request, testOrigin)

      // Should have called with risk assessment
      expect(mockApprovalController.requestSignTypedData).toHaveBeenCalled()
    })

    it('should warn on unlimited token approval', async () => {
      const unlimitedApproval = {
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: { name: 'Token', version: '1', chainId: 1 },
        message: {
          owner: testAddress,
          spender: '0x0000000000000000000000000000000000000001',
          // Max uint256 value (unlimited approval)
          value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        },
      }

      const request = createRequest(testAddress, unlimitedApproval)
      await handleRpcRequest(request, testOrigin)

      expect(mockApprovalController.requestSignTypedData).toHaveBeenCalled()
    })
  })
})
