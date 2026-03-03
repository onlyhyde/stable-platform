import type { UserOperationRpc } from '../types'

/**
 * Estimate gas cost for a UserOperation.
 * Includes paymasterVerificationGasLimit and paymasterPostOpGasLimit (v0.9).
 */
export function estimateGasCost(userOp: UserOperationRpc): bigint {
  const totalGas =
    BigInt(userOp.callGasLimit) +
    BigInt(userOp.verificationGasLimit) +
    BigInt(userOp.preVerificationGas) +
    BigInt(userOp.paymasterVerificationGasLimit ?? '0x0') +
    BigInt(userOp.paymasterPostOpGasLimit ?? '0x0')

  return totalGas * BigInt(userOp.maxFeePerGas)
}

/**
 * Calculate the 10% unused gas penalty (ERC-4337 v0.9).
 *
 * If (gasLimit - actualGasUsed) > 40,000, the penalty is
 * 10% of the unused portion. This applies separately to
 * callGasLimit and paymasterPostOpGasLimit.
 */
export function calculateUnusedGasPenalty(gasLimit: bigint, actualGasUsed: bigint): bigint {
  const unused = gasLimit - actualGasUsed
  if (unused <= 40_000n) return 0n
  return unused / 10n
}
