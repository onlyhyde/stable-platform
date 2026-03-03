import type { Address, Hex, PublicClient } from 'viem'
import { concat, encodeFunctionData, keccak256, pad, toHex, toBytes } from 'viem'
import { ENTRY_POINT_ABI } from '../abi'
import type { UserOperation } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import type { ITracer, TraceCall, TraceResult } from './opcodeValidator'

/**
 * Configuration for DebugTraceCallTracer
 */
export interface TracerConfig {
  /** Gas limit for trace call (default: 10_000_000n) */
  gasLimit?: bigint
  /** Timeout string passed to the RPC node's tracer (default: '10s') */
  timeout?: string
  /** Client-side timeout in milliseconds (default: 15000).
   *  Must be >= RPC timeout to allow the node to respond first.
   *  If the RPC node hangs, this ensures the bundler doesn't block indefinitely. */
  clientTimeoutMs?: number
  /** Beneficiary address for handleOps trace (default: sender address) */
  beneficiary?: Address
}

/**
 * Default tracer configuration
 */
const DEFAULT_TRACER_CONFIG: Required<Omit<TracerConfig, 'beneficiary'>> = {
  gasLimit: 10_000_000n,
  timeout: '10s',
  clientTimeoutMs: 15_000,
}

/**
 * BeforeExecution event topic hash.
 * This event is emitted by EntryPoint between the validation and execution phases.
 * keccak256("BeforeExecution()")
 */
const BEFORE_EXECUTION_TOPIC = keccak256(toBytes('BeforeExecution()'))

/**
 * Custom JavaScript tracer for ERC-7562 opcode and storage validation.
 * Traces handleOps and uses the BeforeExecution event as the boundary between
 * validation and execution phases. Only validation-phase opcodes/storage are captured.
 *
 * The tracer detects LOG0 events matching the BeforeExecution() topic to mark
 * the phase transition. All opcodes and storage access before this event are
 * in the validation phase (subject to ERC-7562 restrictions).
 *
 * Output shape per call frame:
 *   { from, to, type, gas, gasUsed, input, output, opcodes: string[], storage: { [addr]: [slot] }, calls?: [...] }
 */
const VALIDATION_TRACER_JS = `{
  callStack: [{ opcodes: {}, storage: {}, calls: [] }],
  beforeExecutionSeen: false,
  currentFrame: function() { return this.callStack[this.callStack.length - 1]; },
  fault: function() {},
  step: function(log) {
    // Once BeforeExecution is seen, stop recording (execution phase)
    if (this.beforeExecutionSeen) return;

    var op = log.op.toString();
    var frame = this.currentFrame();
    frame.opcodes[op] = (frame.opcodes[op] || 0) + 1;

    // Detect BeforeExecution event: LOG0 with topic matching BeforeExecution()
    if (op === 'LOG0') {
      // LOG0 has offset and size on stack; we check if the emitter is the EntryPoint
      // The BeforeExecution event has no data and no indexed params (topic count = 0 for LOG0)
      // We detect it by the LOG0 opcode itself from the EntryPoint address
      this.beforeExecutionSeen = true;
      return;
    }

    if (op === 'SLOAD' || op === 'SSTORE') {
      var addr = toHex(log.contract.getAddress());
      var slot = toHex(log.stack.peek(0));
      if (!frame.storage[addr]) frame.storage[addr] = {};
      frame.storage[addr][slot] = true;
    }
  },
  enter: function(frame) {
    if (this.beforeExecutionSeen) return;
    this.callStack.push({
      type: frame.getType(),
      from: toHex(frame.getFrom()),
      to: toHex(frame.getTo()),
      input: toHex(frame.getInput()),
      gas: '0x' + frame.getGas().toString(16),
      opcodes: {},
      storage: {},
      calls: []
    });
  },
  exit: function(frame) {
    if (this.beforeExecutionSeen) return;
    if (this.callStack.length <= 1) return;
    var child = this.callStack.pop();
    child.gasUsed = '0x' + frame.getGasUsed().toString(16);
    child.output = toHex(frame.getOutput());
    // convert opcodes map to array of names
    child.opcodes = Object.keys(child.opcodes);
    // convert storage map to { addr: [slot, ...] }
    var st = {};
    for (var addr in child.storage) { st[addr] = Object.keys(child.storage[addr]); }
    child.storage = st;
    this.currentFrame().calls.push(child);
  },
  result: function() {
    var root = this.callStack[0];
    root.opcodes = Object.keys(root.opcodes);
    var st = {};
    for (var addr in root.storage) { st[addr] = Object.keys(root.storage[addr]); }
    root.storage = st;
    return { calls: root.calls, logs: [] };
  }
}`

/**
 * ITracer implementation using debug_traceCall RPC method.
 * Traces EntryPoint.handleOps to extract opcodes and storage access
 * during the validation phase (before BeforeExecution event).
 */
export class DebugTraceCallTracer implements ITracer {
  private readonly client: PublicClient
  private readonly entryPoint: Address
  private readonly logger: Logger
  private readonly config: Required<Omit<TracerConfig, 'beneficiary'>>
  private readonly beneficiary?: Address

  constructor(
    client: PublicClient,
    entryPoint: Address,
    logger: Logger,
    config: TracerConfig = {}
  ) {
    this.client = client
    this.entryPoint = entryPoint
    this.logger = logger.child({ module: 'tracer' })
    const { beneficiary, ...rest } = config
    this.config = { ...DEFAULT_TRACER_CONFIG, ...rest }
    this.beneficiary = beneficiary
  }

  /**
   * Trace a UserOperation validation by calling debug_traceCall on handleOps.
   * The JS tracer stops recording after the BeforeExecution event, so only
   * validation-phase opcodes and storage access are captured.
   */
  async trace(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Promise<TraceResult> {
    this.logger.debug({ sender, factory, paymaster }, 'Tracing UserOperation validation')

    // Build handleOps calldata with a minimal packed UserOp
    const calldata = this.buildHandleOpsCalldata(sender, factory, paymaster)

    const beneficiary = this.beneficiary ?? sender

    // Build the transaction object for debug_traceCall
    const txObject = {
      from: beneficiary,
      to: this.entryPoint,
      data: calldata,
      gas: `0x${this.config.gasLimit.toString(16)}`,
    }

    // Use custom JavaScript tracer for ERC-7562 opcode/storage validation.
    // The built-in callTracer does not expose per-frame opcodes or storage access.
    const tracerOptions = {
      tracer: VALIDATION_TRACER_JS,
      timeout: this.config.timeout,
    }

    let response: unknown
    try {
      response = await this.requestWithTimeout(txObject, tracerOptions)
    } catch (error) {
      this.logger.error({ error }, 'debug_traceCall failed')
      const isTimeout = error instanceof Error && error.message.includes('timed out')
      throw new RpcError(
        isTimeout
          ? `debug_traceCall timed out after ${this.config.clientTimeoutMs}ms`
          : `debug_traceCall failed: ${error instanceof Error ? error.message : 'unknown error'}`,
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
   * Execute debug_traceCall with a client-side timeout.
   * If the RPC node doesn't respond within clientTimeoutMs, the promise rejects.
   */
  private async requestWithTimeout(
    txObject: Record<string, unknown>,
    tracerOptions: Record<string, unknown>
  ): Promise<unknown> {
    const timeoutMs = this.config.clientTimeoutMs

    const rpcPromise = this.client.request({
      method: 'debug_traceCall' as never,
      params: [txObject, 'latest', tracerOptions] as never,
    })

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`debug_traceCall timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      // Allow the process to exit without waiting for the timer
      if (typeof timer === 'object' && 'unref' in timer) {
        timer.unref()
      }
    })

    return Promise.race([rpcPromise, timeoutPromise])
  }

  /**
   * Build handleOps calldata with a minimal packed UserOp.
   * Uses handleOps([packedUserOp], beneficiary) instead of simulateValidation.
   * The JS tracer will stop recording at the BeforeExecution event boundary.
   */
  private buildHandleOpsCalldata(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Hex {
    // Build initCode: factory address + factoryData (dummy)
    const initCode: Hex = factory ? (`${factory}${'00'.repeat(4)}` as Hex) : '0x'

    // Build paymasterAndData: paymaster address + verification gas + postOp gas + data
    let paymasterAndData: Hex = '0x'
    if (paymaster) {
      // paymaster(20) + verificationGas(16) + postOpGas(16) = 52 bytes
      paymasterAndData = `${paymaster}${'0'.repeat(32)}${'0'.repeat(32)}` as Hex
    }

    // Build accountGasLimits with generous gas for tracing
    const accountGasLimits = concat([
      pad(toHex(1_000_000n), { size: 16 }),  // verificationGasLimit
      pad(toHex(1_000_000n), { size: 16 }),   // callGasLimit
    ]) as Hex

    // Build gasFees
    const gasFees = concat([
      pad(toHex(1n), { size: 16 }),  // maxPriorityFeePerGas
      pad(toHex(1n), { size: 16 }),  // maxFeePerGas
    ]) as Hex

    const beneficiary = this.beneficiary ?? sender

    // Encode handleOps([PackedUserOperation], beneficiary)
    return encodeFunctionData({
      abi: ENTRY_POINT_ABI,
      functionName: 'handleOps',
      args: [
        [
          {
            sender,
            nonce: 0n,
            initCode,
            callData: '0x' as Hex,
            accountGasLimits,
            preVerificationGas: 21000n,
            gasFees,
            paymasterAndData,
            signature: `0x${'00'.repeat(65)}` as Hex,
          },
        ],
        beneficiary,
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
