/**
 * Batch Transaction Support
 *
 * Provides utilities for batching multiple transactions/calls:
 * - Multicall for read operations
 * - Batch execution for smart accounts
 * - Transaction bundling
 */

import type { Address, Hex } from 'viem'
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
} from 'viem'

// ============================================================================
// Constants
// ============================================================================

/**
 * Multicall3 contract addresses (deployed on most chains)
 */
export const MULTICALL3_ADDRESSES: Record<number, Address> = {
  1: '0xcA11bde05977b3631167028862bE2a173976CA11', // Ethereum Mainnet
  10: '0xcA11bde05977b3631167028862bE2a173976CA11', // Optimism
  137: '0xcA11bde05977b3631167028862bE2a173976CA11', // Polygon
  42161: '0xcA11bde05977b3631167028862bE2a173976CA11', // Arbitrum
  8453: '0xcA11bde05977b3631167028862bE2a173976CA11', // Base
  11155111: '0xcA11bde05977b3631167028862bE2a173976CA11', // Sepolia
} as const

// ============================================================================
// Types
// ============================================================================

/**
 * A single call in a batch
 */
export interface Call {
  /** Target contract address */
  target: Address
  /** Call data */
  data: Hex
  /** Value to send (optional) */
  value?: bigint
}

/**
 * Call with allow failure flag
 */
export interface CallWithAllowFailure extends Call {
  /** Whether this call can fail without reverting the batch */
  allowFailure?: boolean
}

/**
 * Result of a single call in a batch
 */
export interface CallResult {
  /** Whether the call succeeded */
  success: boolean
  /** Return data */
  returnData: Hex
}

/**
 * Batch execution mode
 */
export type BatchMode =
  | 'strict' // All calls must succeed
  | 'tryAggregate' // Collect results, failures don't revert
  | 'aggregate3' // Per-call failure handling

/**
 * Batch execution options
 */
export interface BatchExecutionOptions {
  /** Execution mode */
  mode?: BatchMode
  /** Total value to send */
  value?: bigint
}

/**
 * ERC-7579 execution mode encoding
 */
export const EXEC_MODE = {
  /** Default single execution */
  DEFAULT: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
  /** Batch execution */
  BATCH: '0x0100000000000000000000000000000000000000000000000000000000000000' as Hex,
  /** Try execution (don't revert on failure) */
  TRY: '0x0001000000000000000000000000000000000000000000000000000000000000' as Hex,
  /** Delegatecall execution */
  DELEGATE: '0x00ff000000000000000000000000000000000000000000000000000000000000' as Hex,
} as const

// ============================================================================
// Multicall Encoding
// ============================================================================

/**
 * Multicall3 ABI
 */
export const MULTICALL3_ABI = [
  {
    name: 'aggregate',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'blockNumber', type: 'uint256' },
      { name: 'returnData', type: 'bytes[]' },
    ],
  },
  {
    name: 'tryAggregate',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'requireSuccess', type: 'bool' },
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
  {
    name: 'aggregate3',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
  {
    name: 'aggregate3Value',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const

/**
 * Encode aggregate call (strict mode)
 */
export function encodeAggregate(calls: Call[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate',
    args: [calls.map((c) => ({ target: c.target, callData: c.data }))],
  })
}

/**
 * Encode tryAggregate call
 */
export function encodeTryAggregate(calls: Call[], requireSuccess = false): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'tryAggregate',
    args: [requireSuccess, calls.map((c) => ({ target: c.target, callData: c.data }))],
  })
}

/**
 * Encode aggregate3 call (per-call failure handling)
 */
export function encodeAggregate3(calls: CallWithAllowFailure[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [
      calls.map((c) => ({
        target: c.target,
        allowFailure: c.allowFailure ?? false,
        callData: c.data,
      })),
    ],
  })
}

/**
 * Encode aggregate3Value call (with value per call)
 */
export function encodeAggregate3Value(calls: CallWithAllowFailure[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3Value',
    args: [
      calls.map((c) => ({
        target: c.target,
        allowFailure: c.allowFailure ?? false,
        value: c.value ?? 0n,
        callData: c.data,
      })),
    ],
  })
}

// ============================================================================
// ERC-7579 Batch Execution
// ============================================================================

/**
 * Execution struct for ERC-7579
 */
export interface Execution {
  target: Address
  value: bigint
  callData: Hex
}

/**
 * Encode single execution for ERC-7579
 */
export function encodeExecution(execution: Execution): Hex {
  return encodeAbiParameters(parseAbiParameters('address target, uint256 value, bytes callData'), [
    execution.target,
    execution.value,
    execution.callData,
  ])
}

/**
 * Encode batch execution for ERC-7579
 */
export function encodeBatchExecution(executions: Execution[]): Hex {
  return encodeAbiParameters(
    parseAbiParameters('(address target, uint256 value, bytes callData)[]'),
    [executions.map((e) => ({ target: e.target, value: e.value, callData: e.callData }))]
  )
}

/**
 * Encode execute call for ERC-7579 accounts
 */
export function encodeExecuteCall(mode: Hex, executionCalldata: Hex): Hex {
  return encodeAbiParameters(parseAbiParameters('bytes32 mode, bytes executionCalldata'), [
    mode as `0x${string}`,
    executionCalldata,
  ])
}

/**
 * Create batch execution calldata for ERC-7579 account
 */
export function createBatchExecutionCalldata(calls: Call[]): { mode: Hex; calldata: Hex } {
  const executions: Execution[] = calls.map((c) => ({
    target: c.target,
    value: c.value ?? 0n,
    callData: c.data,
  }))

  return {
    mode: EXEC_MODE.BATCH,
    calldata: encodeBatchExecution(executions),
  }
}

// ============================================================================
// Batch Builder
// ============================================================================

/**
 * Fluent batch transaction builder
 *
 * @example
 * ```typescript
 * const batch = createBatchBuilder()
 *   .add(tokenContract, 'transfer', [recipient, amount])
 *   .add(swapContract, 'swap', [params])
 *   .addRaw(customCall)
 *   .build()
 * ```
 */
export class BatchBuilder {
  private calls: CallWithAllowFailure[] = []

  /**
   * Add a raw call to the batch
   */
  addRaw(call: Call | CallWithAllowFailure): this {
    this.calls.push(call)
    return this
  }

  /**
   * Add multiple raw calls
   */
  addRawBatch(calls: (Call | CallWithAllowFailure)[]): this {
    this.calls.push(...calls)
    return this
  }

  /**
   * Add an encoded function call
   */
  add(target: Address, data: Hex, options?: { value?: bigint; allowFailure?: boolean }): this {
    this.calls.push({
      target,
      data,
      value: options?.value,
      allowFailure: options?.allowFailure,
    })
    return this
  }

  /**
   * Add a call that's allowed to fail
   */
  addOptional(target: Address, data: Hex, value?: bigint): this {
    return this.add(target, data, { value, allowFailure: true })
  }

  /**
   * Get the number of calls in the batch
   */
  get length(): number {
    return this.calls.length
  }

  /**
   * Check if batch is empty
   */
  get isEmpty(): boolean {
    return this.calls.length === 0
  }

  /**
   * Get all calls
   */
  getCalls(): CallWithAllowFailure[] {
    return [...this.calls]
  }

  /**
   * Clear all calls
   */
  clear(): this {
    this.calls = []
    return this
  }

  /**
   * Build multicall3 calldata
   */
  buildMulticall(mode: BatchMode = 'aggregate3'): {
    to: Address
    data: Hex
    value: bigint
    chainId?: number
  } {
    const totalValue = this.calls.reduce((sum, c) => sum + (c.value ?? 0n), 0n)

    let data: Hex
    switch (mode) {
      case 'strict':
        data = encodeAggregate(this.calls)
        break
      case 'tryAggregate':
        data = encodeTryAggregate(this.calls)
        break
      default:
        data = this.calls.some((c) => c.value && c.value > 0n)
          ? encodeAggregate3Value(this.calls)
          : encodeAggregate3(this.calls)
        break
    }

    // Default to Ethereum mainnet multicall3 address
    const multicallAddress = MULTICALL3_ADDRESSES[1] as Address

    return {
      to: multicallAddress,
      data,
      value: totalValue,
    }
  }

  /**
   * Build ERC-7579 batch execution
   */
  buildExecution(): { mode: Hex; calldata: Hex } {
    return createBatchExecutionCalldata(this.calls)
  }

  /**
   * Build UserOperation calldata
   */
  buildUserOpCalldata(): Hex {
    const { mode, calldata } = this.buildExecution()
    return encodeExecuteCall(mode, calldata)
  }
}

/**
 * Create a new batch builder
 */
export function createBatchBuilder(): BatchBuilder {
  return new BatchBuilder()
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Decode multicall results
 */
export function decodeMulticallResults(data: Hex, mode: BatchMode): CallResult[] {
  // Implementation depends on the specific ABI decoding
  // This is a simplified version
  if (mode === 'strict') {
    // aggregate returns (uint256 blockNumber, bytes[] returnData)
    const decoded = decodeFunctionResult({
      abi: MULTICALL3_ABI,
      functionName: 'aggregate',
      data,
    }) as [bigint, Hex[]]

    return decoded[1].map((returnData) => ({
      success: true,
      returnData,
    }))
  }

  // tryAggregate and aggregate3 return (bool success, bytes returnData)[]
  const decoded = decodeFunctionResult({
    abi: MULTICALL3_ABI,
    functionName: mode === 'tryAggregate' ? 'tryAggregate' : 'aggregate3',
    data,
  }) as { success: boolean; returnData: Hex }[]

  return decoded.map((r) => ({
    success: r.success,
    returnData: r.returnData,
  }))
}

/**
 * Calculate total value for a batch of calls
 */
export function calculateBatchValue(calls: Call[]): bigint {
  return calls.reduce((sum, call) => sum + (call.value ?? 0n), 0n)
}

/**
 * Merge multiple batches into one
 */
export function mergeBatches(...batches: Call[][]): Call[] {
  return batches.flat()
}

/**
 * Split a batch into chunks of a given size
 */
export function chunkBatch<T extends Call>(calls: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < calls.length; i += chunkSize) {
    chunks.push(calls.slice(i, i + chunkSize))
  }
  return chunks
}
