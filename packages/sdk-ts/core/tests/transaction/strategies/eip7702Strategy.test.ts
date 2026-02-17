/**
 * EIP-7702 Strategy Tests
 *
 * Tests for EIP-7702 strategy: supports(), validate(), prepare(),
 * execute(), and waitForConfirmation().
 */

import type { Account, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { ACCOUNT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockBuildDelegation = vi.fn()
const mockBuildRevocation = vi.fn()
const mockSend = vi.fn()
const mockGetGasPrices = vi.fn()
const mockWaitForReceipt = vi.fn()

vi.mock('../../../src/transaction/eip7702Transaction', () => ({
  createEIP7702TransactionBuilder: () => ({
    buildDelegation: mockBuildDelegation,
    buildRevocation: mockBuildRevocation,
    send: mockSend,
    getGasPrices: mockGetGasPrices,
    waitForReceipt: mockWaitForReceipt,
  }),
}))

import { createEIP7702Strategy } from '../../../src/transaction/strategies/eip7702Strategy'

// ============================================================================
// Test Data
// ============================================================================

const SENDER = '0x1234567890abcdef1234567890abcdef12345678' as Address
const DELEGATE = '0xaabbccddee0011223344556677889900aabbccdd' as Address
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address

function createStrategy() {
  return createEIP7702Strategy({
    rpcUrl: 'https://rpc.example.com',
    chainId: 1,
  })
}

function createAccount(type: string = ACCOUNT_TYPE.EOA): Account {
  return { type, address: SENDER } as Account
}

function createRequest(
  overrides: Partial<MultiModeTransactionRequest> = {}
): MultiModeTransactionRequest {
  return {
    from: SENDER,
    to: DELEGATE,
    value: 0n,
    mode: TRANSACTION_MODE.EIP7702,
    ...overrides,
  } as MultiModeTransactionRequest
}

function createMockSigner() {
  return {
    signTransaction: vi.fn(),
    signAuthorization: vi.fn().mockResolvedValue({
      v: 27,
      r: '0x' + 'aa'.repeat(32),
      s: '0x' + 'bb'.repeat(32),
    }),
    getAddress: vi.fn().mockResolvedValue(SENDER),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('createEIP7702Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGasPrices.mockResolvedValue({
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_500_000_000n,
    })
    mockBuildDelegation.mockResolvedValue({
      serializedTransaction: '0x' as Hex,
      authorizationList: [],
      gasEstimate: {
        gasLimit: 58_500n,
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_500_000_000n,
      },
      account: SENDER,
      delegateAddress: DELEGATE,
      isRevocation: false,
    })
    mockBuildRevocation.mockResolvedValue({
      serializedTransaction: '0x' as Hex,
      authorizationList: [],
      gasEstimate: {
        gasLimit: 58_500n,
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_500_000_000n,
      },
      account: SENDER,
      delegateAddress: ZERO_ADDR,
      isRevocation: true,
    })
    mockSend.mockResolvedValue({
      hash: '0x' + 'ff'.repeat(32),
      mode: 'eip7702',
      chainId: 1,
      timestamp: Date.now(),
    })
    mockWaitForReceipt.mockResolvedValue({ status: '0x1' })
  })

  describe('mode', () => {
    it('should have eip7702 mode', () => {
      expect(createStrategy().mode).toBe('eip7702')
    })
  })

  describe('supports()', () => {
    it('should support EOA accounts', () => {
      expect(createStrategy().supports(createAccount(ACCOUNT_TYPE.EOA))).toBe(true)
    })

    it('should support DELEGATED accounts', () => {
      expect(createStrategy().supports(createAccount(ACCOUNT_TYPE.DELEGATED))).toBe(true)
    })

    it('should NOT support SMART accounts', () => {
      expect(createStrategy().supports(createAccount(ACCOUNT_TYPE.SMART))).toBe(false)
    })
  })

  describe('validate()', () => {
    it('should pass with valid request', () => {
      expect(() => createStrategy().validate(createRequest(), createAccount())).not.toThrow()
    })

    it('should throw when from is missing', () => {
      expect(() =>
        createStrategy().validate(createRequest({ from: undefined as unknown }), createAccount())
      ).toThrow(/Missing "from" address/)
    })

    it('should throw when to is missing', () => {
      expect(() =>
        createStrategy().validate(createRequest({ to: undefined as unknown }), createAccount())
      ).toThrow(/Missing "to"/)
    })
  })

  describe('prepare()', () => {
    it('should return prepared transaction with eip7702 mode', async () => {
      const prepared = await createStrategy().prepare(createRequest(), createAccount())
      expect(prepared.mode).toBe('eip7702')
    })

    it('should include gas estimate', async () => {
      const prepared = await createStrategy().prepare(createRequest(), createAccount())
      expect(prepared.gasEstimate.gasLimit).toBe(58_500n)
      expect(prepared.gasEstimate.maxFeePerGas).toBeGreaterThan(0n)
      expect(prepared.gasEstimate.estimatedCost).toBeGreaterThan(0n)
    })

    it('should detect revocation when to is zero address', async () => {
      const prepared = await createStrategy().prepare(
        createRequest({ to: ZERO_ADDR }),
        createAccount()
      )
      const data = prepared.strategyData as unknown
      expect(data.isRevocation).toBe(true)
    })

    it('should not mark as revocation for normal delegate', async () => {
      const prepared = await createStrategy().prepare(createRequest(), createAccount())
      const data = prepared.strategyData as unknown
      expect(data.isRevocation).toBe(false)
    })
  })

  describe('execute()', () => {
    it('should call buildDelegation for normal delegate', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer)

      expect(mockBuildDelegation).toHaveBeenCalled()
      expect(mockBuildRevocation).not.toHaveBeenCalled()
    })

    it('should call buildRevocation for zero address', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest({ to: ZERO_ADDR }), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer)

      expect(mockBuildRevocation).toHaveBeenCalled()
    })

    it('should send the transaction via builder', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer)

      expect(mockSend).toHaveBeenCalled()
    })

    it('should return TransactionResult', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      const result = await strategy.execute(prepared, signer)

      expect(result.hash).toBeTruthy()
      expect(result.mode).toBe('eip7702')
    })
  })

  describe('waitForConfirmation()', () => {
    it('should delegate to builder.waitForReceipt', async () => {
      const strategy = createStrategy()
      const hash = ('0x' + 'ff'.repeat(32)) as unknown

      await strategy.waitForConfirmation!(hash)

      expect(mockWaitForReceipt).toHaveBeenCalledWith(hash, undefined)
    })

    it('should pass options to waitForReceipt', async () => {
      const strategy = createStrategy()
      const hash = ('0x' + 'ff'.repeat(32)) as unknown
      const options = { confirmations: 3, timeout: 120_000 }

      await strategy.waitForConfirmation!(hash, options)

      expect(mockWaitForReceipt).toHaveBeenCalledWith(hash, options)
    })
  })
})
