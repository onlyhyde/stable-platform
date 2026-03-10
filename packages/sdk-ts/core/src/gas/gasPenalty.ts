/**
 * EIP-4337 v0.9 Unused Gas Penalty
 *
 * Per spec §8.1: If unused callGasLimit or paymasterPostOpGasLimit exceeds
 * 40,000 gas, 10% of the unused amount is charged as penalty to prevent
 * bundler griefing. Applied individually to each gas limit.
 */

/** Threshold below which no penalty is applied (40,000 gas) */
export const UNUSED_GAS_PENALTY_THRESHOLD = 40_000n

/** Penalty divisor (10% = divide by 10) */
export const UNUSED_GAS_PENALTY_DIVISOR = 10n

/**
 * Calculate 10% penalty for a single gas limit.
 * Returns 0 if unused gas is below the 40,000 threshold.
 */
export function calculateUnusedGasPenalty(usedGas: bigint, gasLimit: bigint): bigint {
  if (gasLimit <= usedGas) return 0n
  const unused = gasLimit - usedGas
  if (unused <= UNUSED_GAS_PENALTY_THRESHOLD) return 0n
  return unused / UNUSED_GAS_PENALTY_DIVISOR
}

/**
 * Calculate total effective gas cost including v0.9 unused gas penalties.
 * Applies the penalty individually to callGasLimit and paymasterPostOpGasLimit.
 */
export function calculateEffectiveGasCost(
  actualGasCost: bigint,
  callGasUsed: bigint,
  callGasLimit: bigint,
  postOpGasUsed: bigint,
  postOpGasLimit: bigint
): { effectiveCost: bigint; callPenalty: bigint; postOpPenalty: bigint } {
  const callPenalty = calculateUnusedGasPenalty(callGasUsed, callGasLimit)
  const postOpPenalty = calculateUnusedGasPenalty(postOpGasUsed, postOpGasLimit)
  return {
    effectiveCost: actualGasCost + callPenalty + postOpPenalty,
    callPenalty,
    postOpPenalty,
  }
}
