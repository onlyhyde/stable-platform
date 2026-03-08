/**
 * Re-exported from @stablenet/types (which sources from @stablenet/contracts)
 *
 * Canonical addresses are the same on all production EVM chains.
 * For chain-specific addresses, use getEntryPoint(chainId) etc. from @stablenet/contracts.
 */
export {
  CALL_TYPE,
  type CallType,
  decodeExecutionMode,
  ECDSA_VALIDATOR_ADDRESS,
  encodeExecutionMode,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  EXEC_MODE,
  EXEC_TYPE,
  type ExecType,
  type ExecutionMode,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from '@stablenet/types'

/**
 * Module type IDs (ERC-7579)
 * Note: Not in @stablenet/types because these are SDK-specific bigint constants
 */
export const MODULE_TYPE = {
  VALIDATOR: 1n,
  EXECUTOR: 2n,
  FALLBACK: 3n,
  HOOK: 4n,
} as const
