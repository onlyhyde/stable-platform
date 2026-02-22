/**
 * RPC utility functions - parsing, formatting, and error creation
 *
 * Extracted from handler.ts to reduce file size and improve maintainability.
 */

import type { UserOperation } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { RpcError } from '../../shared/errors/rpcErrors'

/**
 * Parse UserOperation from RPC params
 * Handles both hex string and BigInt formats
 */
export function parseUserOperation(param: unknown): UserOperation | null {
  if (!param || typeof param !== 'object') {
    return null
  }

  const obj = param as Record<string, unknown>

  // Required fields
  if (!obj.sender || !obj.callData) {
    return null
  }

  try {
    return {
      sender: obj.sender as Address,
      nonce: parseBigInt(obj.nonce, BigInt(0)),
      factory: obj.factory as Address | undefined,
      factoryData: obj.factoryData as Hex | undefined,
      callData: obj.callData as Hex,
      callGasLimit: parseBigInt(obj.callGasLimit, BigInt(200000)),
      verificationGasLimit: parseBigInt(obj.verificationGasLimit, BigInt(500000)),
      preVerificationGas: parseBigInt(obj.preVerificationGas, BigInt(50000)),
      maxFeePerGas: parseBigInt(obj.maxFeePerGas, BigInt(0)),
      maxPriorityFeePerGas: parseBigInt(obj.maxPriorityFeePerGas, BigInt(0)),
      paymaster: obj.paymaster as Address | undefined,
      paymasterVerificationGasLimit: obj.paymasterVerificationGasLimit
        ? parseBigInt(obj.paymasterVerificationGasLimit, BigInt(0))
        : undefined,
      paymasterPostOpGasLimit: obj.paymasterPostOpGasLimit
        ? parseBigInt(obj.paymasterPostOpGasLimit, BigInt(0))
        : undefined,
      paymasterData: obj.paymasterData as Hex | undefined,
      signature: (obj.signature as Hex) ?? '0x',
    }
  } catch {
    return null
  }
}

/**
 * Parse a value to BigInt
 * Handles hex strings, decimal strings, numbers, and BigInt
 */
export function parseBigInt(value: unknown, defaultValue: bigint): bigint {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    return BigInt(value)
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value)
    }
    return BigInt(value)
  }
  return defaultValue
}

/**
 * Format transaction type to hex string
 * Converts viem's string type (e.g., "legacy", "eip1559") to JSON-RPC hex format
 */
export function formatTransactionType(type: string): Hex {
  const typeMap: Record<string, number> = {
    legacy: 0,
    eip2930: 1,
    eip1559: 2,
    eip4844: 3,
    eip7702: 4,
  }
  const typeNumber = typeMap[type] ?? 0
  return `0x${typeNumber.toString(16)}` as Hex
}

/**
 * Create a typed RPC error
 */
export function createRpcError(error: { code: number; message: string; data?: unknown }): RpcError {
  return new RpcError(error.code, error.message, error.data)
}

/**
 * Format balance with decimals
 */
export function formatBalance(balance: string, decimals: number): string {
  if (balance === '0') return '0'

  const bn = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = bn / divisor
  const remainder = bn % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '')

  return `${whole}.${trimmed}`
}

/**
 * Decode string result from ABI-encoded data
 */
export function decodeStringResult(data: Hex | undefined): string {
  if (!data || data === '0x') return ''

  const hex = data.replace('0x', '')

  // Check if it's a dynamic string (starts with offset)
  if (hex.length >= 128) {
    // Dynamic string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = hex.slice(64, 128)
    const length = Number.parseInt(lengthHex, 16)
    const stringHex = hex.slice(128, 128 + length * 2)
    try {
      // Convert hex to UTF-8 string
      const bytes = new Uint8Array(
        stringHex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []
      )
      return new TextDecoder().decode(bytes).replace(/\0/g, '')
    } catch {
      return ''
    }
  }

  // Static bytes32 string
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [])
    return new TextDecoder().decode(bytes).replace(/\0/g, '')
  } catch {
    return ''
  }
}

/**
 * Format block for JSON-RPC response
 */
export function formatBlock(
  block: {
    number: bigint | null
    hash: Hex | null
    parentHash: Hex
    nonce: Hex | null
    sha3Uncles: Hex
    logsBloom: Hex | null
    transactionsRoot: Hex
    stateRoot: Hex
    receiptsRoot: Hex
    miner: Address
    difficulty: bigint
    totalDifficulty: bigint | null
    extraData: Hex
    size: bigint
    gasLimit: bigint
    gasUsed: bigint
    timestamp: bigint
    transactions: readonly (Hex | { hash: Hex })[]
    uncles: readonly Hex[]
    baseFeePerGas?: bigint | null
  },
  includeTransactions: boolean
): Record<string, unknown> {
  return {
    number: block.number ? `0x${block.number.toString(16)}` : null,
    hash: block.hash,
    parentHash: block.parentHash,
    nonce: block.nonce,
    sha3Uncles: block.sha3Uncles,
    logsBloom: block.logsBloom,
    transactionsRoot: block.transactionsRoot,
    stateRoot: block.stateRoot,
    receiptsRoot: block.receiptsRoot,
    miner: block.miner,
    difficulty: `0x${block.difficulty.toString(16)}`,
    totalDifficulty: block.totalDifficulty ? `0x${block.totalDifficulty.toString(16)}` : null,
    extraData: block.extraData,
    size: `0x${block.size.toString(16)}`,
    gasLimit: `0x${block.gasLimit.toString(16)}`,
    gasUsed: `0x${block.gasUsed.toString(16)}`,
    timestamp: `0x${block.timestamp.toString(16)}`,
    transactions: includeTransactions
      ? block.transactions
      : block.transactions.map((tx) => (typeof tx === 'string' ? tx : tx.hash)),
    uncles: block.uncles,
    baseFeePerGas: block.baseFeePerGas ? `0x${block.baseFeePerGas.toString(16)}` : null,
  }
}
