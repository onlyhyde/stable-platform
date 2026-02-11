import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RPC_ERROR_CODES, RpcError } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import {
  BANNED_OPCODES,
  OpcodeValidator,
  type OpcodeValidatorConfig,
  type TraceResult,
} from '../../src/validation/opcodeValidator'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const TEST_SENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TEST_FACTORY = '0x1111111111111111111111111111111111111111' as Address
const TEST_PAYMASTER = '0x2222222222222222222222222222222222222222' as Address

// Helper to create a mock trace result
function createMockTrace(overrides: Partial<TraceResult> = {}): TraceResult {
  return {
    calls: [],
    logs: [],
    ...overrides,
  }
}

// Helper to create a trace call with specific opcodes
function createTraceCall(
  from: Address,
  to: Address,
  opcodes: string[] = [],
  storage: Record<Address, string[]> = {}
): TraceResult['calls'][0] {
  return {
    from,
    to,
    type: 'CALL',
    gas: '0x10000',
    gasUsed: '0x5000',
    input: '0x',
    output: '0x',
    opcodes,
    storage,
  }
}

describe('OpcodeValidator', () => {
  let mockTracer: { trace: ReturnType<typeof vi.fn> }
  let validator: OpcodeValidator

  beforeEach(() => {
    mockTracer = {
      trace: vi.fn().mockResolvedValue(createMockTrace()),
    }
    validator = new OpcodeValidator(mockTracer, ENTRY_POINT, mockLogger)
  })

  describe('BANNED_OPCODES', () => {
    it('should define all ERC-7562 banned opcodes', () => {
      // Banned opcodes per ERC-7562
      const expectedBannedOpcodes = [
        'GASPRICE',
        'GASLIMIT',
        'DIFFICULTY',
        'TIMESTAMP',
        'BASEFEE',
        'BLOCKHASH',
        'NUMBER',
        'SELFBALANCE',
        'BALANCE',
        'ORIGIN',
        'GAS',
        'CREATE',
        'COINBASE',
        'SELFDESTRUCT',
        'RANDOM',
        'PREVRANDAO',
        'INVALID',
      ]

      for (const opcode of expectedBannedOpcodes) {
        expect(BANNED_OPCODES).toContain(opcode)
      }
    })
  })

  describe('validateOpcodes', () => {
    it('should pass for trace with no banned opcodes', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL', 'SLOAD', 'SSTORE', 'RETURN'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      // Should not throw
      await expect(validator.validate(TEST_SENDER, undefined, undefined)).resolves.not.toThrow()
    })

    it('should reject GASPRICE opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL', 'GASPRICE', 'RETURN'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)

      try {
        await validator.validate(TEST_SENDER, undefined, undefined)
      } catch (error) {
        expect(error).toBeInstanceOf(RpcError)
        expect((error as RpcError).code).toBe(RPC_ERROR_CODES.BANNED_OPCODE)
        expect((error as RpcError).message).toContain('GASPRICE')
      }
    })

    it('should reject CREATE opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL', 'CREATE', 'RETURN'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject SELFDESTRUCT opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['SELFDESTRUCT'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject TIMESTAMP opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL', 'TIMESTAMP', 'RETURN'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject ORIGIN opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL', 'ORIGIN', 'RETURN'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject COINBASE opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['COINBASE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject BALANCE opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['BALANCE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject BLOCKHASH opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['BLOCKHASH'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject NUMBER opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['NUMBER'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject PREVRANDAO opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['PREVRANDAO'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })
  })

  describe('Entity-specific validation', () => {
    it('should identify sender using banned opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['TIMESTAMP'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, undefined, undefined)
      } catch (error) {
        expect((error as RpcError).message).toContain('sender')
        expect((error as RpcError).message).toContain('TIMESTAMP')
      }
    })

    it('should identify factory using banned opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_FACTORY, ENTRY_POINT, ['CREATE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, TEST_FACTORY, undefined)
      } catch (error) {
        expect((error as RpcError).message).toContain('factory')
        expect((error as RpcError).message).toContain('CREATE')
      }
    })

    it('should identify paymaster using banned opcode', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['GASPRICE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, undefined, TEST_PAYMASTER)
      } catch (error) {
        expect((error as RpcError).message).toContain('paymaster')
        expect((error as RpcError).message).toContain('GASPRICE')
      }
    })
  })

  describe('Storage access validation', () => {
    it('should allow sender to access own storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD', 'SSTORE'], {
            [TEST_SENDER]: ['0x0', '0x1'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).resolves.not.toThrow()
    })

    it('should reject sender accessing other account storage', async () => {
      const otherAccount = '0x3333333333333333333333333333333333333333' as Address
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD'], {
            [otherAccount]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should allow factory to access associated storage slots', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_FACTORY, ENTRY_POINT, ['SLOAD'], {
            [TEST_SENDER]: ['0x0'], // Factory can access sender's storage during deployment
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, TEST_FACTORY, undefined)).resolves.not.toThrow()
    })

    it('should allow paymaster to access own storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['SLOAD', 'SSTORE'], {
            [TEST_PAYMASTER]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(
        validator.validate(TEST_SENDER, undefined, TEST_PAYMASTER)
      ).resolves.not.toThrow()
    })

    it('should reject paymaster accessing arbitrary storage', async () => {
      const randomAccount = '0x4444444444444444444444444444444444444444' as Address
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['SLOAD'], {
            [randomAccount]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, TEST_PAYMASTER)).rejects.toThrow(
        RpcError
      )
    })
  })

  describe('CREATE2 validation', () => {
    it('should allow factory to use CREATE2', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_FACTORY, ENTRY_POINT, ['CREATE2'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      // CREATE2 is allowed only for factory during account deployment
      await expect(validator.validate(TEST_SENDER, TEST_FACTORY, undefined)).resolves.not.toThrow()
    })

    it('should reject sender using CREATE2', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['CREATE2'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should reject paymaster using CREATE2', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['CREATE2'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, TEST_PAYMASTER)).rejects.toThrow(
        RpcError
      )
    })
  })

  describe('Configuration', () => {
    it('should use custom config when provided', () => {
      const customConfig: OpcodeValidatorConfig = {
        allowedOpcodes: ['TIMESTAMP'], // Override banned opcodes
        strictStorageAccess: false,
      }

      const customValidator = new OpcodeValidator(mockTracer, ENTRY_POINT, mockLogger, customConfig)

      expect(customValidator).toBeDefined()
    })

    it('should allow TIMESTAMP when configured as allowed', async () => {
      const customConfig: OpcodeValidatorConfig = {
        allowedOpcodes: ['TIMESTAMP'],
        strictStorageAccess: true,
      }

      const customValidator = new OpcodeValidator(mockTracer, ENTRY_POINT, mockLogger, customConfig)

      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['TIMESTAMP'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(
        customValidator.validate(TEST_SENDER, undefined, undefined)
      ).resolves.not.toThrow()
    })
  })

  describe('Error messages', () => {
    it('should provide detailed error message with opcode and entity', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['GASPRICE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, undefined, undefined)
        expect.fail('Should have thrown')
      } catch (error) {
        const rpcError = error as RpcError
        expect(rpcError.code).toBe(RPC_ERROR_CODES.BANNED_OPCODE)
        expect(rpcError.message).toMatch(/sender.*GASPRICE|GASPRICE.*sender/i)
      }
    })

    it('should provide storage access violation details', async () => {
      const otherAccount = '0x5555555555555555555555555555555555555555' as Address
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD'], {
            [otherAccount]: ['0x123'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, undefined, undefined)
        expect.fail('Should have thrown')
      } catch (error) {
        const rpcError = error as RpcError
        expect(rpcError.message).toContain('storage')
        expect(rpcError.message.toLowerCase()).toContain(otherAccount.toLowerCase())
      }
    })
  })

  describe('Multiple violations', () => {
    it('should report first violation when multiple banned opcodes used', async () => {
      const trace = createMockTrace({
        calls: [createTraceCall(TEST_SENDER, ENTRY_POINT, ['TIMESTAMP', 'GASPRICE', 'COINBASE'])],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should validate all entities in order', async () => {
      // Paymaster uses banned opcode
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL']),
          createTraceCall(TEST_FACTORY, TEST_SENDER, ['CREATE2']), // Factory allowed
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['TIMESTAMP']), // Paymaster not allowed
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      try {
        await validator.validate(TEST_SENDER, TEST_FACTORY, TEST_PAYMASTER)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as RpcError).message).toContain('paymaster')
      }
    })
  })

  describe('Storage access validation (ERC-7562 compliance)', () => {
    it('should reject sender accessing other account storage', async () => {
      const otherAccount = '0x7777777777777777777777777777777777777777' as Address
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD'], {
            [otherAccount]: ['0x0', '0x1'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
      try {
        await validator.validate(TEST_SENDER, undefined, undefined)
      } catch (error) {
        expect((error as RpcError).message).toContain('storage')
        expect((error as RpcError).message.toLowerCase()).toContain(otherAccount.toLowerCase())
      }
    })

    it('should reject factory accessing paymaster storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_FACTORY, ENTRY_POINT, ['SLOAD'], {
            [TEST_PAYMASTER]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, TEST_FACTORY, TEST_PAYMASTER)).rejects.toThrow(
        RpcError
      )
      try {
        await validator.validate(TEST_SENDER, TEST_FACTORY, TEST_PAYMASTER)
      } catch (error) {
        expect((error as RpcError).message).toContain('storage')
      }
    })

    it('should allow factory accessing sender storage during deployment', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_FACTORY, ENTRY_POINT, ['SLOAD', 'SSTORE'], {
            [TEST_SENDER]: ['0x0', '0x1', '0x2'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, TEST_FACTORY, undefined)).resolves.not.toThrow()
    })

    it('should allow paymaster accessing own storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['SLOAD', 'SSTORE'], {
            [TEST_PAYMASTER]: ['0x0', '0x1'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(
        validator.validate(TEST_SENDER, undefined, TEST_PAYMASTER)
      ).resolves.not.toThrow()
    })

    it('should reject paymaster accessing factory storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['SLOAD'], {
            [TEST_FACTORY]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, TEST_FACTORY, TEST_PAYMASTER)).rejects.toThrow(
        RpcError
      )
    })

    it('should handle nested call storage violations', async () => {
      const otherAccount = '0x8888888888888888888888888888888888888888' as Address
      const outerCall = createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL'])
      outerCall.calls = [
        createTraceCall(TEST_SENDER, otherAccount, ['SLOAD'], {
          [otherAccount]: ['0x0'],
        }),
      ]

      const trace = createMockTrace({ calls: [outerCall] })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should allow entity accessing own storage', async () => {
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD', 'SSTORE'], {
            [TEST_SENDER]: ['0x0'],
          }),
          createTraceCall(TEST_FACTORY, ENTRY_POINT, ['SLOAD'], {
            [TEST_FACTORY]: ['0x0'],
          }),
          createTraceCall(TEST_PAYMASTER, ENTRY_POINT, ['SLOAD'], {
            [TEST_PAYMASTER]: ['0x0'],
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(
        validator.validate(TEST_SENDER, TEST_FACTORY, TEST_PAYMASTER)
      ).resolves.not.toThrow()
    })

    it('should handle empty storage records', async () => {
      const otherAccount = '0x9999999999999999999999999999999999999999' as Address
      const trace = createMockTrace({
        calls: [
          createTraceCall(TEST_SENDER, ENTRY_POINT, ['SLOAD'], {
            [otherAccount]: [], // empty slots array
          }),
        ],
      })
      mockTracer.trace.mockResolvedValue(trace)

      // Empty storage records should not trigger a violation
      await expect(validator.validate(TEST_SENDER, undefined, undefined)).resolves.not.toThrow()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty trace', async () => {
      mockTracer.trace.mockResolvedValue(createMockTrace({ calls: [] }))

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).resolves.not.toThrow()
    })

    it('should handle trace error gracefully', async () => {
      mockTracer.trace.mockRejectedValue(new Error('Trace failed'))

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow()
    })

    it('should handle nested calls', async () => {
      const nestedCall = createTraceCall(TEST_SENDER, ENTRY_POINT, ['CALL'])
      nestedCall.calls = [
        createTraceCall(TEST_SENDER, '0x6666666666666666666666666666666666666666' as Address, [
          'TIMESTAMP',
        ]),
      ]

      const trace = createMockTrace({
        calls: [nestedCall],
      })
      mockTracer.trace.mockResolvedValue(trace)

      await expect(validator.validate(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })
  })
})
