import { getUserOperationHash, unpackUserOperation } from '@stablenet/core'
import type { UserOperation } from '@stablenet/types'
import type { Address, Hex } from 'viem'
import type { PackedUserOperationRpc, UserOperationRpc } from '../types'

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
 *
 * For packed format, delegates to `unpackUserOperation` from SDK.
 */
function toUserOperation(
  userOp: UserOperationRpc | PackedUserOperationRpc,
  paymasterAndData: { paymaster: Address; paymasterData: Hex }
): UserOperation {
  if ('callGasLimit' in userOp) {
    // Unpacked v0.7 format — direct bigint conversion
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

  // Packed format — delegate unpacking to SDK, then overlay paymaster data
  const unpacked = unpackUserOperation(userOp as unknown as Record<string, Hex>)
  return {
    ...unpacked,
    paymaster: paymasterAndData.paymaster,
    paymasterVerificationGasLimit: 0n,
    paymasterPostOpGasLimit: 0n,
    paymasterData: paymasterAndData.paymasterData,
  }
}
