/**
 * UserOperation hash computation
 *
 * Delegates to @stablenet/core's getUserOperationHash for canonical implementation.
 * Maintains backward-compatible `computeUserOpHash` alias.
 */

import { getUserOperationHash } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import type { UserOperation } from './pack'

/**
 * Compute the userOpHash per EIP-4337 specification.
 *
 * Backward-compatible alias for `getUserOperationHash` from @stablenet/core.
 */
export function computeUserOpHash(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: bigint | number
): Hex {
  return getUserOperationHash(userOp, entryPoint, BigInt(chainId))
}

// Also re-export the canonical name
export { getUserOperationHash } from '@stablenet/core'
