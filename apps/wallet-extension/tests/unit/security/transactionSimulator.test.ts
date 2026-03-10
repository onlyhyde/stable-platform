/**
 * TransactionSimulator Tests
 * Tests for transaction simulation via eth_call
 */

import type { Address, Hex } from 'viem'

// Mock viem before importing the module under test
jest.mock('viem', () => {
  const mockCall = jest.fn()
  return {
    createPublicClient: jest.fn(() => ({
      call: mockCall,
    })),
    http: jest.fn((url: string) => ({ url })),
    // Re-export types are handled by TypeScript, just need runtime mocks
    __mockCall: mockCall,
  }
})

import {
  type SimulationParams,
  simulateTransaction,
} from '../../../src/background/security/transactionSimulator'
import type { Network } from '../../../src/types'

// Access the mock call function
const viem = jest.requireMock('viem') as { __mockCall: jest.Mock; createPublicClient: jest.Mock }

const mockNetwork: Network = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://rpc.example.com',
  currency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

const mockFrom = '0x1111111111111111111111111111111111111111' as Address
const mockTo = '0x2222222222222222222222222222222222222222' as Address

describe('transactionSimulator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    viem.__mockCall.mockReset()
  })

  describe('simulateTransaction - successful simulation', () => {
    it('should return success for a simple ETH transfer', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        value: 1000000000000000000n, // 1 ETH
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(true)
      expect(result.revertReason).toBeUndefined()
      expect(result.warnings).toEqual([])
      expect(result.decodedCallData).toBeNull()
    })

    it('should track native value transfer as balance change', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        value: 5000000000000000000n, // 5 ETH
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.balanceChanges).toHaveLength(1)
      expect(result.balanceChanges[0]!.asset).toBe('native')
      expect(result.balanceChanges[0]!.symbol).toBe('ETH')
      expect(result.balanceChanges[0]!.amount).toBe(5000000000000000000n)
      expect(result.balanceChanges[0]!.direction).toBe('out')
    })

    it('should not add balance change for zero value', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        value: 0n,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.balanceChanges).toHaveLength(0)
    })

    it('should not add balance change when value is undefined', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.balanceChanges).toHaveLength(0)
    })

    it('should decode calldata when present', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const to = '0000000000000000000000002222222222222222222222222222222222222222'
      const amount = '0000000000000000000000000000000000000000000000000000000000000064'
      const transferData = ('0xa9059cbb' + to + amount) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data: transferData,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(true)
      expect(result.decodedCallData).not.toBeNull()
      expect(result.decodedCallData!.functionName).toBe('transfer')
    })
  })

  describe('simulateTransaction - warning generation', () => {
    it('should warn about UNLIMITED token approval', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const spender = '0000000000000000000000002222222222222222222222222222222222222222'
      const maxUint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const approveData = ('0x095ea7b3' + spender + maxUint) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data: approveData,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.warnings).toContain('This transaction grants UNLIMITED token approval')
    })

    it('should not warn about limited approval', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const spender = '0000000000000000000000002222222222222222222222222222222222222222'
      const amount = '0000000000000000000000000000000000000000000000000000000000000064'
      const approveData = ('0x095ea7b3' + spender + amount) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data: approveData,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.warnings).not.toContain('This transaction grants UNLIMITED token approval')
    })

    it('should warn about setApprovalForAll with approved=true', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const operator = '0000000000000000000000002222222222222222222222222222222222222222'
      const approved = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = ('0xa22cb465' + operator + approved) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.warnings).toContain('This grants access to ALL your NFTs in this collection')
    })

    it('should not warn about setApprovalForAll with approved=false', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const operator = '0000000000000000000000002222222222222222222222222222222222222222'
      const approved = '0000000000000000000000000000000000000000000000000000000000000000'
      const data = ('0xa22cb465' + operator + approved) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.warnings).not.toContain(
        'This grants access to ALL your NFTs in this collection'
      )
    })
  })

  describe('simulateTransaction - failure paths', () => {
    it('should return failure when eth_call reverts', async () => {
      viem.__mockCall.mockRejectedValueOnce(new Error('execution reverted: Insufficient balance'))

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        value: 1000n,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.revertReason).toBe('Insufficient balance')
      expect(result.warnings).toContain(
        'Transaction simulation failed - this transaction may revert'
      )
    })

    it('should extract revert reason from "execution reverted:" pattern', async () => {
      viem.__mockCall.mockRejectedValueOnce(
        new Error('execution reverted: ERC20: transfer amount exceeds balance')
      )

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data: '0xa9059cbb' as Hex,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.revertReason).toBe('ERC20: transfer amount exceeds balance')
    })

    it('should handle non-Error revert', async () => {
      viem.__mockCall.mockRejectedValueOnce('unknown string error')

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.revertReason).toBe('Unknown error')
    })

    it('should detect Kernel reentrancy error (0xab143c06)', async () => {
      viem.__mockCall.mockRejectedValueOnce(new Error('execution reverted: 0xab143c06'))

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.warnings).toContain(
        'Reentrancy detected in module operation. Module install/uninstall must be executed sequentially.'
      )
    })

    it('should still include decoded calldata on failure', async () => {
      viem.__mockCall.mockRejectedValueOnce(new Error('execution reverted: Out of gas'))

      const to = '0000000000000000000000002222222222222222222222222222222222222222'
      const amount = '0000000000000000000000000000000000000000000000000000000000000064'
      const transferData = ('0xa9059cbb' + to + amount) as Hex

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        data: transferData,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.decodedCallData).not.toBeNull()
      expect(result.decodedCallData!.functionName).toBe('transfer')
    })

    it('should still include balance changes on failure', async () => {
      viem.__mockCall.mockRejectedValueOnce(new Error('execution reverted'))

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        value: 1000n,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(false)
      expect(result.balanceChanges).toHaveLength(1)
    })
  })

  describe('simulateTransaction - client creation', () => {
    it('should create public client with correct RPC URL', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
      }

      await simulateTransaction(params, mockNetwork)

      expect(viem.createPublicClient).toHaveBeenCalled()
    })
  })

  describe('simulateTransaction - params handling', () => {
    it('should pass null to as undefined', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: null,
      }

      const result = await simulateTransaction(params, mockNetwork)

      expect(result.success).toBe(true)
      expect(viem.__mockCall).toHaveBeenCalledWith(expect.objectContaining({ to: undefined }))
    })

    it('should pass gas parameter when provided', async () => {
      viem.__mockCall.mockResolvedValueOnce({ data: '0x' })

      const params: SimulationParams = {
        from: mockFrom,
        to: mockTo,
        gas: 21000n,
      }

      await simulateTransaction(params, mockNetwork)

      expect(viem.__mockCall).toHaveBeenCalledWith(expect.objectContaining({ gas: 21000n }))
    })
  })
})
