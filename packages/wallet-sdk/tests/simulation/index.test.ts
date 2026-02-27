import { describe, expect, it, vi } from 'vitest'
import { simulateValidation, simulateHandleOp } from '../../src/simulation'
import type { SimulationResult, HandleOpSimulationResult } from '../../src/simulation'
import type { UserOperation } from '@stablenet/sdk-types'

const mockUserOp: UserOperation = {
  sender: '0x1234567890123456789012345678901234567890',
  nonce: 0n,
  callData: '0x',
  callGasLimit: 100000n,
  verificationGasLimit: 150000n,
  preVerificationGas: 50000n,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 100000000n,
  signature: '0x',
}

const mockEntryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const

describe('simulation module', () => {
  describe('simulateValidation', () => {
    it('should parse ValidationResult revert as valid', async () => {
      // ValidationResult selector: 0xe0cff05f
      // Followed by: preOpGas, prefund, accountValidationData, paymasterValidationData,
      //   senderStake, senderUnstakeDelay, factoryStake, factoryUnstakeDelay, paymasterStake, paymasterUnstakeDelay
      const validationResultData =
        '0xe0cff05f' +
        '0000000000000000000000000000000000000000000000000000000000001000' + // preOpGas = 4096
        '0000000000000000000000000000000000000000000000000000000000002000' + // prefund = 8192
        '0000000000000000000000000000000000000000000000000000000000000000' + // accountValidationData
        '0000000000000000000000000000000000000000000000000000000000000000' + // paymasterValidationData
        '0000000000000000000000000000000000000000000000000000000000000000' + // senderStake
        '0000000000000000000000000000000000000000000000000000000000000000' + // senderUnstakeDelay
        '0000000000000000000000000000000000000000000000000000000000000000' + // factoryStake
        '0000000000000000000000000000000000000000000000000000000000000000' + // factoryUnstakeDelay
        '0000000000000000000000000000000000000000000000000000000000000000' + // paymasterStake
        '0000000000000000000000000000000000000000000000000000000000000000'   // paymasterUnstakeDelay

      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: validationResultData }),
      } as unknown as Parameters<typeof simulateValidation>[0]

      const result: SimulationResult = await simulateValidation(
        mockClient, mockUserOp, mockEntryPoint
      )

      expect(result.valid).toBe(true)
      expect(result.returnInfo.preOpGas).toBe(4096n)
      expect(result.returnInfo.prefund).toBe(8192n)
      expect(result.error).toBeUndefined()
    })

    it('should parse FailedOp revert as invalid', async () => {
      // FailedOp selector: 0x220266b6
      // uint256 opIndex (0) + offset to string (64 = 0x40) + string length + string data
      const failedOpData =
        '0x220266b6' +
        '0000000000000000000000000000000000000000000000000000000000000000' + // opIndex = 0
        '0000000000000000000000000000000000000000000000000000000000000040' + // offset to string = 64
        '0000000000000000000000000000000000000000000000000000000000000006' + // string length = 6
        '4141323020' + '00'.repeat(27) // "AA20 " padded (6 bytes: 0x41 0x41 0x32 0x30 0x20 0x00 → "AA20 \0")

      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: failedOpData }),
      } as unknown as Parameters<typeof simulateValidation>[0]

      const result = await simulateValidation(mockClient, mockUserOp, mockEntryPoint)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle non-revert errors', async () => {
      const mockClient = {
        call: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as Parameters<typeof simulateValidation>[0]

      const result = await simulateValidation(mockClient, mockUserOp, mockEntryPoint)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('should handle unknown revert selectors', async () => {
      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: '0xdeadbeef0000' }),
      } as unknown as Parameters<typeof simulateValidation>[0]

      const result = await simulateValidation(mockClient, mockUserOp, mockEntryPoint)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unknown revert selector')
    })
  })

  describe('simulateHandleOp', () => {
    it('should parse ExecutionResult revert as valid', async () => {
      // ExecutionResult selector: 0x8b7ac980
      // preOpGas, paid, targetSuccess (1 = true), targetResult offset, targetResult length, targetResult data
      const executionResultData =
        '0x8b7ac980' +
        '0000000000000000000000000000000000000000000000000000000000001000' + // preOpGas
        '0000000000000000000000000000000000000000000000000000000000002000' + // paid
        '0000000000000000000000000000000000000000000000000000000000000001' + // targetSuccess = true
        '0000000000000000000000000000000000000000000000000000000000000080' + // targetResult offset
        '0000000000000000000000000000000000000000000000000000000000000000'   // targetResult (empty)

      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: executionResultData }),
      } as unknown as Parameters<typeof simulateHandleOp>[0]

      const target = '0x0000000000000000000000000000000000000000' as const
      const result: HandleOpSimulationResult = await simulateHandleOp(
        mockClient, mockUserOp, target, '0x', mockEntryPoint
      )

      expect(result.valid).toBe(true)
      expect(result.targetSuccess).toBe(true)
    })

    it('should parse FailedOp revert as invalid', async () => {
      const failedOpData =
        '0x220266b6' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000040' +
        '0000000000000000000000000000000000000000000000000000000000000004' +
        '66616964' + '00'.repeat(28) // "faid" + padding

      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: failedOpData }),
      } as unknown as Parameters<typeof simulateHandleOp>[0]

      const target = '0x0000000000000000000000000000000000000000' as const
      const result = await simulateHandleOp(
        mockClient, mockUserOp, target, '0x', mockEntryPoint
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle non-revert errors', async () => {
      const mockClient = {
        call: vi.fn().mockRejectedValue(new Error('RPC failure')),
      } as unknown as Parameters<typeof simulateHandleOp>[0]

      const target = '0x0000000000000000000000000000000000000000' as const
      const result = await simulateHandleOp(
        mockClient, mockUserOp, target, '0x', mockEntryPoint
      )

      expect(result.valid).toBe(false)
      expect(result.error).toContain('RPC failure')
    })
  })
})
