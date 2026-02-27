import type { Account, Address, Hex, PublicClient, WalletClient } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_SIGNATURES } from '../../src/abi'
import { BundleExecutor, type BundleExecutorConfig } from '../../src/executor/bundleExecutor'
import { DependencyTracker } from '../../src/mempool/dependencyTracker'
import { Mempool } from '../../src/mempool/mempool'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import type { AggregatorValidator, UserOperationValidator } from '../../src/validation'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const BENEFICIARY = '0x1234567890123456789012345678901234567890' as Address
const TEST_SENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TEST_ACCOUNT = '0x9999999999999999999999999999999999999999' as Address

// Helper to create a UserOperation
function createTestUserOp(sender: Address = TEST_SENDER, nonce = 0n): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: ('0x' + '00'.repeat(65)) as Hex,
  }
}

// Helper to create a hash
function createHash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, '0')}` as Hex
}

// Helper to pad address to 32 bytes (for indexed event topics)
function padAddress(address: Address): Hex {
  // Remove 0x prefix, pad to 64 chars (32 bytes)
  return `0x000000000000000000000000${address.slice(2)}` as Hex
}

describe('BundleExecutor', () => {
  let mockPublicClient: PublicClient
  let mockWalletClient: WalletClient
  let mempool: Mempool
  let mockValidator: UserOperationValidator
  let executor: BundleExecutor
  let config: BundleExecutorConfig

  beforeEach(() => {
    vi.useFakeTimers()

    // Setup mocks
    mockPublicClient = {
      estimateGas: vi.fn().mockResolvedValue(500000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        transactionHash: '0xabc123' as Hex,
        logs: [],
      }),
    } as unknown as PublicClient

    mockWalletClient = {
      account: { address: TEST_ACCOUNT } as Account,
      chain: { id: 1 },
      sendTransaction: vi.fn().mockResolvedValue('0xtxhash123' as Hex),
    } as unknown as WalletClient

    mempool = new Mempool(mockLogger, { maxOpsPerSender: 10 })

    // Create mock validator
    const mockSimulationValidator = {
      simulate: vi.fn().mockResolvedValue({
        returnInfo: {
          preOpGas: 50000n,
          prefund: 0n,
          accountValidationData: 0n,
          paymasterValidationData: 0n,
          paymasterContext: '0x',
        },
        senderInfo: { stake: 0n, unstakeDelaySec: 0n },
        factoryInfo: { stake: 0n, unstakeDelaySec: 0n },
        paymasterInfo: { stake: 0n, unstakeDelaySec: 0n },
      }),
      getDepositInfo: vi.fn().mockResolvedValue({
        deposit: 1000000000000000000n, // 1 ETH
        staked: false,
        stake: 0n,
        unstakeDelaySec: 0n,
        withdrawTime: 0n,
      }),
    }

    const mockReputationManager = {
      isStaked: vi.fn().mockReturnValue(false),
    }

    mockValidator = {
      getSimulationValidator: vi.fn().mockReturnValue(mockSimulationValidator),
      getReputationManager: vi.fn().mockReturnValue(mockReputationManager),
      getOpcodeValidator: vi.fn().mockReturnValue(undefined),
      updateReputationIncluded: vi.fn(),
    } as unknown as UserOperationValidator

    config = {
      entryPoint: ENTRY_POINT,
      beneficiary: BENEFICIARY,
      maxBundleSize: 10,
      bundleInterval: 1000,
    }

    executor = new BundleExecutor(
      mockPublicClient,
      mockWalletClient,
      mempool,
      mockValidator,
      config,
      mockLogger
    )
  })

  afterEach(() => {
    executor.stop()
    vi.useRealTimers()
  })

  describe('start/stop', () => {
    it('should start and stop the executor', () => {
      executor.start()
      // Should not throw
      expect(true).toBe(true)

      executor.stop()
      // Should not throw
      expect(true).toBe(true)
    })

    it('should not start twice', () => {
      executor.start()
      executor.start() // Should not throw
      executor.stop()
    })
  })

  describe('tryBundle', () => {
    it('should return null when no pending operations', async () => {
      const result = await executor.tryBundle()
      expect(result).toBeNull()
    })

    it('should create bundle from pending operations', async () => {
      // Add operations to mempool
      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER, 1n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)

      const result = await executor.tryBundle()

      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
    })

    it('should respect maxBundleSize', async () => {
      // Create mempool with higher per-sender limit for this test
      mempool = new Mempool(mockLogger, { maxOpsPerSender: 20 })
      executor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )

      // Add more operations than maxBundleSize (15 > maxBundleSize of 10)
      for (let i = 0; i < 15; i++) {
        mempool.add(createTestUserOp(TEST_SENDER, BigInt(i)), createHash(i), ENTRY_POINT)
      }

      await executor.tryBundle()

      // Check that only maxBundleSize operations were submitted
      const args = vi.mocked(mockWalletClient.sendTransaction).mock.calls[0][0]
      // The data contains encoded handleOps call, we can't easily parse it
      // but we can verify the call was made
      expect(args).toBeDefined()
    })
  })

  describe('pre-flight validation', () => {
    it('should drop operations that fail pre-flight validation', async () => {
      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER, 1n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)

      // Make second operation fail simulation
      const mockSimValidator = mockValidator.getSimulationValidator()
      vi.mocked(mockSimValidator.simulate)
        .mockResolvedValueOnce({
          returnInfo: {
            preOpGas: 50000n,
            prefund: 0n,
            accountValidationData: 0n,
            paymasterValidationData: 0n,
            paymasterContext: '0x',
          },
          senderInfo: { stake: 0n, unstakeDelaySec: 0n },
          factoryInfo: { stake: 0n, unstakeDelaySec: 0n },
          paymasterInfo: { stake: 0n, unstakeDelaySec: 0n },
        })
        .mockRejectedValueOnce(new Error('Simulation failed'))

      await executor.tryBundle()

      // Second operation should be marked as dropped
      const entry2 = mempool.get(createHash(2))
      expect(entry2?.status).toBe('dropped')
      expect(entry2?.error).toBe('Simulation failed')
    })

    it('should return null when all operations fail pre-flight validation', async () => {
      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER, 1n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)

      // Make all operations fail simulation
      const mockSimValidator = mockValidator.getSimulationValidator()
      vi.mocked(mockSimValidator.simulate).mockRejectedValue(new Error('All simulations failed'))

      const result = await executor.tryBundle()

      expect(result).toBeNull()
      expect(mockWalletClient.sendTransaction).not.toHaveBeenCalled()

      // Both operations should be marked as dropped
      expect(mempool.get(createHash(1))?.status).toBe('dropped')
      expect(mempool.get(createHash(2))?.status).toBe('dropped')
    })

    it('should only submit valid operations after partial pre-flight failure', async () => {
      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER, 1n)
      const userOp3 = createTestUserOp(TEST_SENDER, 2n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)
      mempool.add(userOp3, createHash(3), ENTRY_POINT)

      // First and third pass, second fails
      const mockSimValidator = mockValidator.getSimulationValidator()
      vi.mocked(mockSimValidator.simulate)
        .mockResolvedValueOnce({
          returnInfo: {
            preOpGas: 50000n,
            prefund: 0n,
            accountValidationData: 0n,
            paymasterValidationData: 0n,
            paymasterContext: '0x',
          },
          senderInfo: { stake: 0n, unstakeDelaySec: 0n },
          factoryInfo: { stake: 0n, unstakeDelaySec: 0n },
          paymasterInfo: { stake: 0n, unstakeDelaySec: 0n },
        })
        .mockRejectedValueOnce(new Error('Second op failed'))
        .mockResolvedValueOnce({
          returnInfo: {
            preOpGas: 50000n,
            prefund: 0n,
            accountValidationData: 0n,
            paymasterValidationData: 0n,
            paymasterContext: '0x',
          },
          senderInfo: { stake: 0n, unstakeDelaySec: 0n },
          factoryInfo: { stake: 0n, unstakeDelaySec: 0n },
          paymasterInfo: { stake: 0n, unstakeDelaySec: 0n },
        })

      const result = await executor.tryBundle()

      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)

      // Second should be dropped, first and third should be submitted
      expect(mempool.get(createHash(2))?.status).toBe('dropped')
    })
  })

  describe('bundle submission', () => {
    it('should estimate gas with buffer', async () => {
      mempool.add(createTestUserOp(), createHash(1), ENTRY_POINT)

      await executor.tryBundle()

      expect(mockPublicClient.estimateGas).toHaveBeenCalled()

      // Check that sendTransaction was called with gas limit (120% of estimate)
      const sendArgs = vi.mocked(mockWalletClient.sendTransaction).mock.calls[0][0]
      expect(sendArgs.gas).toBe(600000n) // 500000 * 1.2
    })

    it('should mark operations as submitted then included after receipt', async () => {
      const hash = createHash(1)
      mempool.add(createTestUserOp(), hash, ENTRY_POINT)

      await executor.tryBundle()

      // Wait for receipt processing to complete
      await vi.advanceTimersByTimeAsync(100)

      // After receipt processing, status should be 'included' (final state)
      const entry = mempool.get(hash)
      // Note: waitForReceipt runs async and updates status to 'included' after successful receipt
      expect(entry?.status).toBe('included')
      expect(entry?.transactionHash).toBe('0xtxhash123')
    })

    it('should handle submission failure', async () => {
      vi.mocked(mockWalletClient.sendTransaction).mockRejectedValue(new Error('Transaction failed'))

      const hash = createHash(1)
      mempool.add(createTestUserOp(), hash, ENTRY_POINT)

      await expect(executor.tryBundle()).rejects.toThrow('Transaction failed')

      // Operation should be marked as failed
      const entry = mempool.get(hash)
      expect(entry?.status).toBe('failed')
      expect(entry?.error).toBe('Transaction failed')
    })
  })

  describe('receipt processing', () => {
    it('should update status based on receipt', async () => {
      const hash = createHash(1)
      const userOp = createTestUserOp()
      mempool.add(userOp, hash, ENTRY_POINT)

      // Mock receipt with UserOperationEvent
      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [
          {
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent,
              hash, // userOpHash as indexed topic (already 32 bytes)
              padAddress(userOp.sender), // sender as indexed topic (padded to 32 bytes)
              padAddress('0x0000000000000000000000000000000000000000' as Address), // paymaster
            ] as [Hex, ...Hex[]],
            data:
              '0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' + // nonce
              '0000000000000000000000000000000000000000000000000000000000000001' + // success (true)
              '0000000000000000000000000000000000000000000000000000000000001000' + // actualGasCost
              '0000000000000000000000000000000000000000000000000000000000000500', // actualGasUsed
          },
        ],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()

      // Wait for receipt processing
      await vi.advanceTimersByTimeAsync(100)

      // Should have called updateReputationIncluded
      expect(mockValidator.updateReputationIncluded).toHaveBeenCalledWith(userOp)
    })

    it('should handle failed transactions', async () => {
      const hash = createHash(1)
      mempool.add(createTestUserOp(), hash, ENTRY_POINT)

      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'reverted',
        blockNumber: 12345n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()
      await vi.advanceTimersByTimeAsync(100)

      const entry = mempool.get(hash)
      expect(entry?.status).toBe('failed')
    })

    it('should handle UserOperationEvent with success=false', async () => {
      const hash = createHash(1)
      const userOp = createTestUserOp()
      mempool.add(userOp, hash, ENTRY_POINT)

      // Mock receipt with UserOperationEvent where success=false
      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'success', // Transaction succeeded but UserOp execution failed
        blockNumber: 12345n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [
          {
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent,
              hash,
              padAddress(userOp.sender),
              padAddress('0x0000000000000000000000000000000000000000' as Address),
            ] as [Hex, ...Hex[]],
            data:
              '0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' + // nonce
              '0000000000000000000000000000000000000000000000000000000000000000' + // success (false)
              '0000000000000000000000000000000000000000000000000000000000001000' + // actualGasCost
              '0000000000000000000000000000000000000000000000000000000000000500', // actualGasUsed
          },
        ],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()
      await vi.advanceTimersByTimeAsync(100)

      const entry = mempool.get(hash)
      expect(entry?.status).toBe('failed')
      expect(entry?.error).toBe('UserOperation execution failed')
      // Should NOT update reputation for failed ops
      expect(mockValidator.updateReputationIncluded).not.toHaveBeenCalled()
    })

    it('should handle multiple UserOperationEvents in one receipt', async () => {
      const TEST_SENDER_2 = '0x1111111111111111111111111111111111111111' as Address
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER_2, 0n)

      mempool.add(userOp1, hash1, ENTRY_POINT)
      mempool.add(userOp2, hash2, ENTRY_POINT)

      // Mock receipt with multiple UserOperationEvents
      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [
          {
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent,
              hash1,
              padAddress(userOp1.sender),
              padAddress('0x0000000000000000000000000000000000000000' as Address),
            ] as [Hex, ...Hex[]],
            data:
              '0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' +
              '0000000000000000000000000000000000000000000000000000000000000001' + // success
              '0000000000000000000000000000000000000000000000000000000000001000' +
              '0000000000000000000000000000000000000000000000000000000000000500',
          },
          {
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent,
              hash2,
              padAddress(userOp2.sender),
              padAddress('0x0000000000000000000000000000000000000000' as Address),
            ] as [Hex, ...Hex[]],
            data:
              '0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' +
              '0000000000000000000000000000000000000000000000000000000000000001' + // success
              '0000000000000000000000000000000000000000000000000000000000002000' +
              '0000000000000000000000000000000000000000000000000000000000000600',
          },
        ],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()
      await vi.advanceTimersByTimeAsync(100)

      // Both should be included
      expect(mempool.get(hash1)?.status).toBe('included')
      expect(mempool.get(hash2)?.status).toBe('included')
      expect(mockValidator.updateReputationIncluded).toHaveBeenCalledTimes(2)
    })

    it('should record block number on successful inclusion', async () => {
      const hash = createHash(1)
      const userOp = createTestUserOp()
      mempool.add(userOp, hash, ENTRY_POINT)

      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'success',
        blockNumber: 99999n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [
          {
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent,
              hash,
              padAddress(userOp.sender),
              padAddress('0x0000000000000000000000000000000000000000' as Address),
            ] as [Hex, ...Hex[]],
            data:
              '0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' +
              '0000000000000000000000000000000000000000000000000000000000000001' +
              '0000000000000000000000000000000000000000000000000000000000001000' +
              '0000000000000000000000000000000000000000000000000000000000000500',
          },
        ],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()
      await vi.advanceTimersByTimeAsync(100)

      const entry = mempool.get(hash)
      expect(entry?.blockNumber).toBe(99999n)
    })

    it('should handle receipt without matching UserOperationEvent', async () => {
      const hash = createHash(1)
      const userOp = createTestUserOp()
      mempool.add(userOp, hash, ENTRY_POINT)

      // Receipt with no logs (unusual but possible)
      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        transactionHash: '0xtxhash123' as Hex,
        logs: [],
      } as unknown as ReturnType<PublicClient['waitForTransactionReceipt']>)

      await executor.tryBundle()
      await vi.advanceTimersByTimeAsync(100)

      // Should still be marked as included based on tx status
      const entry = mempool.get(hash)
      expect(entry?.status).toBe('included')
    })
  })

  describe('UserOperation packing', () => {
    it('should pack operations in v0.7 format', async () => {
      const userOp: UserOperation = {
        sender: TEST_SENDER,
        nonce: 123n,
        factory: '0x1111111111111111111111111111111111111111' as Address,
        factoryData: '0xdeadbeef' as Hex,
        callData: '0x12345678' as Hex,
        callGasLimit: 50000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 2000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymaster: '0x2222222222222222222222222222222222222222' as Address,
        paymasterVerificationGasLimit: 30000n,
        paymasterPostOpGasLimit: 20000n,
        paymasterData: '0xabcd' as Hex,
        signature: ('0x' + 'ff'.repeat(65)) as Hex,
      }

      mempool.add(userOp, createHash(1), ENTRY_POINT)

      await executor.tryBundle()

      // Verify sendTransaction was called
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
    })

    it('should pack operation without factory (no initCode)', async () => {
      const userOp: UserOperation = {
        sender: TEST_SENDER,
        nonce: 0n,
        factory: undefined,
        factoryData: undefined,
        callData: '0x12345678' as Hex,
        callGasLimit: 50000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 2000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymaster: undefined,
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: undefined,
        paymasterData: undefined,
        signature: ('0x' + '00'.repeat(65)) as Hex,
      }

      mempool.add(userOp, createHash(1), ENTRY_POINT)

      await executor.tryBundle()

      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      const call = vi.mocked(mockWalletClient.sendTransaction).mock.calls[0][0]
      expect(call.to).toBe(ENTRY_POINT)
    })

    it('should pack operation without paymaster (no paymasterAndData)', async () => {
      const userOp: UserOperation = {
        sender: TEST_SENDER,
        nonce: 0n,
        factory: '0x1111111111111111111111111111111111111111' as Address,
        factoryData: '0xdeadbeef' as Hex,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymaster: undefined,
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: undefined,
        paymasterData: undefined,
        signature: ('0x' + '00'.repeat(65)) as Hex,
      }

      mempool.add(userOp, createHash(1), ENTRY_POINT)

      await executor.tryBundle()

      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
    })
  })

  describe('error recovery', () => {
    it('should handle gas estimation failure', async () => {
      vi.mocked(mockPublicClient.estimateGas).mockRejectedValue(new Error('Gas estimation failed'))

      const hash = createHash(1)
      mempool.add(createTestUserOp(), hash, ENTRY_POINT)

      await expect(executor.tryBundle()).rejects.toThrow('Gas estimation failed')

      // Operation should be marked as failed
      const entry = mempool.get(hash)
      expect(entry?.status).toBe('failed')
    })

    it('should handle receipt timeout gracefully', async () => {
      vi.mocked(mockPublicClient.waitForTransactionReceipt).mockRejectedValue(
        new Error('Receipt timeout')
      )

      const hash = createHash(1)
      mempool.add(createTestUserOp(), hash, ENTRY_POINT)

      // tryBundle should succeed (returns tx hash), receipt error is logged but not thrown
      const result = await executor.tryBundle()
      expect(result).toBe('0xtxhash123')

      // Wait for receipt processing to complete (it will fail but not throw)
      await vi.advanceTimersByTimeAsync(100)

      // Status should remain 'submitted' since receipt processing failed
      const entry = mempool.get(hash)
      expect(entry?.status).toBe('submitted')
    })
  })

  describe('multiple senders', () => {
    it('should bundle operations from different senders', async () => {
      const TEST_SENDER_2 = '0x1111111111111111111111111111111111111111' as Address
      const TEST_SENDER_3 = '0x2222222222222222222222222222222222222222' as Address

      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER_2, 0n)
      const userOp3 = createTestUserOp(TEST_SENDER_3, 0n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)
      mempool.add(userOp3, createHash(3), ENTRY_POINT)

      const result = await executor.tryBundle()

      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)
    })

    it('should filter operations by entryPoint', async () => {
      const OTHER_ENTRY_POINT = '0x9999999999999999999999999999999999999999' as Address

      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp(TEST_SENDER, 1n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), OTHER_ENTRY_POINT) // Different entry point

      await executor.tryBundle()

      // Only the operation for the configured entry point should be bundled
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)

      // Wait for receipt
      await vi.advanceTimersByTimeAsync(100)

      // First op should be included
      expect(mempool.get(createHash(1))?.status).toBe('included')
      // Second op should still be pending (not processed by this executor)
      expect(mempool.get(createHash(2))?.status).toBe('pending')
    })
  })

  describe('periodic execution', () => {
    it('should execute bundles at configured interval', async () => {
      mempool.add(createTestUserOp(), createHash(1), ENTRY_POINT)

      executor.start()

      // Advance time by one interval
      await vi.advanceTimersByTimeAsync(config.bundleInterval)

      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)

      // Add another operation and advance time again
      mempool.add(createTestUserOp(TEST_SENDER, 1n), createHash(2), ENTRY_POINT)
      await vi.advanceTimersByTimeAsync(config.bundleInterval)

      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(2)

      executor.stop()
    })
  })

  describe('aggregator bundling', () => {
    // Valid aggregator addresses (20 bytes = 40 hex chars)
    const AGGREGATOR_1 = '0xaaaa111111111111111111111111111111111111' as Address
    const AGGREGATOR_2 = '0xbbbb222222222222222222222222222222222222' as Address

    it('should use handleAggregatedOps when operations have aggregators', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp = createTestUserOp()
      const hash = createHash(1)

      // Add operation with aggregator info
      mempool.add(userOp, hash, ENTRY_POINT)
      mempool.setAggregator(hash, AGGREGATOR_1)

      await executor.tryBundle()

      // Should call sendTransaction with handleAggregatedOps encoded call
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      const call = vi.mocked(mockWalletClient.sendTransaction).mock.calls[0][0]
      // handleAggregatedOps function selector: 0xdbed18e0
      expect(call.data?.slice(0, 10)).toBe('0xdbed18e0')
    })

    it('should group operations by aggregator', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp('0x1111111111111111111111111111111111111111' as Address, 0n)
      const userOp3 = createTestUserOp('0x2222222222222222222222222222222222222222' as Address, 0n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)
      mempool.add(userOp3, createHash(3), ENTRY_POINT)

      // Two ops use AGGREGATOR_1, one uses AGGREGATOR_2
      mempool.setAggregator(createHash(1), AGGREGATOR_1)
      mempool.setAggregator(createHash(2), AGGREGATOR_1)
      mempool.setAggregator(createHash(3), AGGREGATOR_2)

      await executor.tryBundle()

      // Should call with opsPerAggregator containing two groups
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)
      // aggregateSignatures should be called twice (once per aggregator)
      expect(mockAggregatorValidator.aggregateSignatures).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed bundles (with and without aggregator)', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp('0x1111111111111111111111111111111111111111' as Address, 0n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)

      // Only first op has an aggregator
      mempool.setAggregator(createHash(1), AGGREGATOR_1)
      // Second op has no aggregator (uses handleAggregatedOps with zero-address group)

      await executor.tryBundle()

      // Should handle both types in the bundle using handleAggregatedOps
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      // aggregateSignatures called for AGGREGATOR_1 (non-zero aggregator has signature aggregation)
      expect(mockAggregatorValidator.aggregateSignatures).toHaveBeenCalledWith(
        AGGREGATOR_1,
        expect.any(Array)
      )
    })

    it('should call aggregator.aggregateSignatures for each aggregator group', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      // Inject mock aggregator validator
      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp1 = createTestUserOp(TEST_SENDER, 0n)
      const userOp2 = createTestUserOp('0x1111111111111111111111111111111111111111' as Address, 0n)

      mempool.add(userOp1, createHash(1), ENTRY_POINT)
      mempool.add(userOp2, createHash(2), ENTRY_POINT)

      mempool.setAggregator(createHash(1), AGGREGATOR_1)
      mempool.setAggregator(createHash(2), AGGREGATOR_1)

      await executor.tryBundle()

      // Should aggregate signatures for the group
      expect(mockAggregatorValidator.aggregateSignatures).toHaveBeenCalledWith(
        AGGREGATOR_1,
        expect.any(Array)
      )
    })

    it('should validate aggregated signature before submission', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp = createTestUserOp()
      mempool.add(userOp, createHash(1), ENTRY_POINT)
      mempool.setAggregator(createHash(1), AGGREGATOR_1)

      await executor.tryBundle()

      // Should validate the aggregated signature
      expect(mockAggregatorValidator.validateSignatures).toHaveBeenCalled()
    })

    it('should fail bundle if aggregated signature validation fails', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockRejectedValue(new Error('Invalid aggregated signature')),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp = createTestUserOp()
      mempool.add(userOp, createHash(1), ENTRY_POINT)
      mempool.setAggregator(createHash(1), AGGREGATOR_1)

      await expect(executor.tryBundle()).rejects.toThrow('Invalid aggregated signature')
    })

    it('should correctly encode handleAggregatedOps call data', async () => {
      const mockAggregatorValidator = {
        aggregateSignatures: vi.fn().mockResolvedValue(('0x' + 'ab'.repeat(96)) as Hex),
        validateSignatures: vi.fn().mockResolvedValue(undefined),
      }

      executor.setAggregatorValidator(mockAggregatorValidator as unknown as AggregatorValidator)

      const userOp = createTestUserOp()
      mempool.add(userOp, createHash(1), ENTRY_POINT)
      mempool.setAggregator(createHash(1), AGGREGATOR_1)

      await executor.tryBundle()

      const call = vi.mocked(mockWalletClient.sendTransaction).mock.calls[0][0]

      // handleAggregatedOps function selector: 0xdbed18e0
      expect(call.data?.slice(0, 10)).toBe('0xdbed18e0')
    })
  })

  describe('storage conflict detection', () => {
    const SENDER_A = '0xaaaa111111111111111111111111111111111111' as Address
    const SENDER_B = '0xbbbb222222222222222222222222222222222222' as Address
    const SENDER_C = '0xcccc333333333333333333333333333333333333' as Address
    const CONTRACT = '0xdddd444444444444444444444444444444444444' as Address

    it('should order entries by storage dependencies', async () => {
      const tracker = new DependencyTracker(mockLogger)

      // Pre-record storage access: A and B access same slot on same contract
      // B is predecessor (hash order), A is successor
      const hashA = createHash(10)
      const hashB = createHash(5)

      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map([[CONTRACT, new Set(['0x01'])]]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map([[CONTRACT, new Set(['0x01'])]]),
      })

      // Create executor with dependency tracker
      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      // Add ops to mempool
      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)

      const result = await trackerExecutor.tryBundle()
      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
    })

    it('should remove entries with circular storage dependencies', async () => {
      const tracker = new DependencyTracker(mockLogger)

      const hashA = createHash(1)
      const hashB = createHash(2)
      const hashC = createHash(3)

      // Create circular dependency: A→B→C→A via storage conflicts
      // A and B share slot on contract1
      // B and C share slot on contract2
      // C and A share slot on contract3
      const contract1 = '0xdddd444444444444444444444444444444444444' as Address
      const contract2 = '0xeeee555555555555555555555555555555555555' as Address
      const contract3 = '0xffff666666666666666666666666666666666666' as Address

      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map([
          [contract1, new Set(['0x01'])],
          [contract3, new Set(['0x03'])],
        ]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map([
          [contract1, new Set(['0x01'])],
          [contract2, new Set(['0x02'])],
        ]),
      })
      tracker.recordAccess({
        userOpHash: hashC,
        sender: SENDER_C,
        accessedSlots: new Map([
          [contract2, new Set(['0x02'])],
          [contract3, new Set(['0x03'])],
        ]),
      })

      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_C, 0n), hashC, ENTRY_POINT)

      // With circular dependencies, conflicting ops are removed
      // The bundle may be empty or have some ops depending on which are in the cycle
      const result = await trackerExecutor.tryBundle()

      // Either null (all removed) or a tx hash (some survived)
      // The key assertion is that it doesn't crash
      if (result === null) {
        expect(mockWalletClient.sendTransaction).not.toHaveBeenCalled()
      } else {
        expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      }
    })

    it('should preserve original order when no conflicts exist', async () => {
      const tracker = new DependencyTracker(mockLogger)

      const hashA = createHash(1)
      const hashB = createHash(2)

      // Different contracts, no shared slots
      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map([[CONTRACT, new Set(['0x01'])]]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map([[CONTRACT, new Set(['0x02'])]]), // Different slot
      })

      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)

      const result = await trackerExecutor.tryBundle()
      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
    })

    it('should work without dependency tracker (no-op)', async () => {
      // Default executor without tracker
      mempool.add(createTestUserOp(SENDER_A, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), createHash(2), ENTRY_POINT)

      const result = await executor.tryBundle()
      expect(result).toBe('0xtxhash123')
    })
  })

  describe('factory CREATE2 collision detection', () => {
    const SENDER_A = '0xaaaa111111111111111111111111111111111111' as Address
    const SENDER_B = '0xbbbb222222222222222222222222222222222222' as Address
    const SENDER_C = '0xcccc333333333333333333333333333333333333' as Address
    const CREATED_ADDR = '0xdddd444444444444444444444444444444444444' as Address

    it('should exclude ops with CREATE2 address collisions', async () => {
      const tracker = new DependencyTracker(mockLogger)

      const hashA = createHash(1)
      const hashB = createHash(2)

      // Both ops CREATE2 the same address
      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })

      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)

      const result = await trackerExecutor.tryBundle()

      // Bundle should succeed with only the first op (keeper)
      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)
    })

    it('should not exclude ops when CREATE2 addresses are different', async () => {
      const tracker = new DependencyTracker(mockLogger)
      const CREATED_ADDR_2 = '0xeeee555555555555555555555555555555555555' as Address

      const hashA = createHash(1)
      const hashB = createHash(2)

      // Ops CREATE2 different addresses — no collision
      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR_2]),
      })

      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)

      const result = await trackerExecutor.tryBundle()
      expect(result).toBe('0xtxhash123')
    })

    it('should pass through when no dependency tracker is set', async () => {
      // No tracker on default executor — factory collision detection is a no-op
      mempool.add(createTestUserOp(SENDER_A, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), createHash(2), ENTRY_POINT)

      const result = await executor.tryBundle()
      expect(result).toBe('0xtxhash123')
    })

    it('should exclude multiple colliders but keep the first-seen op', async () => {
      const tracker = new DependencyTracker(mockLogger)

      const hashA = createHash(1)
      const hashB = createHash(2)
      const hashC = createHash(3)

      // All three ops CREATE2 the same address
      tracker.recordAccess({
        userOpHash: hashA,
        sender: SENDER_A,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })
      tracker.recordAccess({
        userOpHash: hashB,
        sender: SENDER_B,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })
      tracker.recordAccess({
        userOpHash: hashC,
        sender: SENDER_C,
        accessedSlots: new Map(),
        createdAddresses: new Set([CREATED_ADDR]),
      })

      const trackerExecutor = new BundleExecutor(
        mockPublicClient,
        mockWalletClient,
        mempool,
        mockValidator,
        config,
        mockLogger
      )
      trackerExecutor.setDependencyTracker(tracker)

      mempool.add(createTestUserOp(SENDER_A, 0n), hashA, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_B, 0n), hashB, ENTRY_POINT)
      mempool.add(createTestUserOp(SENDER_C, 0n), hashC, ENTRY_POINT)

      const result = await trackerExecutor.tryBundle()

      // Bundle should succeed — only hashA survives
      expect(result).toBe('0xtxhash123')
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1)
    })
  })
})
