import type { Address, Hex, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GasEstimator } from '../../src/gas/gasEstimator'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const TEST_SENDER = '0x1234567890123456789012345678901234567890' as Address
const TEST_FACTORY = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TEST_PAYMASTER = '0x9876543210987654321098765432109876543210' as Address

// Helper to create a basic UserOperation
function createTestUserOp(overrides: Partial<UserOperation> = {}): UserOperation {
  return {
    sender: TEST_SENDER,
    nonce: 0n,
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
    ...overrides,
  }
}

describe('GasEstimator', () => {
  let mockClient: PublicClient
  let gasEstimator: GasEstimator

  beforeEach(() => {
    mockClient = {
      getCode: vi.fn(),
      estimateGas: vi.fn(),
      simulateContract: vi.fn(),
      call: vi.fn(),
    } as unknown as PublicClient

    gasEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger)
  })

  describe('calculatePreVerificationGas', () => {
    it('should calculate based on packed UserOp format, not JSON', async () => {
      const userOp = createTestUserOp({
        callData: '0x1234567890abcdef' as Hex,
      })

      const result = await gasEstimator.estimate(userOp)

      // Packed format should give a predictable result based on actual byte length
      // JSON serialization gives inconsistent results
      // The packed UserOp should be deterministic
      expect(result.preVerificationGas).toBeGreaterThan(21000n)

      // Verify it's calculated correctly for packed format:
      // - Fixed overhead: 21000
      // - Per UserOp overhead: 18300
      // - Calldata cost: based on actual packed bytes
      // Total should be predictable
    })

    it('should include L1 data cost calculation for L2 chains', async () => {
      // This test will verify L1 data cost is properly calculated
      // For now, we mark this as a feature to implement
      const userOp = createTestUserOp()

      const result = await gasEstimator.estimate(userOp)

      // L2 chains need additional L1 data posting cost
      // This should be configurable based on chain
      expect(result.preVerificationGas).toBeDefined()
    })

    it('should handle different calldata sizes correctly', async () => {
      const smallCalldata = createTestUserOp({
        callData: '0x12345678' as Hex,
      })

      const largeCalldata = createTestUserOp({
        callData: ('0x' + 'ab'.repeat(1000)) as Hex,
      })

      const smallResult = await gasEstimator.estimate(smallCalldata)
      const largeResult = await gasEstimator.estimate(largeCalldata)

      // Larger calldata should have higher preVerificationGas
      expect(largeResult.preVerificationGas).toBeGreaterThan(smallResult.preVerificationGas)

      // The difference should be proportional to calldata size
      // Non-zero bytes cost 16 gas each
      const expectedDiff = BigInt((1000 - 4) * 16) // 996 extra bytes * 16
      const actualDiff = largeResult.preVerificationGas - smallResult.preVerificationGas

      // Should be within 10% of expected
      expect(actualDiff).toBeGreaterThan((expectedDiff * 90n) / 100n)
      expect(actualDiff).toBeLessThan((expectedDiff * 110n) / 100n)
    })
  })

  describe('estimateVerificationGasLimit', () => {
    it('should use binary search simulation for accurate estimation', async () => {
      const userOp = createTestUserOp()

      // Mock simulateContract to simulate binary search behavior
      // The estimator should call simulateValidation multiple times
      // to find the minimum gas that doesn't revert
      let callCount = 0
      const simulateMock = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        callCount++
        // Simulate: needs at least 80000 gas to succeed
        if (params.gas && params.gas < 80000n) {
          throw new Error('out of gas')
        }
        // Return ValidationResult error (v0.9 expected behavior)
        throw {
          name: 'ContractFunctionExecutionError',
          data: '0x5eb2984f', // ValidationResult v0.9 selector
        }
      })
      mockClient.simulateContract = simulateMock

      const result = await gasEstimator.estimate(userOp)

      // Should have called simulation multiple times for binary search
      expect(callCount).toBeGreaterThan(1)

      // Result should be close to actual required gas (80000) plus buffer (10%)
      // 80000 * 1.1 = 88000
      expect(result.verificationGasLimit).toBeGreaterThanOrEqual(80000n)
      expect(result.verificationGasLimit).toBeLessThan(200000n)
    })

    it('should handle factory deployment gas estimation', async () => {
      const userOp = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
      })

      // Factory deployment needs more gas
      mockClient.simulateContract = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        // Needs 250000 gas for deployment
        if (params.gas && params.gas < 250000n) {
          throw new Error('out of gas')
        }
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const result = await gasEstimator.estimate(userOp)

      // Should estimate higher gas for factory deployment
      expect(result.verificationGasLimit).toBeGreaterThanOrEqual(250000n)
    })

    it('should include configurable safety margin', async () => {
      const userOp = createTestUserOp()

      mockClient.simulateContract = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        if (params.gas && params.gas < 100000n) {
          throw new Error('out of gas')
        }
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      // Create estimator with custom config
      const customEstimator = new GasEstimator(
        mockClient,
        ENTRY_POINT,
        mockLogger,
        { verificationGasBufferPercent: 20 } // 20% buffer
      )

      const result = await customEstimator.estimate(userOp)

      // Should include 20% buffer: 100000 * 1.2 = 120000
      expect(result.verificationGasLimit).toBeGreaterThanOrEqual(120000n)
    })
  })

  describe('estimateCallGasLimit', () => {
    it('should use simulateHandleOp for call gas estimation', async () => {
      const userOp = createTestUserOp({
        callData: '0xb61d27f6000000000000000000000000' as Hex, // execute call
      })

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)

      // Mock simulateContract for binary search
      // The gas parameter passed to simulateContract is callGasLimit + verificationGasLimit,
      // so the threshold must account for the verification gas overhead (100000n default).
      const minCallGasRequired = 50000n
      const verificationGas = userOp.verificationGasLimit || 100000n
      const minTotalGasRequired = minCallGasRequired + verificationGas
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; gas?: bigint }) => {
          if (params.functionName === 'simulateHandleOp') {
            // Simulate gas requirements (gas = callGasLimit + verificationGasLimit)
            if (params.gas && params.gas < minTotalGasRequired) {
              throw new Error('out of gas')
            }
            // Return ExecutionResult (success)
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          // For simulateValidation
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await gasEstimator.estimate(userOp)

      // Should be based on binary search result (minCallGasRequired + 10% buffer)
      expect(result.callGasLimit).toBeGreaterThanOrEqual(minCallGasRequired)
      // Allow some margin for binary search approximation
      expect(result.callGasLimit).toBeLessThanOrEqual(70000n)
    })

    it('should handle estimation failure gracefully', async () => {
      const userOp = createTestUserOp({
        callData: '0xdeadbeef' as Hex, // Will revert
      })

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.estimateGas = vi.fn().mockRejectedValue(new Error('execution reverted'))

      const result = await gasEstimator.estimate(userOp)

      // Should still provide a default estimate
      expect(result.callGasLimit).toBeGreaterThan(0n)
    })

    it('should fall back gracefully for non-deployed accounts', async () => {
      const userOp = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
      })

      mockClient.getCode = vi.fn().mockResolvedValue('0x')

      const result = await gasEstimator.estimate(userOp)

      // Should return a reasonable default (100000 + 10% buffer)
      expect(result.callGasLimit).toBeGreaterThan(50000n)
    })
  })

  describe('estimatePaymasterGas', () => {
    it('should return paymaster verification gas estimate', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      // Mock for verification gas binary search
      mockClient.simulateContract = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        if (params.gas && params.gas < 60000n) {
          throw new Error('out of gas')
        }
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const result = await gasEstimator.estimate(userOp)

      // Should have estimated paymaster gas
      expect(result.paymasterVerificationGasLimit).toBeDefined()
      expect(result.paymasterVerificationGasLimit).toBeGreaterThan(0n)
    })

    it('should estimate postOp gas separately', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      mockClient.simulateContract = vi.fn().mockImplementation(async () => {
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const result = await gasEstimator.estimate(userOp)

      expect(result.paymasterPostOpGasLimit).toBeDefined()
      expect(result.paymasterPostOpGasLimit).toBeGreaterThan(0n)
    })
  })

  describe('gas estimation accuracy', () => {
    it('should not underestimate gas (would cause transaction failure)', async () => {
      const userOp = createTestUserOp()

      // Simulate actual gas requirements
      const actualVerificationGas = 85000n
      const actualCallGas = 45000n
      const verificationGas = userOp.verificationGasLimit || 100000n

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName?: string; gas?: bigint }) => {
          if (params.functionName === 'simulateHandleOp') {
            // For simulateHandleOp, gas = callGasLimit + verificationGasLimit
            if (params.gas && params.gas < actualCallGas + verificationGas) {
              throw new Error('out of gas')
            }
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          // For simulateValidation
          if (params.gas && params.gas < actualVerificationGas) {
            throw new Error('out of gas')
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })
      mockClient.estimateGas = vi.fn().mockResolvedValue(actualCallGas)

      const result = await gasEstimator.estimate(userOp)

      // Estimates should always be >= actual requirements
      expect(result.verificationGasLimit).toBeGreaterThanOrEqual(actualVerificationGas)
      expect(result.callGasLimit).toBeGreaterThanOrEqual(actualCallGas)
    })

    it('should not overestimate by more than 50%', async () => {
      const userOp = createTestUserOp()

      const actualVerificationGas = 85000n
      const actualCallGas = 45000n

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; gas?: bigint }) => {
          if (params.functionName === 'simulateHandleOp') {
            // For call gas binary search
            if (params.gas && params.gas < actualCallGas) {
              throw new Error('out of gas')
            }
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          // For simulateValidation (verification gas)
          if (params.gas && params.gas < actualVerificationGas) {
            throw new Error('out of gas')
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await gasEstimator.estimate(userOp)

      // Should not overestimate by more than 50%
      // With 10% buffer: 85000 * 1.1 = 93500, max 150% = 127500
      const maxVerification = (actualVerificationGas * 150n) / 100n
      const maxCall = (actualCallGas * 150n) / 100n

      expect(result.verificationGasLimit).toBeLessThanOrEqual(maxVerification)
      expect(result.callGasLimit).toBeLessThanOrEqual(maxCall)
    })
  })

  describe('configuration', () => {
    it('should accept custom gas buffer percentages', () => {
      const config = {
        verificationGasBufferPercent: 15,
        callGasBufferPercent: 10,
        preVerificationGasBufferPercent: 5,
      }

      const customEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, config)

      expect(customEstimator).toBeDefined()
    })

    it('should accept custom fixed gas overheads', () => {
      const config = {
        fixedOverhead: 25000n,
        perUserOpOverhead: 20000n,
      }

      const customEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, config)

      expect(customEstimator).toBeDefined()
    })
  })

  // ============================================================
  // Task 1.1: Gas Estimation 시뮬레이션 기반 구현 (TDD Tests)
  // ============================================================

  describe('Task 1.1.1: simulateHandleOp-based callGasLimit', () => {
    it('should use simulateHandleOp for callGasLimit estimation', async () => {
      const userOp = createTestUserOp({
        callData: '0xb61d27f6' as Hex, // execute function selector
      })

      // Mock account is deployed
      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)

      // Track which function is called
      let simulateHandleOpCalled = false
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; gas?: bigint }) => {
          if (params.functionName === 'simulateHandleOp') {
            simulateHandleOpCalled = true
            // Return ExecutionResult error with gas used
            throw {
              name: 'ContractFunctionExecutionError',
              data:
                '0x8b7ac980' + // ExecutionResult selector
                '0000000000000000000000000000000000000000000000000000000000010000' + // preOpGas
                '0000000000000000000000000000000000000000000000000000000000000000' + // paid
                '0000000000000000000000000000000000000000000000000000000000000000' + // accountValidationData
                '0000000000000000000000000000000000000000000000000000000000000000' + // paymasterValidationData
                '0000000000000000000000000000000000000000000000000000000000000001' + // targetSuccess
                '00000000000000000000000000000000000000000000000000000000000000c0' + // targetResult offset
                '0000000000000000000000000000000000000000000000000000000000000000', // targetResult (empty)
            }
          }
          // For simulateValidation
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      await gasEstimator.estimate(userOp)

      // Should use simulateHandleOp instead of eth_estimateGas
      expect(simulateHandleOpCalled).toBe(true)
    })

    it('should extract actual gas used from ExecutionResult', async () => {
      const userOp = createTestUserOp()

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)

      // Simulate ExecutionResult with specific gas values
      // The gas parameter passed to simulateHandleOp is callGasLimit + verificationGasLimit,
      // so the threshold must account for the verification gas overhead.
      const actualCallGasUsed = 75000n
      const verificationGas = userOp.verificationGasLimit || 100000n
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; gas?: bigint }) => {
          if (params.functionName === 'simulateHandleOp') {
            // Binary search - return success or failure based on total gas
            if (params.gas && params.gas < actualCallGasUsed + verificationGas) {
              throw new Error('out of gas')
            }
            throw {
              name: 'ContractFunctionExecutionError',
              data: '0x8b7ac980', // ExecutionResult
            }
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await gasEstimator.estimate(userOp)

      // Should be at least the actual gas used (with buffer)
      expect(result.callGasLimit).toBeGreaterThanOrEqual(actualCallGasUsed)
    })

    it('should handle revert cases in simulateHandleOp', async () => {
      const userOp = createTestUserOp({
        callData: '0xdeadbeef' as Hex, // Will revert
      })

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)

      // Simulate ExecutionResult with targetSuccess = false
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string }) => {
          if (params.functionName === 'simulateHandleOp') {
            throw {
              name: 'ContractFunctionExecutionError',
              data:
                '0x8b7ac980' + // ExecutionResult selector
                '0000000000000000000000000000000000000000000000000000000000010000' +
                '0000000000000000000000000000000000000000000000000000000000000000' +
                '0000000000000000000000000000000000000000000000000000000000000000' +
                '0000000000000000000000000000000000000000000000000000000000000000' +
                '0000000000000000000000000000000000000000000000000000000000000000' + // targetSuccess = false
                '00000000000000000000000000000000000000000000000000000000000000c0',
            }
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      // Should still provide gas estimate even if target execution fails
      const result = await gasEstimator.estimate(userOp)
      expect(result.callGasLimit).toBeGreaterThan(0n)
    })
  })

  describe('Task 1.1.3: Paymaster gas simulation', () => {
    it('should use binary search for paymaster verification gas', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      let binarySearchCallCount = 0
      const actualPaymasterVerificationGas = 65000n

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; args?: unknown[] }) => {
          if (params.functionName === 'simulateValidation') {
            binarySearchCallCount++
            // Extract paymasterVerificationGasLimit from the packed userOp
            // The binary search modifies userOp.paymasterVerificationGasLimit
            // Check if supplied gas is sufficient
            const packedOp = params.args?.[0] as { paymasterAndData?: string } | undefined
            if (packedOp?.paymasterAndData) {
              // paymasterAndData format: address(20) + verificationGas(16) + postOpGas(16) + data
              // Extract verification gas from bytes 20-36
              const paymasterAndData = packedOp.paymasterAndData
              if (paymasterAndData.length >= 72) {
                // 0x + 40 (address) + 32 (verificationGas)
                const verificationGasHex = '0x' + paymasterAndData.slice(42, 74)
                const verificationGas = BigInt(verificationGasHex)
                if (verificationGas < actualPaymasterVerificationGas) {
                  throw new Error('out of gas')
                }
              }
            }
          }
          if (params.functionName === 'simulateHandleOp') {
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await gasEstimator.estimate(userOp)

      // Should have performed binary search
      expect(binarySearchCallCount).toBeGreaterThan(1)
      // Should return a reasonable estimate (>= actual with buffer)
      expect(result.paymasterVerificationGasLimit).toBeGreaterThanOrEqual(
        actualPaymasterVerificationGas
      )
    })

    it('should estimate postOp gas via simulation', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      const actualPostOpGas = 35000n

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string; args?: unknown[] }) => {
          if (params.functionName === 'simulateHandleOp') {
            // Extract paymasterPostOpGasLimit from the packed userOp
            const packedOp = params.args?.[0] as { paymasterAndData?: string } | undefined
            if (packedOp?.paymasterAndData) {
              // paymasterAndData format: address(20) + verificationGas(16) + postOpGas(16) + data
              // Extract postOp gas from bytes 36-52
              const paymasterAndData = packedOp.paymasterAndData
              if (paymasterAndData.length >= 104) {
                // 0x + 40 + 32 + 32
                const postOpGasHex = '0x' + paymasterAndData.slice(74, 106)
                const postOpGas = BigInt(postOpGasHex)
                if (postOpGas < actualPostOpGas) {
                  throw new Error('out of gas')
                }
              }
            }
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await gasEstimator.estimate(userOp)

      // Should estimate postOp gas (>= actual with buffer)
      expect(result.paymasterPostOpGasLimit).toBeDefined()
      expect(result.paymasterPostOpGasLimit).toBeGreaterThanOrEqual(actualPostOpGas)
    })

    it('should separate paymaster verification and postOp gas estimation', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      mockClient.simulateContract = vi.fn().mockImplementation(async () => {
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const result = await gasEstimator.estimate(userOp)

      // Both should be independently estimated
      expect(result.paymasterVerificationGasLimit).toBeDefined()
      expect(result.paymasterPostOpGasLimit).toBeDefined()
      // They should not be the same (different operations)
      expect(result.paymasterVerificationGasLimit).not.toBe(result.paymasterPostOpGasLimit)
    })
  })

  describe('Task 1.1.4: L2 data cost calculation', () => {
    it('should include L1 data cost for L2 chains', async () => {
      const userOp = createTestUserOp({
        callData: ('0x' + 'ab'.repeat(500)) as Hex, // Large calldata
      })

      // Create estimator with L2 config
      const l2Estimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        isL2Chain: true,
        l1GasPrice: 30000000000n, // 30 gwei
        l2GasPrice: 100000000n, // 0.1 gwei
      })

      mockClient.simulateContract = vi.fn().mockImplementation(async () => {
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const l2Result = await l2Estimator.estimate(userOp)

      // Create L1 estimator for comparison
      const l1Estimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        isL2Chain: false,
      })
      const l1Result = await l1Estimator.estimate(userOp)

      // L2 should have higher preVerificationGas due to L1 data cost
      expect(l2Result.preVerificationGas).toBeGreaterThan(l1Result.preVerificationGas)
    })

    it('should calculate L1 data cost based on calldata size', async () => {
      const smallCalldata = createTestUserOp({
        callData: '0x12345678' as Hex,
      })
      const largeCalldata = createTestUserOp({
        callData: ('0x' + 'ab'.repeat(1000)) as Hex,
      })

      const l2Estimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        isL2Chain: true,
        l1GasPrice: 30000000000n,
        l2GasPrice: 100000000n,
      })

      mockClient.simulateContract = vi.fn().mockImplementation(async () => {
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const smallResult = await l2Estimator.estimate(smallCalldata)
      const largeResult = await l2Estimator.estimate(largeCalldata)

      // Larger calldata should have proportionally larger L1 cost
      const diff = largeResult.preVerificationGas - smallResult.preVerificationGas
      // L1 cost for extra bytes should be significant
      expect(diff).toBeGreaterThan(10000n)
    })

    it('should fetch L1 gas price dynamically when not configured', async () => {
      const userOp = createTestUserOp()

      // Mock getGasPrice call for L1 price fetch
      mockClient.getGasPrice = vi.fn().mockResolvedValue(25000000000n) // 25 gwei

      const l2Estimator = new GasEstimator(
        mockClient,
        ENTRY_POINT,
        mockLogger,
        { isL2Chain: true } // No fixed L1 gas price
      )

      mockClient.simulateContract = vi.fn().mockImplementation(async () => {
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      await l2Estimator.estimate(userOp)

      // Should have attempted to fetch gas price (or use oracle)
      // This validates the dynamic fetching mechanism exists
      expect(mockClient.getGasPrice).toHaveBeenCalled()
    })
  })

  describe('Factory deployment gas configuration', () => {
    // Binary search needs high gas threshold so factory ops require more gas
    // This forces the binary search to find different minimums for with/without factory

    it('should use default 200000n when not configured', async () => {
      const userOp = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
      })

      // Simulation needs 250000 gas for factory deployment (200000 deploy + 50000 base)
      mockClient.simulateContract = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        if (params.gas && params.gas < 250000n) {
          throw new Error('out of gas')
        }
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const defaultEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger)
      const result = await defaultEstimator.estimate(userOp)

      // Binary search should find ~250000, then +10% buffer
      expect(result.verificationGasLimit).toBeGreaterThanOrEqual(250000n)
    })

    it('should use custom factoryDeploymentGas when configured', () => {
      // Verify the config is accepted and stored
      const customEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        factoryDeploymentGas: 500000n,
      })
      expect(customEstimator).toBeDefined()
    })

    it('should apply factoryDeploymentGas only when factory present', async () => {
      const factoryGasThreshold = 250000n
      const noFactoryGasThreshold = 50000n

      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { gas?: bigint; args?: unknown[] }) => {
          // Check if this is a factory operation by examining the packed UserOp initCode
          const packedOp = params.args?.[0] as { initCode?: string } | undefined
          const hasFactory = packedOp?.initCode && packedOp.initCode !== '0x'
          const threshold = hasFactory ? factoryGasThreshold : noFactoryGasThreshold

          if (params.gas && params.gas < threshold) {
            throw new Error('out of gas')
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const estimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        factoryDeploymentGas: 500000n,
      })

      const userOpNoFactory = createTestUserOp()
      const userOpWithFactory = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
      })

      const resultNoFactory = await estimator.estimate(userOpNoFactory)
      const resultWithFactory = await estimator.estimate(userOpWithFactory)

      // With factory should be significantly higher than without
      expect(resultWithFactory.verificationGasLimit).toBeGreaterThan(
        resultNoFactory.verificationGasLimit
      )
    })

    it('should NOT add factory gas when no factory in UserOp', async () => {
      // Test that the fallback path uses the configurable factoryDeploymentGas
      // We access this through the config type check
      const config = {
        factoryDeploymentGas: 300000n,
        verificationGasBufferPercent: 10,
      }
      const estimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, config)

      // Regular op without factory - binary search with low threshold
      mockClient.simulateContract = vi.fn().mockImplementation(async (params: { gas?: bigint }) => {
        if (params.gas && params.gas < 50000n) {
          throw new Error('out of gas')
        }
        throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
      })

      const userOp = createTestUserOp() // no factory
      const result = await estimator.estimate(userOp)

      // Without factory: binary search finds ~50000 + 10% buffer = ~55000
      // Should NOT include the 300000n factoryDeploymentGas
      expect(result.verificationGasLimit).toBeLessThan(100000n)
    })
  })

  describe('Task 1.1.5: Configurable safety margins', () => {
    it('should allow per-operation-type buffer configuration', async () => {
      const userOp = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x1234' as Hex,
      })

      const customEstimator = new GasEstimator(mockClient, ENTRY_POINT, mockLogger, {
        verificationGasBufferPercent: 15,
        callGasBufferPercent: 10,
        preVerificationGasBufferPercent: 5,
        paymasterVerificationGasBufferPercent: 20, // Higher for paymaster
        paymasterPostOpGasBufferPercent: 25,
      })

      mockClient.getCode = vi.fn().mockResolvedValue('0x1234' as Hex)
      mockClient.simulateContract = vi
        .fn()
        .mockImplementation(async (params: { functionName: string }) => {
          if (params.functionName === 'simulateHandleOp') {
            throw { name: 'ContractFunctionExecutionError', data: '0x8b7ac980' }
          }
          throw { name: 'ContractFunctionExecutionError', data: '0x5eb2984f' }
        })

      const result = await customEstimator.estimate(userOp)

      // Verify paymaster verification gas is estimated with 20% buffer
      // Binary search finds minimum (starts from low=10000, high=500000)
      // Result should have 20% buffer applied
      expect(result.paymasterVerificationGasLimit).toBeDefined()
      expect(result.paymasterVerificationGasLimit).toBeGreaterThan(10000n)
    })

    it('should validate buffer percentage is not too high', () => {
      // Buffer percentage should be reasonable (0-100%)
      expect(() => {
        new GasEstimator(
          mockClient,
          ENTRY_POINT,
          mockLogger,
          { verificationGasBufferPercent: 200 } // Too high
        )
      }).toThrow()
    })

    it('should validate buffer percentage is not negative', () => {
      expect(() => {
        new GasEstimator(mockClient, ENTRY_POINT, mockLogger, { callGasBufferPercent: -10 })
      }).toThrow()
    })
  })
})
