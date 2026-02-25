import type { UserOperationRpc } from '../types'

/**
 * Estimate gas cost for a UserOperation
 */
export function estimateGasCost(userOp: UserOperationRpc): bigint {
  const totalGas =
    BigInt(userOp.callGasLimit) +
    BigInt(userOp.verificationGasLimit) +
    BigInt(userOp.preVerificationGas)

  return totalGas * BigInt(userOp.maxFeePerGas)
}
