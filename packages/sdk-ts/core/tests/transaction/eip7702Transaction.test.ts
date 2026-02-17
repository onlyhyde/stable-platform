/**
 * EIP-7702 Transaction Builder Tests
 *
 * Tests for delegation building, revocation, gas calculation,
 * delegation detection, and receipt waiting.
 */

import type { Address, Hash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockGetTransactionCount = vi.fn()
const mockGetBlock = vi.fn()
const mockEstimateMaxPriorityFeePerGas = vi.fn()
const mockGetCode = vi.fn()
const mockWaitForTransactionReceipt = vi.fn()
const mockSendRawTransaction = vi.fn()

vi.mock('../../src/providers', () => ({
  createViemProvider: () => ({
    getTransactionCount: mockGetTransactionCount,
    getBlock: mockGetBlock,
    estimateMaxPriorityFeePerGas: mockEstimateMaxPriorityFeePerGas,
    getCode: mockGetCode,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
    sendRawTransaction: mockSendRawTransaction,
  }),
}))

vi.mock('../../src/eip7702', () => ({
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  createAuthorizationHash: vi.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
}))

import { createEIP7702TransactionBuilder } from '../../src/transaction/eip7702Transaction'

// ============================================================================
// Test Data
// ============================================================================

const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678' as Address
const DELEGATE = '0xaabbccddee0011223344556677889900aabbccdd' as Address
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address

function createBuilder() {
  return createEIP7702TransactionBuilder({
    rpcUrl: 'https://rpc.example.com',
    chainId: 1,
  })
}

function createMockSigner() {
  return {
    signAuthorization: vi.fn().mockResolvedValue({
      v: 27,
      r: '0x' + 'aa'.repeat(32),
      s: '0x' + 'bb'.repeat(32),
    }),
    getAddress: vi.fn().mockResolvedValue(ACCOUNT),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('createEIP7702TransactionBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTransactionCount.mockResolvedValue(5)
    mockGetBlock.mockResolvedValue({ baseFeePerGas: 10_000_000_000n })
    mockEstimateMaxPriorityFeePerGas.mockResolvedValue(1_500_000_000n)
    mockGetCode.mockResolvedValue('0x')
    mockWaitForTransactionReceipt.mockResolvedValue({ status: '0x1' })
    mockSendRawTransaction.mockResolvedValue('0x' + 'ff'.repeat(32))
  })

  describe('initialization', () => {
    it('should create a builder with rpcUrl', () => {
      const builder = createBuilder()
      expect(builder).toBeDefined()
      expect(typeof builder.buildDelegation).toBe('function')
      expect(typeof builder.buildRevocation).toBe('function')
    })

    it('should throw without rpcUrl and without provider', () => {
      expect(() => createEIP7702TransactionBuilder({ chainId: 1 })).toThrow(
        /Either provider or rpcUrl must be provided/
      )
    })

    it('should accept an injected provider', () => {
      const provider = {
        getTransactionCount: vi.fn(),
        getBlock: vi.fn(),
        estimateMaxPriorityFeePerGas: vi.fn(),
        getCode: vi.fn(),
        waitForTransactionReceipt: vi.fn(),
      }
      const builder = createEIP7702TransactionBuilder({
        chainId: 1,
        provider: provider as unknown,
      })
      expect(builder).toBeDefined()
    })
  })

  describe('getAccountNonce()', () => {
    it('should fetch pending nonce from provider', async () => {
      const builder = createBuilder()
      const nonce = await builder.getAccountNonce(ACCOUNT)
      expect(mockGetTransactionCount).toHaveBeenCalledWith(ACCOUNT, 'pending')
      expect(nonce).toBe(5n)
    })
  })

  describe('getGasPrices()', () => {
    it('should return maxFeePerGas and maxPriorityFeePerGas', async () => {
      const builder = createBuilder()
      const gas = await builder.getGasPrices()
      expect(gas.maxFeePerGas).toBeGreaterThan(0n)
      expect(gas.maxPriorityFeePerGas).toBeGreaterThan(0n)
    })

    it('should calculate maxFeePerGas as baseFee * 2 + priorityFee', async () => {
      mockGetBlock.mockResolvedValue({ baseFeePerGas: 10n })
      mockEstimateMaxPriorityFeePerGas.mockResolvedValue(5_000_000_000n)
      const builder = createBuilder()
      const gas = await builder.getGasPrices()
      expect(gas.maxFeePerGas).toBe(10n * 2n + 5_000_000_000n)
    })

    it('should fallback to MIN_PRIORITY_FEE on estimation error', async () => {
      mockEstimateMaxPriorityFeePerGas.mockRejectedValue(new Error('fail'))
      const builder = createBuilder()
      const gas = await builder.getGasPrices()
      expect(gas.maxPriorityFeePerGas).toBeGreaterThan(0n)
    })

    it('should use MIN_PRIORITY_FEE when estimate is too low', async () => {
      mockEstimateMaxPriorityFeePerGas.mockResolvedValue(0n)
      const builder = createBuilder()
      const gas = await builder.getGasPrices()
      expect(gas.maxPriorityFeePerGas).toBeGreaterThan(0n)
    })
  })

  describe('buildDelegation()', () => {
    it('should build a delegation transaction', async () => {
      const builder = createBuilder()
      const signer = createMockSigner()
      const built = await builder.buildDelegation(
        { account: ACCOUNT, delegateAddress: DELEGATE },
        signer
      )

      expect(built.account).toBe(ACCOUNT)
      expect(built.delegateAddress).toBe(DELEGATE)
      expect(built.isRevocation).toBe(false)
      expect(built.authorizationList).toHaveLength(1)
      expect(built.gasEstimate.gasLimit).toBeGreaterThan(0n)
    })

    it('should reject ZERO_ADDRESS (use buildRevocation instead)', async () => {
      const builder = createBuilder()
      const signer = createMockSigner()
      await expect(
        builder.buildDelegation({ account: ACCOUNT, delegateAddress: ZERO_ADDR }, signer)
      ).rejects.toThrow(/Use buildRevocation/)
    })

    it('should sign the authorization', async () => {
      const builder = createBuilder()
      const signer = createMockSigner()
      await builder.buildDelegation({ account: ACCOUNT, delegateAddress: DELEGATE }, signer)
      expect(signer.signAuthorization).toHaveBeenCalled()
    })

    it('should include gas estimate with estimated cost', async () => {
      const builder = createBuilder()
      const signer = createMockSigner()
      const built = await builder.buildDelegation(
        { account: ACCOUNT, delegateAddress: DELEGATE },
        signer
      )
      expect(built.gasEstimate.estimatedCost).toBe(
        built.gasEstimate.gasLimit * built.gasEstimate.maxFeePerGas
      )
    })
  })

  describe('buildRevocation()', () => {
    it('should build a revocation transaction', async () => {
      const builder = createBuilder()
      const signer = createMockSigner()
      const built = await builder.buildRevocation({ account: ACCOUNT }, signer)

      expect(built.isRevocation).toBe(true)
      expect(built.account).toBe(ACCOUNT)
      expect(built.authorizationList).toHaveLength(1)
    })
  })

  describe('send()', () => {
    it('should send a signed EIP-7702 transaction', async () => {
      const txHash = '0x' + 'cc'.repeat(32)
      mockSendRawTransaction.mockResolvedValue(txHash as Hash)

      const builder = createBuilder()
      const signer = createMockSigner()
      const built = await builder.buildDelegation(
        { account: ACCOUNT, delegateAddress: DELEGATE },
        signer
      )
      const result = await builder.send(built, signer)

      expect(result.hash).toBe(txHash)
      expect(result.mode).toBe('eip7702')
      expect(result.chainId).toBe(1)
      expect(result.timestamp).toBeGreaterThan(0)
      expect(mockSendRawTransaction).toHaveBeenCalledOnce()
    })
  })

  describe('isDelegated()', () => {
    it('should return false for empty code', async () => {
      mockGetCode.mockResolvedValue('0x')
      const builder = createBuilder()
      expect(await builder.isDelegated(ACCOUNT)).toBe(false)
    })

    it('should return false for null code', async () => {
      mockGetCode.mockResolvedValue(null)
      const builder = createBuilder()
      expect(await builder.isDelegated(ACCOUNT)).toBe(false)
    })

    it('should return true for delegation prefix 0xef0100', async () => {
      mockGetCode.mockResolvedValue('0xef0100' + 'aa'.repeat(20))
      const builder = createBuilder()
      expect(await builder.isDelegated(ACCOUNT)).toBe(true)
    })

    it('should return false for regular contract code', async () => {
      mockGetCode.mockResolvedValue('0x608060' + 'bb'.repeat(100))
      const builder = createBuilder()
      expect(await builder.isDelegated(ACCOUNT)).toBe(false)
    })
  })

  describe('getDelegateAddress()', () => {
    it('should return null for empty code', async () => {
      mockGetCode.mockResolvedValue('0x')
      const builder = createBuilder()
      expect(await builder.getDelegateAddress(ACCOUNT)).toBeNull()
    })

    it('should return null for non-delegated code', async () => {
      mockGetCode.mockResolvedValue('0x608060')
      const builder = createBuilder()
      expect(await builder.getDelegateAddress(ACCOUNT)).toBeNull()
    })

    it('should extract address from delegated code', async () => {
      const delegateHex = 'aabbccddee0011223344556677889900aabbccdd'
      mockGetCode.mockResolvedValue('0xef0100' + delegateHex)
      const builder = createBuilder()
      const addr = await builder.getDelegateAddress(ACCOUNT)
      expect(addr?.toLowerCase()).toBe(('0x' + delegateHex).toLowerCase())
    })
  })

  describe('waitForReceipt()', () => {
    it('should delegate to provider.waitForTransactionReceipt', async () => {
      const builder = createBuilder()
      const hash = ('0x' + 'ff'.repeat(32)) as Hash
      await builder.waitForReceipt(hash)
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(hash, {
        confirmations: 1,
        timeout: 60_000,
      })
    })

    it('should pass custom confirmations and timeout', async () => {
      const builder = createBuilder()
      const hash = ('0x' + 'ff'.repeat(32)) as Hash
      await builder.waitForReceipt(hash, { confirmations: 3, timeout: 120_000 })
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(hash, {
        confirmations: 3,
        timeout: 120_000,
      })
    })
  })
})
