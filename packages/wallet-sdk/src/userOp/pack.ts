/**
 * PackedUserOperation encoding/decoding
 *
 * Delegates to @stablenet/core for canonical EIP-4337 implementation.
 * Re-exports types from @stablenet/sdk-types for type unification.
 */

export { packUserOperation, unpackUserOperation } from '@stablenet/core'
export type { PackedUserOperation, UserOperation } from '@stablenet/sdk-types'
