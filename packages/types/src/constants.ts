/**
 * Contract address constants - re-exported from @stablenet/contracts (Single Source of Truth)
 *
 * These canonical addresses are the same on all production EVM chains (deployed via CREATE2).
 * For chain-specific addresses (local dev, custom deployments), use:
 *   import { getEntryPoint, getKernelFactory } from '@stablenet/contracts'
 */
export {
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from '@stablenet/contracts'

import type { Hex } from 'viem'

// ============================================================================
// EIP-7579 Execution Mode (bytes32)
// ============================================================================

/**
 * EIP-7579 Call Types (1 byte)
 * @see https://eips.ethereum.org/EIPS/eip-7579#execution-behavior
 */
export const CALL_TYPE = {
  /** Single call: abi.encodePacked(target, value, callData) */
  SINGLE: '0x00' as const,
  /** Batch call: abi.encode(Execution[]) */
  BATCH: '0x01' as const,
  /** Static call */
  STATIC: '0xfe' as const,
  /** Delegate call: abi.encodePacked(target, callData) */
  DELEGATE: '0xff' as const,
} as const

export type CallType = (typeof CALL_TYPE)[keyof typeof CALL_TYPE]

/**
 * EIP-7579 Execution Types (1 byte)
 * @see https://eips.ethereum.org/EIPS/eip-7579#execution-behavior
 */
export const EXEC_TYPE = {
  /** Revert on failure */
  DEFAULT: '0x00' as const,
  /** Try execution (no revert, handle error internally) */
  TRY: '0x01' as const,
} as const

export type ExecType = (typeof EXEC_TYPE)[keyof typeof EXEC_TYPE]

/**
 * @deprecated Use EXEC_TYPE instead. Kept for backward compatibility.
 */
export const EXEC_MODE = {
  DEFAULT: EXEC_TYPE.DEFAULT,
  TRY: EXEC_TYPE.TRY,
  DELEGATE: '0xff' as const,
} as const

/**
 * EIP-7579 Execution Mode (bytes32)
 *
 * Layout:
 * | callType (1B) | execType (1B) | unused (4B) | modeSelector (4B) | modePayload (22B) |
 *
 * @see https://eips.ethereum.org/EIPS/eip-7579#execution-behavior
 */
export interface ExecutionMode {
  /** Call type: single, batch, static, delegate */
  callType: CallType
  /** Execution type: default (revert) or try (no revert) */
  execType: ExecType
  /** Vendor/custom mode selector (4 bytes). 0x00000000 for standard modes */
  modeSelector: Hex
  /** Additional payload (22 bytes). e.g. hook address, flags */
  modePayload: Hex
}

/**
 * Encode ExecutionMode to bytes32 Hex
 *
 * @see https://eips.ethereum.org/EIPS/eip-7579#execution-behavior
 */
export function encodeExecutionMode(mode: ExecutionMode): Hex {
  const callType = mode.callType.slice(2).padStart(2, '0')
  const execType = mode.execType.slice(2).padStart(2, '0')
  const unused = '00000000'
  const selector = mode.modeSelector.slice(2).padStart(8, '0')
  const payload = mode.modePayload.slice(2).padStart(44, '0')
  return `0x${callType}${execType}${unused}${selector}${payload}` as Hex
}

/**
 * Decode bytes32 Hex to ExecutionMode
 *
 * @see https://eips.ethereum.org/EIPS/eip-7579#execution-behavior
 */
export function decodeExecutionMode(encoded: Hex): ExecutionMode {
  const hex = encoded.slice(2).padStart(64, '0')
  return {
    callType: `0x${hex.slice(0, 2)}` as CallType,
    execType: `0x${hex.slice(2, 4)}` as ExecType,
    modeSelector: `0x${hex.slice(12, 20)}` as Hex,
    modePayload: `0x${hex.slice(20, 64)}` as Hex,
  }
}
