import type { Address, Hex, PublicClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { ENTRY_POINT_V07_ABI } from '../abi'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import type { ITracer, TraceCall, TraceResult } from './opcodeValidator'

/**
 * Configuration for DebugTraceCallTracer
 */
export interface TracerConfig {
  /** Gas limit for trace call (default: 10_000_000n) */
  gasLimit?: bigint
  /** Timeout for trace call (default: '10s') */
  timeout?: string
}

/**
 * Default tracer configuration
 */
const DEFAULT_TRACER_CONFIG: Required<TracerConfig> = {
  gasLimit: 10_000_000n,
  timeout: '10s',
}

/**
 * ITracer implementation using debug_traceCall RPC method
 * Traces EntryPoint.simulateValidation to extract opcodes and storage access
 */
export class DebugTraceCallTracer implements ITracer {
  private readonly client: PublicClient
  private readonly entryPoint: Address
  private readonly logger: Logger
  private readonly config: Required<TracerConfig>

  constructor(
    client: PublicClient,
    entryPoint: Address,
    logger: Logger,
    config: TracerConfig = {}
  ) {
    this.client = client
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'tracer' })
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config }
  }

  /**
   * Trace a UserOperation validation by calling debug_traceCall on simulateValidation
   */
  async trace(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Promise<TraceResult> {
    this.logger.debug({ sender, factory, paymaster }, 'Tracing UserOperation validation')

    // Build a minimal packed UserOp for simulateValidation
    const calldata = this.buildSimulateValidationCalldata(sender, factory, paymaster)

    // Build the transaction object for debug_traceCall
    const txObject = {
      from: sender,
      to: this.entryPoint,
      data: calldata,
      gas: `0x${this.config.gasLimit.toString(16)}`,
    }

    // Tracer options for debug_traceCall
    const tracerOptions = {
      tracer: 'callTracer',
      tracerConfig: {
        withLog: true,
        onlyTopCall: false,
      },
      timeout: this.config.timeout,
    }

    let response: unknown
    try {
      response = await this.client.request({
        method: 'debug_traceCall' as never,
        params: [txObject, 'latest', tracerOptions] as never,
      })
    } catch (error) {
      this.logger.error({ error }, 'debug_traceCall failed')
      throw new RpcError(
        `debug_traceCall failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        RPC_ERROR_CODES.INTERNAL_ERROR
      )
    }

    // Validate response
    if (!response || typeof response !== 'object') {
      throw new RpcError(
        'debug_traceCall returned malformed response',
        RPC_ERROR_CODES.INTERNAL_ERROR
      )
    }

    return this.parseTraceResponse(response)
  }

  /**
   * Build simulateValidation calldata with a minimal UserOp
   */
  private buildSimulateValidationCalldata(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Hex {
    // Build initCode: factory address + factoryData (dummy)
    const initCode: Hex = factory ? `${factory}${'00'.repeat(4)}` as Hex : '0x'

    // Build paymasterAndData: paymaster address + verification gas + postOp gas + data
    let paymasterAndData: Hex = '0x'
    if (paymaster) {
      // paymaster(20) + verificationGas(16) + postOpGas(16) = 52 bytes
      paymasterAndData = `${paymaster}${'0'.repeat(32)}${'0'.repeat(32)}` as Hex
    }

    // Encode simulateValidation(PackedUserOperation)
    return encodeFunctionData({
      abi: ENTRY_POINT_V07_ABI,
      functionName: 'simulateValidation',
      args: [
        {
          sender,
          nonce: 0n,
          initCode,
          callData: '0x' as Hex,
          accountGasLimits: `0x${'0'.repeat(32)}${'0'.repeat(32)}` as Hex,
          preVerificationGas: 0n,
          gasFees: `0x${'0'.repeat(32)}${'0'.repeat(32)}` as Hex,
          paymasterAndData,
          signature: `0x${'00'.repeat(65)}` as Hex,
        },
      ],
    })
  }

  /**
   * Parse the raw debug_traceCall response into a TraceResult
   */
  private parseTraceResponse(response: unknown): TraceResult {
    const resp = response as Record<string, unknown>

    // Handle both flat response and response with nested 'result'
    const traceData = (resp.result ?? resp) as Record<string, unknown>

    // Parse calls - may be at top level or nested
    const rawCalls = traceData.calls as unknown[] | undefined
    const calls: TraceCall[] = rawCalls ? rawCalls.map((c) => this.parseTraceCall(c)) : []

    // Parse logs
    const rawLogs = traceData.logs as unknown[] | undefined
    const logs = rawLogs
      ? rawLogs.map((log) => {
          const l = log as Record<string, unknown>
          return {
            address: (l.address as Address) ?? ('0x' as Address),
            topics: (l.topics as Hex[]) ?? [],
            data: (l.data as Hex) ?? '0x',
          }
        })
      : []

    return { calls, logs }
  }

  /**
   * Parse a single trace call frame recursively
   */
  private parseTraceCall(raw: unknown): TraceCall {
    const call = raw as Record<string, unknown>

    const nestedCalls = call.calls as unknown[] | undefined

    return {
      from: (call.from as Address) ?? ('0x' as Address),
      to: (call.to as Address) ?? ('0x' as Address),
      type: (call.type as string) ?? 'CALL',
      gas: (call.gas as Hex) ?? '0x0',
      gasUsed: (call.gasUsed as Hex) ?? '0x0',
      input: (call.input as Hex) ?? '0x',
      output: (call.output as Hex) ?? '0x',
      opcodes: (call.opcodes as string[]) ?? [],
      storage: (call.storage as Record<Address, string[]>) ?? {},
      calls: nestedCalls ? nestedCalls.map((c) => this.parseTraceCall(c)) : undefined,
    }
  }
}
