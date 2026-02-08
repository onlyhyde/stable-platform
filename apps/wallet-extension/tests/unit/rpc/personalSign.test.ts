/**
 * personal_sign RPC Method Tests
 * TDD tests for EIP-191 personal message signing
 */

import type { Address, Hex } from 'viem'
import { approvalController } from '../../../src/background/controllers/approvalController'
import { keyringController } from '../../../src/background/keyring'
import { handleRpcRequest } from '../../../src/background/rpc/handler'
import { walletState } from '../../../src/background/state/store'
import { RPC_ERRORS } from '../../../src/shared/constants'
import type { JsonRpcRequest } from '../../../src/types'
import { TEST_ACCOUNTS, TEST_ORIGINS } from '../../utils/testUtils'

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
    signMessage: jest.fn(),
    isUnlocked: jest.fn(),
  },
}))

jest.mock('../../../src/background/controllers/approvalController', () => ({
  approvalController: {
    requestSignMessage: jest.fn(),
  },
}))

const mockWalletState = walletState as jest.Mocked<typeof walletState>
const mockKeyringController = keyringController as jest.Mocked<typeof keyringController>
const mockApprovalController = approvalController as jest.Mocked<typeof approvalController>

describe('personal_sign', () => {
  const testAddress = TEST_ACCOUNTS.account1.address
  const testMessage = '0x48656c6c6f20576f726c64' as Hex // "Hello World" in hex
  const testOrigin = TEST_ORIGINS.trusted
  const mockSignature = ('0x' + '1'.repeat(130)) as Hex

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock setup - connected and unlocked
    mockWalletState.getConnectedAccounts.mockReturnValue([testAddress])
    mockWalletState.isConnected.mockReturnValue(true)
    mockKeyringController.isUnlocked.mockReturnValue(true)
    mockKeyringController.signMessage.mockResolvedValue(mockSignature)
    mockApprovalController.requestSignMessage.mockResolvedValue({ approved: true })
  })

  function createRequest(message: Hex, address: Address): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: 1,
      method: 'personal_sign',
      params: [message, address],
    }
  }

  describe('authorization', () => {
    it('should reject if site is not connected', async () => {
      mockWalletState.getConnectedAccounts.mockReturnValue([])

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if account is not authorized for this site', async () => {
      const unauthorizedAddress = '0x0000000000000000000000000000000000000001' as Address
      mockWalletState.getConnectedAccounts.mockReturnValue([testAddress]) // Different address connected

      const request = createRequest(testMessage, unauthorizedAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.UNAUTHORIZED.code)
    })

    it('should reject if wallet is locked', async () => {
      mockKeyringController.isUnlocked.mockReturnValue(false)

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      // Should return an error indicating wallet is locked
    })
  })

  describe('approval flow', () => {
    it('should request user approval before signing', async () => {
      const request = createRequest(testMessage, testAddress)
      await handleRpcRequest(request, testOrigin)

      expect(mockApprovalController.requestSignMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: testOrigin,
          message: testMessage,
          address: testAddress,
        })
      )
    })

    it('should reject if user denies approval', async () => {
      mockApprovalController.requestSignMessage.mockResolvedValue({ approved: false })

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(RPC_ERRORS.USER_REJECTED.code)
    })

    it('should reject if approval times out', async () => {
      mockApprovalController.requestSignMessage.mockRejectedValue(new Error('Timeout'))

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('signing', () => {
    it('should sign message after user approval', async () => {
      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(mockKeyringController.signMessage).toHaveBeenCalledWith(testAddress, testMessage)
      expect(response.result).toBe(mockSignature)
    })

    it('should return valid signature format', async () => {
      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toMatch(/^0x[a-fA-F0-9]+$/)
      // EIP-191 signatures are 65 bytes = 130 hex chars + '0x'
      expect((response.result as string).length).toBe(132)
    })

    it('should handle signing errors gracefully', async () => {
      mockKeyringController.signMessage.mockRejectedValue(new Error('Signing failed'))

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('parameter validation', () => {
    it('should accept hex-encoded message', async () => {
      const hexMessage = '0x68656c6c6f' as Hex // "hello"
      const request = createRequest(hexMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
      expect(response.error).toBeUndefined()
    })

    it('should handle empty message', async () => {
      const emptyMessage = '0x' as Hex
      const request = createRequest(emptyMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      // Should either succeed or return appropriate error
      expect(response).toBeDefined()
    })

    it('should validate address format', async () => {
      const invalidAddress = 'invalid-address' as Address

      const request = createRequest(testMessage, invalidAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.error).toBeDefined()
    })
  })

  describe('case sensitivity', () => {
    it('should handle lowercase addresses', async () => {
      const lowercaseAddress = testAddress.toLowerCase() as Address
      mockWalletState.getConnectedAccounts.mockReturnValue([lowercaseAddress])

      const request = createRequest(testMessage, lowercaseAddress)
      const response = await handleRpcRequest(request, testOrigin)

      expect(response.result).toBeDefined()
    })

    it('should handle checksummed addresses', async () => {
      // The address comparison should be case-insensitive
      mockWalletState.getConnectedAccounts.mockReturnValue([testAddress.toLowerCase() as Address])

      const request = createRequest(testMessage, testAddress)
      const response = await handleRpcRequest(request, testOrigin)

      // Should still work despite case difference
      expect(response.result).toBeDefined()
    })
  })
})
