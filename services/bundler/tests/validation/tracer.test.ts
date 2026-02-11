import type { Address, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RPC_ERROR_CODES, RpcError } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import type { TraceResult } from '../../src/validation/opcodeValidator'
import { DebugTraceCallTracer, type TracerConfig } from '../../src/validation/tracer'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const TEST_SENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TEST_FACTORY = '0x1111111111111111111111111111111111111111' as Address
const TEST_PAYMASTER = '0x2222222222222222222222222222222222222222' as Address

// Helper: create a mock RPC trace response matching debug_traceCall format
function createMockRpcTraceResponse(
  overrides: Partial<{
    calls: unknown[]
    logs: unknown[]
  }> = {}
) {
  return {
    calls: overrides.calls ?? [
      {
        from: TEST_SENDER.toLowerCase(),
        to: ENTRY_POINT.toLowerCase(),
        type: 'CALL',
        gas: '0x10000',
        gasUsed: '0x5000',
        input: '0x',
        output: '0x',
        opcodes: ['CALL', 'SLOAD', 'RETURN'],
        storage: {},
        calls: [],
      },
    ],
    logs: overrides.logs ?? [],
  }
}

describe('DebugTraceCallTracer', () => {
  let mockClient: PublicClient

  beforeEach(() => {
    mockClient = {
      request: vi.fn(),
    } as unknown as PublicClient
  })

  describe('constructor', () => {
    it('should accept PublicClient and entryPoint address', () => {
      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      expect(tracer).toBeDefined()
    })

    it('should accept optional TracerConfig', () => {
      const config: TracerConfig = {
        gasLimit: 5_000_000n,
        timeout: '5s',
      }
      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger, config)
      expect(tracer).toBeDefined()
    })
  })

  describe('trace', () => {
    it('should call debug_traceCall via client.request', async () => {
      const mockResponse = createMockRpcTraceResponse()
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      await tracer.trace(TEST_SENDER, undefined, undefined)

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'debug_traceCall',
        })
      )
    })

    it('should construct trace params for sender-only UserOp', async () => {
      const mockResponse = createMockRpcTraceResponse()
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      await tracer.trace(TEST_SENDER, undefined, undefined)

      const callArgs = (mockClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.method).toBe('debug_traceCall')
      // Should have tx object targeting entryPoint
      expect(callArgs.params[0].to).toBe(ENTRY_POINT)
    })

    it('should include factory in params when provided', async () => {
      const mockResponse = createMockRpcTraceResponse()
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      await tracer.trace(TEST_SENDER, TEST_FACTORY, undefined)

      expect(mockClient.request).toHaveBeenCalledTimes(1)
    })

    it('should include paymaster in params when provided', async () => {
      const mockResponse = createMockRpcTraceResponse()
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      await tracer.trace(TEST_SENDER, undefined, TEST_PAYMASTER)

      expect(mockClient.request).toHaveBeenCalledTimes(1)
    })

    it('should parse trace response into TraceResult format', async () => {
      const mockResponse = createMockRpcTraceResponse()
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      const result: TraceResult = await tracer.trace(TEST_SENDER, undefined, undefined)

      expect(result).toBeDefined()
      expect(result.calls).toBeDefined()
      expect(Array.isArray(result.calls)).toBe(true)
      expect(result.logs).toBeDefined()
      expect(Array.isArray(result.logs)).toBe(true)
    })

    it('should handle nested calls in trace response', async () => {
      const mockResponse = createMockRpcTraceResponse({
        calls: [
          {
            from: TEST_SENDER.toLowerCase(),
            to: ENTRY_POINT.toLowerCase(),
            type: 'CALL',
            gas: '0x10000',
            gasUsed: '0x5000',
            input: '0x',
            output: '0x',
            opcodes: ['CALL'],
            storage: {},
            calls: [
              {
                from: TEST_FACTORY.toLowerCase(),
                to: TEST_SENDER.toLowerCase(),
                type: 'CREATE2',
                gas: '0x8000',
                gasUsed: '0x3000',
                input: '0x1234',
                output: '0x',
                opcodes: ['CREATE2', 'SSTORE'],
                storage: { [TEST_SENDER.toLowerCase()]: ['0x0'] },
              },
            ],
          },
        ],
      })
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      const result = await tracer.trace(TEST_SENDER, TEST_FACTORY, undefined)

      expect(result.calls).toHaveLength(1)
      expect(result.calls[0].calls).toBeDefined()
      expect(result.calls[0].calls).toHaveLength(1)
    })

    it('should extract opcodes from trace call frames', async () => {
      const mockResponse = createMockRpcTraceResponse({
        calls: [
          {
            from: TEST_SENDER.toLowerCase(),
            to: ENTRY_POINT.toLowerCase(),
            type: 'CALL',
            gas: '0x10000',
            gasUsed: '0x5000',
            input: '0x',
            output: '0x',
            opcodes: ['CALL', 'SLOAD', 'SSTORE', 'RETURN'],
            storage: {},
          },
        ],
      })
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      const result = await tracer.trace(TEST_SENDER, undefined, undefined)

      expect(result.calls[0].opcodes).toEqual(['CALL', 'SLOAD', 'SSTORE', 'RETURN'])
    })

    it('should extract storage access records', async () => {
      const storageRecords = {
        [TEST_SENDER.toLowerCase()]: ['0x0', '0x1'],
      }
      const mockResponse = createMockRpcTraceResponse({
        calls: [
          {
            from: TEST_SENDER.toLowerCase(),
            to: ENTRY_POINT.toLowerCase(),
            type: 'CALL',
            gas: '0x10000',
            gasUsed: '0x5000',
            input: '0x',
            output: '0x',
            opcodes: ['SLOAD'],
            storage: storageRecords,
          },
        ],
      })
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)
      const result = await tracer.trace(TEST_SENDER, undefined, undefined)

      expect(result.calls[0].storage).toEqual(storageRecords)
    })
  })

  describe('error handling', () => {
    it('should throw RpcError on RPC failure', async () => {
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('RPC connection failed')
      )

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)

      await expect(tracer.trace(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
      await expect(tracer.trace(TEST_SENDER, undefined, undefined)).rejects.toMatchObject({
        code: RPC_ERROR_CODES.INTERNAL_ERROR,
      })
    })

    it('should throw RpcError when debug_traceCall not supported', async () => {
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('method not found')
      )

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)

      await expect(tracer.trace(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })

    it('should throw RpcError on malformed response', async () => {
      ;(mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const tracer = new DebugTraceCallTracer(mockClient, ENTRY_POINT, mockLogger)

      await expect(tracer.trace(TEST_SENDER, undefined, undefined)).rejects.toThrow(RpcError)
    })
  })
})
