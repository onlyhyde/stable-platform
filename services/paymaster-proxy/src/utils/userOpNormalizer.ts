import type { Address, Hex } from 'viem'
import { concatHex, numberToHex } from 'viem'
import type { PackedUserOperationRpc, UserOperationRpc } from '../types'

/**
 * Normalize UserOperation to unpacked format for policy checking
 */
export function normalizeUserOp(userOp: UserOperationRpc | PackedUserOperationRpc): UserOperationRpc {
  if ('callGasLimit' in userOp) {
    return userOp
  }

  const packed = userOp as PackedUserOperationRpc

  // Extract gas limits from accountGasLimits (bytes32: verificationGasLimit | callGasLimit)
  const accountGasLimitsHex = packed.accountGasLimits.slice(2)
  const verificationGasLimit = `0x${accountGasLimitsHex.slice(0, 32)}`
  const callGasLimit = `0x${accountGasLimitsHex.slice(32, 64)}`

  // Extract gas fees (bytes32: maxPriorityFeePerGas | maxFeePerGas)
  const gasFeesHex = packed.gasFees.slice(2)
  const maxPriorityFeePerGas = `0x${gasFeesHex.slice(0, 32)}`
  const maxFeePerGas = `0x${gasFeesHex.slice(32, 64)}`

  // Extract factory from initCode
  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode && packed.initCode !== '0x' && packed.initCode.length > 2) {
    factory = `0x${packed.initCode.slice(2, 42)}` as Address
    factoryData = `0x${packed.initCode.slice(42)}` as Hex
  }

  return {
    sender: packed.sender,
    nonce: packed.nonce,
    factory,
    factoryData,
    callData: packed.callData,
    callGasLimit: callGasLimit as Hex,
    verificationGasLimit: verificationGasLimit as Hex,
    preVerificationGas: packed.preVerificationGas,
    maxFeePerGas: maxFeePerGas as Hex,
    maxPriorityFeePerGas: maxPriorityFeePerGas as Hex,
    signature: packed.signature,
  }
}

/**
 * Convert UserOperationRpc or PackedUserOperationRpc to the packed format
 * expected by computeUserOpCoreHash from @stablenet/core
 */
export function toPackedForCoreHash(userOp: UserOperationRpc | PackedUserOperationRpc): {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
} {
  if ('accountGasLimits' in userOp) {
    // Already packed format
    return {
      sender: userOp.sender,
      nonce: BigInt(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: BigInt(userOp.preVerificationGas),
      gasFees: userOp.gasFees,
    }
  }

  // Unpacked format - convert to packed
  const initCode =
    userOp.factory && userOp.factoryData
      ? concatHex([userOp.factory, userOp.factoryData])
      : ('0x' as Hex)

  // Pack accountGasLimits: verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
  const accountGasLimits = concatHex([
    numberToHex(BigInt(userOp.verificationGasLimit), { size: 16 }),
    numberToHex(BigInt(userOp.callGasLimit), { size: 16 }),
  ])

  // Pack gasFees: maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
  const gasFees = concatHex([
    numberToHex(BigInt(userOp.maxPriorityFeePerGas), { size: 16 }),
    numberToHex(BigInt(userOp.maxFeePerGas), { size: 16 }),
  ])

  return {
    sender: userOp.sender,
    nonce: BigInt(userOp.nonce),
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: BigInt(userOp.preVerificationGas),
    gasFees,
  }
}
