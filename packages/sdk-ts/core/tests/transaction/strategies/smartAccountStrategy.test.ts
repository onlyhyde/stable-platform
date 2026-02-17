/**
 * Smart Account Strategy Tests
 *
 * Tests for ERC-4337 Smart Account transaction strategy:
 * supports(), validate(), prepare(), execute(), waitForConfirmation(),
 * encodeSmartAccountCall(), calculateUserOpHash(), getNonce().
 */

import type { Account, MultiModeTransactionRequest, UserOperation } from '@stablenet/sdk-types'
import { ACCOUNT_TYPE, GAS_PAYMENT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockReadContract = vi.fn()
const mockEstimateUserOperationGas = vi.fn()
const mockSendUserOperation = vi.fn()
const mockWaitForUserOperationReceipt = vi.fn()
const mockGetPaymasterData = vi.fn()

vi.mock('../../../src/providers', () => ({
  createViemProvider: () => ({
    readContract: mockReadContract,
  }),
}))

vi.mock('../../../src/clients/bundlerClient', () => ({
  createBundlerClient: () => ({
    estimateUserOperationGas: mockEstimateUserOperationGas,
    sendUserOperation: mockSendUserOperation,
    waitForUserOperationReceipt: mockWaitForUserOperationReceipt,
  }),
}))

vi.mock('../../../src/paymasterClient', () => ({
  createPaymasterClient: () => ({
    getPaymasterData: mockGetPaymasterData,
  }),
}))

import { createSmartAccountStrategy } from '../../../src/transaction/strategies/smartAccountStrategy'

// ============================================================================
// Test Data
// ============================================================================

const SENDER = '0x1234567890abcdef1234567890abcdef12345678' as Address
const TO = '0xaabbccddee0011223344556677889900aabbccdd' as Address
const _ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const PAYMASTER_ADDR = '0x9876543210fedcba9876543210fedcba98765432' as Address

function createStrategy(opts: { paymasterUrl?: string } = {}) {
  return createSmartAccountStrategy({
    rpcUrl: 'https://rpc.example.com',
    chainId: 1,
    bundlerUrl: 'https://bundler.example.com',
    paymasterUrl: opts.paymasterUrl,
  })
}

function createAccount(overrides: Partial<Account> = {}): Account {
  return {
    type: ACCOUNT_TYPE.SMART,
    address: SENDER,
    ...overrides,
  } as Account
}

function createRequest(
  overrides: Partial<MultiModeTransactionRequest> = {}
): MultiModeTransactionRequest {
  return {
    from: SENDER,
    to: TO,
    value: 0n,
    data: '0x' as Hex,
    mode: TRANSACTION_MODE.SMART_ACCOUNT,
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

describe('createSmartAccountStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock: getNonce returns 5n
    mockReadContract.mockResolvedValue(5n)

    // Default mock: gas estimation
    mockEstimateUserOperationGas.mockResolvedValue({
      callGasLimit: 100_000n,
      verificationGasLimit: 200_000n,
      preVerificationGas: 50_000n,
    })

    // Default mock: sendUserOperation returns hash
    mockSendUserOperation.mockResolvedValue('0x' + 'ff'.repeat(32))

    // Default mock: waitForReceipt
    mockWaitForUserOperationReceipt.mockResolvedValue({ success: true })
  })

  describe('mode', () => {
    it('should have smartAccount mode', () => {
      const strategy = createStrategy()
      expect(strategy.mode).toBe('smartAccount')
    })
  })

  describe('supports()', () => {
    it('should support SMART account type', () => {
      const strategy = createStrategy()
      expect(strategy.supports(createAccount({ type: ACCOUNT_TYPE.SMART }))).toBe(true)
    })

    it('should support deployed DELEGATED accounts', () => {
      const strategy = createStrategy()
      expect(
        strategy.supports(
          createAccount({ type: ACCOUNT_TYPE.DELEGATED, isDeployed: true } as unknown)
        )
      ).toBe(true)
    })

    it('should NOT support undeployed DELEGATED accounts', () => {
      const strategy = createStrategy()
      expect(
        strategy.supports(
          createAccount({ type: ACCOUNT_TYPE.DELEGATED, isDeployed: false } as unknown)
        )
      ).toBe(false)
    })

    it('should NOT support EOA accounts', () => {
      const strategy = createStrategy()
      expect(strategy.supports(createAccount({ type: ACCOUNT_TYPE.EOA }))).toBe(false)
    })
  })

  describe('validate()', () => {
    it('should pass with valid request', () => {
      const strategy = createStrategy()
      expect(() => strategy.validate(createRequest(), createAccount())).not.toThrow()
    })

    it('should throw when from is missing', () => {
      const strategy = createStrategy()
      expect(() =>
        strategy.validate(createRequest({ from: undefined as unknown }), createAccount())
      ).toThrow(/Missing "from" address/)
    })

    it('should throw when to is missing', () => {
      const strategy = createStrategy()
      expect(() =>
        strategy.validate(createRequest({ to: undefined as unknown }), createAccount())
      ).toThrow(/Missing "to" address/)
    })

    it('should throw when SPONSOR gas payment without paymaster URL', () => {
      const strategy = createStrategy() // no paymasterUrl
      expect(() =>
        strategy.validate(
          createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.SPONSOR } as unknown }),
          createAccount()
        )
      ).toThrow(/Paymaster URL is required/)
    })

    it('should throw when ERC20 gas payment without paymaster URL', () => {
      const strategy = createStrategy()
      expect(() =>
        strategy.validate(
          createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.ERC20 } as unknown }),
          createAccount()
        )
      ).toThrow(/Paymaster URL is required/)
    })

    it('should not throw for SPONSOR gas payment with paymaster URL', () => {
      const strategy = createStrategy({ paymasterUrl: 'https://paymaster.example.com' })
      expect(() =>
        strategy.validate(
          createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.SPONSOR } as unknown }),
          createAccount()
        )
      ).not.toThrow()
    })

    it('should not throw for NATIVE gas payment without paymaster', () => {
      const strategy = createStrategy()
      expect(() =>
        strategy.validate(
          createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.NATIVE } as unknown }),
          createAccount()
        )
      ).not.toThrow()
    })
  })

  describe('prepare()', () => {
    it('should fetch nonce from EntryPoint', async () => {
      const strategy = createStrategy()
      await strategy.prepare(createRequest(), createAccount())
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'getNonce',
          args: [SENDER, 0n],
        })
      )
    })

    it('should estimate gas via bundler', async () => {
      const strategy = createStrategy()
      await strategy.prepare(createRequest(), createAccount())
      expect(mockEstimateUserOperationGas).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: SENDER,
          nonce: 5n,
        })
      )
    })

    it('should return prepared transaction with correct mode', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      expect(prepared.mode).toBe('smartAccount')
    })

    it('should include gas estimate', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      expect(prepared.gasEstimate).toBeDefined()
      expect(prepared.gasEstimate.gasLimit).toBeGreaterThan(0n)
    })

    it('should include callData in strategy data', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(
        createRequest({ data: '0xdeadbeef' as Hex }),
        createAccount()
      )
      expect(prepared.strategyData).toBeDefined()
      const data = prepared.strategyData as unknown
      expect(data.userOp.callData).toBeTruthy()
      // Kernel execute callData should contain the original data
      expect(data.userOp.callData.length).toBeGreaterThan(4)
    })

    it('should fetch paymaster data when gasPayment provided', async () => {
      mockGetPaymasterData.mockResolvedValue({
        paymaster: PAYMASTER_ADDR,
        paymasterData: '0xaa' as Hex,
        paymasterVerificationGasLimit: 50_000n,
        paymasterPostOpGasLimit: 30_000n,
      })

      const strategy = createStrategy({ paymasterUrl: 'https://paymaster.example.com' })
      const prepared = await strategy.prepare(
        createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.SPONSOR } as unknown }),
        createAccount()
      )
      expect(mockGetPaymasterData).toHaveBeenCalled()
      const data = prepared.strategyData as unknown
      expect(data.paymasterData).toBeDefined()
      expect(data.paymasterData.paymaster).toBe(PAYMASTER_ADDR)
    })
  })

  describe('execute()', () => {
    it('should sign and send UserOperation', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      const result = await strategy.execute(prepared, signer)

      expect(signer.signAuthorization).toHaveBeenCalled()
      expect(mockSendUserOperation).toHaveBeenCalled()
      expect(result.hash).toBeTruthy()
      expect(result.mode).toBe('smartAccount')
      expect(result.chainId).toBe(1)
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it('should include paymaster fields in UserOp when available', async () => {
      mockGetPaymasterData.mockResolvedValue({
        paymaster: PAYMASTER_ADDR,
        paymasterData: '0xaa' as Hex,
        paymasterVerificationGasLimit: 50_000n,
        paymasterPostOpGasLimit: 30_000n,
      })

      const strategy = createStrategy({ paymasterUrl: 'https://paymaster.example.com' })
      const prepared = await strategy.prepare(
        createRequest({ gasPayment: { type: GAS_PAYMENT_TYPE.SPONSOR } as unknown }),
        createAccount()
      )
      const signer = createMockSigner()

      await strategy.execute(prepared, signer)

      const sentUserOp = mockSendUserOperation.mock.calls[0][0] as UserOperation
      expect(sentUserOp.paymaster).toBe(PAYMASTER_ADDR)
      expect(sentUserOp.paymasterData).toBe('0xaa')
    })

    it('should wait for confirmation when option is set', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer, { waitForConfirmation: true })

      expect(mockWaitForUserOperationReceipt).toHaveBeenCalled()
    })

    it('should not wait for confirmation by default', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer)

      expect(mockWaitForUserOperationReceipt).not.toHaveBeenCalled()
    })

    it('should pass timeout to waitForConfirmation', async () => {
      const strategy = createStrategy()
      const prepared = await strategy.prepare(createRequest(), createAccount())
      const signer = createMockSigner()

      await strategy.execute(prepared, signer, {
        waitForConfirmation: true,
        timeout: 60_000,
      })

      expect(mockWaitForUserOperationReceipt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ timeout: 60_000 })
      )
    })
  })

  describe('waitForConfirmation()', () => {
    it('should poll bundler for receipt', async () => {
      const strategy = createStrategy()
      const hash = '0x' + 'ff'.repeat(32)

      await strategy.waitForConfirmation!(hash as unknown)

      expect(mockWaitForUserOperationReceipt).toHaveBeenCalledWith(
        hash,
        expect.objectContaining({ pollingInterval: 2000 })
      )
    })

    it('should respect custom timeout', async () => {
      const strategy = createStrategy()
      const hash = '0x' + 'ff'.repeat(32)

      await strategy.waitForConfirmation!(hash as unknown, { timeout: 120_000 })

      expect(mockWaitForUserOperationReceipt).toHaveBeenCalledWith(
        hash,
        expect.objectContaining({ timeout: 120_000 })
      )
    })
  })
})
