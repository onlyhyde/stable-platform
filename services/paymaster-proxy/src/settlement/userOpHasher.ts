import type { Address, Hex } from 'viem'
import { getUserOperationHash } from '@stablenet/core'
import type { UserOperationRpc, PackedUserOperationRpc } from '../types'

/**
 * Compute the standard ERC-4337 userOpHash for a UserOperation
 * that has been finalized with paymaster data.
 *
 * Converts RPC hex format → bigint format and delegates to
 * `@stablenet/core`'s `getUserOperationHash()`.
 */
export function computeUserOpHash(
  userOp: UserOperationRpc | PackedUserOperationRpc,
  paymasterAndData: { paymaster: Address; paymasterData: Hex },
  entryPoint: Address,
  chainId: bigint
): Hex {
  const coreUserOp = toUserOperation(userOp, paymasterAndData)
  return getUserOperationHash(coreUserOp, entryPoint, chainId)
}

/**
 * Convert RPC-format UserOperation + finalized paymaster data
 * to the `UserOperation` (bigint) format expected by @stablenet/core.
 */
function toUserOperation(
  userOp: UserOperationRpc | PackedUserOperationRpc,
  paymasterAndData: { paymaster: Address; paymasterData: Hex }
) {
  if ('callGasLimit' in userOp) {
    // Unpacked v0.7 format
    return {
      sender: userOp.sender,
      nonce: BigInt(userOp.nonce),
      factory: userOp.factory,
      factoryData: userOp.factoryData,
      callData: userOp.callData,
      callGasLimit: BigInt(userOp.callGasLimit),
      verificationGasLimit: BigInt(userOp.verificationGasLimit),
      preVerificationGas: BigInt(userOp.preVerificationGas),
      maxFeePerGas: BigInt(userOp.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
      paymaster: paymasterAndData.paymaster,
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
        ? BigInt(userOp.paymasterVerificationGasLimit)
        : 0n,
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
        ? BigInt(userOp.paymasterPostOpGasLimit)
        : 0n,
      paymasterData: paymasterAndData.paymasterData,
      signature: userOp.signature,
    }
  }

  // Packed format — unpack gas fields
  const packed = userOp as PackedUserOperationRpc
  const accountGasLimitsHex = packed.accountGasLimits.slice(2)
  const verificationGasLimit = BigInt(`0x${accountGasLimitsHex.slice(0, 32)}`)
  const callGasLimit = BigInt(`0x${accountGasLimitsHex.slice(32, 64)}`)

  const gasFeesHex = packed.gasFees.slice(2)
  const maxPriorityFeePerGas = BigInt(`0x${gasFeesHex.slice(0, 32)}`)
  const maxFeePerGas = BigInt(`0x${gasFeesHex.slice(32, 64)}`)

  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode && packed.initCode !== '0x' && packed.initCode.length > 2) {
    factory = `0x${packed.initCode.slice(2, 42)}` as Address
    factoryData = `0x${packed.initCode.slice(42)}` as Hex
  }

  return {
    sender: packed.sender,
    nonce: BigInt(packed.nonce),
    factory,
    factoryData,
    callData: packed.callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas: BigInt(packed.preVerificationGas),
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster: paymasterAndData.paymaster,
    paymasterVerificationGasLimit: 0n,
    paymasterPostOpGasLimit: 0n,
    paymasterData: paymasterAndData.paymasterData,
    signature: packed.signature,
  }
}
