/**
 * EntryPoint Simulation Module
 *
 * Provides simulateValidation and simulateHandleOp for pre-flight
 * UserOperation validation against the EntryPoint contract.
 *
 * Note: simulateValidation always reverts — success is indicated by a
 * ValidationResult revert, failure by FailedOp revert.
 */

import { ENTRY_POINT_ADDRESS } from '@stablenet/core'
import { packUserOperation } from '@stablenet/core'
import type { UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, type PublicClient } from 'viem'

// ============================================================================
// Types
// ============================================================================

/**
 * Stake info for an entity (account, factory, paymaster)
 */
export interface StakeInfo {
  stake: bigint
  unstakeDelaySec: bigint
}

/**
 * Validation return info from EntryPoint
 */
export interface ReturnInfo {
  preOpGas: bigint
  prefund: bigint
  accountValidationData: bigint
  paymasterValidationData: bigint
}

/**
 * Result of simulateValidation
 */
export interface SimulationResult {
  valid: boolean
  returnInfo: ReturnInfo
  senderInfo: StakeInfo
  factoryInfo?: StakeInfo
  paymasterInfo?: StakeInfo
  error?: string
}

/**
 * Result of simulateHandleOp
 */
export interface HandleOpSimulationResult {
  valid: boolean
  targetSuccess: boolean
  targetResult: Hex
  error?: string
}

// ============================================================================
// Simulation ABI fragments (not in standard EntryPoint ABI)
// ============================================================================

const PACKED_USER_OP_COMPONENTS = [
  { name: 'sender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'initCode', type: 'bytes' },
  { name: 'callData', type: 'bytes' },
  { name: 'accountGasLimits', type: 'bytes32' },
  { name: 'preVerificationGas', type: 'uint256' },
  { name: 'gasFees', type: 'bytes32' },
  { name: 'paymasterAndData', type: 'bytes' },
  { name: 'signature', type: 'bytes' },
] as const

const SIMULATE_VALIDATION_ABI = [
  {
    type: 'function',
    name: 'simulateValidation',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: PACKED_USER_OP_COMPONENTS,
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const SIMULATE_HANDLE_OP_ABI = [
  {
    type: 'function',
    name: 'simulateHandleOp',
    inputs: [
      {
        name: 'op',
        type: 'tuple',
        components: PACKED_USER_OP_COMPONENTS,
      },
      { name: 'target', type: 'address' },
      { name: 'targetCallData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// ============================================================================
// Error selectors
// ============================================================================

// ValidationResult(ReturnInfo, StakeInfo, StakeInfo, StakeInfo)
const VALIDATION_RESULT_SELECTOR = '0xe0cff05f'
// FailedOp(uint256 opIndex, string reason)
const FAILED_OP_SELECTOR = '0x220266b6'
// ExecutionResult(uint256 preOpGas, uint256 paid, bool targetSuccess, bytes targetResult)
const EXECUTION_RESULT_SELECTOR = '0x8b7ac980'

// ============================================================================
// Functions
// ============================================================================

/**
 * Simulate UserOperation validation against the EntryPoint.
 *
 * Always reverts — parses revert data to determine validation result.
 * - ValidationResult revert → validation succeeded
 * - FailedOp revert → validation failed with reason
 *
 * @param publicClient - Viem public client
 * @param userOp - UserOperation to validate
 * @param entryPoint - EntryPoint address (default: v0.7)
 */
export async function simulateValidation(
  publicClient: PublicClient,
  userOp: UserOperation,
  entryPoint: Address = ENTRY_POINT_ADDRESS
): Promise<SimulationResult> {
  const packed = packUserOperation(userOp)

  const callData = encodeFunctionData({
    abi: SIMULATE_VALIDATION_ABI,
    functionName: 'simulateValidation',
    args: [packed as never],
  })

  try {
    await publicClient.call({
      to: entryPoint,
      data: callData,
    })
    return { valid: false, returnInfo: emptyReturnInfo(), senderInfo: emptyStakeInfo(), error: 'Expected revert' }
  } catch (error: unknown) {
    const revertData = extractRevertData(error)
    if (!revertData) {
      return { valid: false, returnInfo: emptyReturnInfo(), senderInfo: emptyStakeInfo(), error: String(error) }
    }

    return parseSimulationRevert(revertData)
  }
}

/**
 * Simulate full UserOperation handling (validation + execution).
 *
 * @param publicClient - Viem public client
 * @param userOp - UserOperation to simulate
 * @param target - Target contract for post-execution call
 * @param targetCallData - Call data for target
 * @param entryPoint - EntryPoint address (default: v0.7)
 */
export async function simulateHandleOp(
  publicClient: PublicClient,
  userOp: UserOperation,
  target: Address,
  targetCallData: Hex,
  entryPoint: Address = ENTRY_POINT_ADDRESS
): Promise<HandleOpSimulationResult> {
  const packed = packUserOperation(userOp)

  const callData = encodeFunctionData({
    abi: SIMULATE_HANDLE_OP_ABI,
    functionName: 'simulateHandleOp',
    args: [packed as never, target, targetCallData],
  })

  try {
    await publicClient.call({
      to: entryPoint,
      data: callData,
    })
    return { valid: false, targetSuccess: false, targetResult: '0x', error: 'Expected revert' }
  } catch (error: unknown) {
    const revertData = extractRevertData(error)
    if (!revertData) {
      return { valid: false, targetSuccess: false, targetResult: '0x', error: String(error) }
    }

    return parseHandleOpRevert(revertData)
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseSimulationRevert(data: Hex): SimulationResult {
  const selector = data.slice(0, 10)

  if (selector === VALIDATION_RESULT_SELECTOR) {
    const decoded = decodeValidationResult(data)
    return { valid: true, ...decoded }
  }

  if (selector === FAILED_OP_SELECTOR) {
    const reason = decodeFailedOp(data)
    return { valid: false, returnInfo: emptyReturnInfo(), senderInfo: emptyStakeInfo(), error: reason }
  }

  return { valid: false, returnInfo: emptyReturnInfo(), senderInfo: emptyStakeInfo(), error: `Unknown revert selector: ${selector}` }
}

function parseHandleOpRevert(data: Hex): HandleOpSimulationResult {
  const selector = data.slice(0, 10)

  if (selector === EXECUTION_RESULT_SELECTOR) {
    try {
      const params = `0x${data.slice(10)}` as Hex
      const targetSuccess = BigInt(`0x${params.slice(130, 194)}`) !== 0n
      return { valid: true, targetSuccess, targetResult: '0x' }
    } catch {
      return { valid: true, targetSuccess: false, targetResult: '0x' }
    }
  }

  if (selector === FAILED_OP_SELECTOR) {
    const reason = decodeFailedOp(data)
    return { valid: false, targetSuccess: false, targetResult: '0x', error: reason }
  }

  return { valid: false, targetSuccess: false, targetResult: '0x', error: `Unknown revert selector: ${selector}` }
}

function decodeValidationResult(data: Hex): Omit<SimulationResult, 'valid'> {
  try {
    const params = data.slice(10)
    const preOpGas = BigInt(`0x${params.slice(0, 64)}`)
    const prefund = BigInt(`0x${params.slice(64, 128)}`)
    const accountValidationData = BigInt(`0x${params.slice(128, 192)}`)
    const paymasterValidationData = BigInt(`0x${params.slice(192, 256)}`)

    const senderStake = BigInt(`0x${params.slice(256, 320)}`)
    const senderUnstakeDelay = BigInt(`0x${params.slice(320, 384)}`)

    const factoryStake = BigInt(`0x${params.slice(384, 448)}`)
    const factoryUnstakeDelay = BigInt(`0x${params.slice(448, 512)}`)

    const paymasterStake = BigInt(`0x${params.slice(512, 576)}`)
    const paymasterUnstakeDelay = BigInt(`0x${params.slice(576, 640)}`)

    return {
      returnInfo: { preOpGas, prefund, accountValidationData, paymasterValidationData },
      senderInfo: { stake: senderStake, unstakeDelaySec: senderUnstakeDelay },
      factoryInfo: { stake: factoryStake, unstakeDelaySec: factoryUnstakeDelay },
      paymasterInfo: { stake: paymasterStake, unstakeDelaySec: paymasterUnstakeDelay },
    }
  } catch {
    return { returnInfo: emptyReturnInfo(), senderInfo: emptyStakeInfo() }
  }
}

function decodeFailedOp(data: Hex): string {
  try {
    // FailedOp(uint256 opIndex, string reason)
    const params = data.slice(10)
    const stringOffset = Number(BigInt(`0x${params.slice(64, 128)}`)) * 2
    const stringLength = Number(BigInt(`0x${params.slice(stringOffset, stringOffset + 64)}`))
    const reasonHex = params.slice(stringOffset + 64, stringOffset + 64 + stringLength * 2)
    // Decode hex to string without Buffer
    const bytes = []
    for (let i = 0; i < reasonHex.length; i += 2) {
      bytes.push(parseInt(reasonHex.slice(i, i + 2), 16))
    }
    return String.fromCharCode(...bytes)
  } catch {
    return 'Failed to decode error reason'
  }
}

function emptyReturnInfo(): ReturnInfo {
  return { preOpGas: 0n, prefund: 0n, accountValidationData: 0n, paymasterValidationData: 0n }
}

function emptyStakeInfo(): StakeInfo {
  return { stake: 0n, unstakeDelaySec: 0n }
}

function extractRevertData(error: unknown): Hex | undefined {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>
    if (typeof err.data === 'string' && err.data.startsWith('0x')) {
      return err.data as Hex
    }
    if (err.cause && typeof err.cause === 'object') {
      return extractRevertData(err.cause)
    }
  }
  return undefined
}
