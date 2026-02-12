import type { Call, Validator } from '@stablenet/sdk-types'
import { CALL_TYPE, EXEC_MODE, MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, encodeFunctionData, pad, toHex } from 'viem'
import { KernelAccountAbi } from './abi'

/**
 * Encode the execution mode for Kernel v3
 * Mode is a bytes32 with the following structure:
 * - byte 0: call type (0x00 = single, 0x01 = batch, 0xff = delegate)
 * - byte 1: exec mode (0x00 = default, 0x01 = try, 0xff = delegate)
 * - bytes 2-5: unused (0x00000000)
 * - bytes 6-9: selector (0x00000000 for default execution)
 * - bytes 10-31: context (22 bytes, usually 0x00...00)
 */
export function encodeExecutionMode(
  callType: typeof CALL_TYPE.SINGLE | typeof CALL_TYPE.BATCH | typeof CALL_TYPE.DELEGATE,
  execMode:
    | typeof EXEC_MODE.DEFAULT
    | typeof EXEC_MODE.TRY
    | typeof EXEC_MODE.DELEGATE = EXEC_MODE.DEFAULT
): Hex {
  // Construct mode bytes32
  const callTypeByte =
    callType === CALL_TYPE.SINGLE ? '00' : callType === CALL_TYPE.BATCH ? '01' : 'ff'
  const execModeByte =
    execMode === EXEC_MODE.DEFAULT ? '00' : execMode === EXEC_MODE.TRY ? '01' : 'ff'

  // bytes32: callType (1) + execMode (1) + unused (4) + selector (4) + context (22)
  return `0x${callTypeByte}${execModeByte}${'0'.repeat(60)}` as Hex
}

/**
 * Encode a single call for Kernel execution
 * Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
 */
export function encodeSingleCall(call: Call): Hex {
  return concat([
    call.to, // 20 bytes: target address
    pad(toHex(call.value ?? 0n), { size: 32 }), // 32 bytes: value
    (call.data ?? '0x') as Hex, // variable: callData
  ]) as Hex
}

/**
 * Encode batch calls for Kernel execution
 */
export function encodeBatchCalls(calls: Call[]): Hex {
  const encodedCalls = calls.map((call) => ({
    target: call.to,
    value: call.value ?? 0n,
    callData: call.data ?? '0x',
  }))

  return encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'target' },
          { type: 'uint256', name: 'value' },
          { type: 'bytes', name: 'callData' },
        ],
      },
    ],
    [encodedCalls]
  )
}

/**
 * Encode call data for Kernel execute function
 */
export function encodeKernelExecuteCallData(calls: Call | Call[]): Hex {
  const callArray = Array.isArray(calls) ? calls : [calls]

  if (callArray.length === 0) {
    throw new Error('At least one call is required')
  }

  const isSingle = callArray.length === 1
  const mode = encodeExecutionMode(isSingle ? CALL_TYPE.SINGLE : CALL_TYPE.BATCH)

  // TypeScript needs help understanding the array is non-empty
  const firstCall = callArray[0]!

  const executionCalldata = isSingle ? encodeSingleCall(firstCall) : encodeBatchCalls(callArray)

  return encodeFunctionData({
    abi: KernelAccountAbi,
    functionName: 'execute',
    args: [mode, executionCalldata],
  })
}

/**
 * Encode validator initialization data for Kernel
 * Root validator is encoded as bytes21: MODULE_TYPE (1 byte) + address (20 bytes)
 */
export function encodeRootValidator(validator: Validator): Hex {
  // MODULE_TYPE.VALIDATOR = 1n, so the first byte is 0x01
  const moduleTypeByte = pad(toHex(MODULE_TYPE.VALIDATOR), { size: 1 })
  return concat([moduleTypeByte, validator.address]) as Hex
}

/**
 * Encode the initialize function data for Kernel
 */
export function encodeKernelInitializeData(validator: Validator, validatorInitData: Hex): Hex {
  const rootValidator = encodeRootValidator(validator)
  const hookAddress = '0x0000000000000000000000000000000000000000' as Address // No hook
  const hookData = '0x' as Hex
  const initConfig: Hex[] = []

  return encodeFunctionData({
    abi: KernelAccountAbi,
    functionName: 'initialize',
    args: [rootValidator, hookAddress, validatorInitData, hookData, initConfig],
  })
}

/**
 * Calculate the salt for account creation
 */
export function calculateSalt(index: bigint): Hex {
  return pad(toHex(index), { size: 32 })
}
