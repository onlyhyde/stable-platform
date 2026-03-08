import type { Address, Hex } from 'viem'
import { concat, pad, toHex } from 'viem'
import type { UserOperation } from '../types'

/**
 * Packed UserOperation in the contract format expected by EntryPoint v0.7.
 * Fields like nonce and preVerificationGas are bigint (not Hex) because
 * the Solidity struct uses uint256 for these fields.
 */
export interface ContractPackedUserOp {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
}

/**
 * Pack a UserOperation into the contract-level packed format (EntryPoint v0.7).
 *
 * Used by:
 * - GasEstimator (simulation + byte-accurate gas calculation)
 * - BundleExecutor (handleOps / handleAggregatedOps encoding)
 */
export function packForContract(userOp: UserOperation): ContractPackedUserOp {
  // Build initCode
  const initCode =
    userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

  // Build accountGasLimits (verificationGasLimit || callGasLimit)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ])

  // Build gasFees (maxPriorityFeePerGas || maxFeePerGas)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ])

  // Build paymasterAndData
  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    paymasterAndData = concat([
      userOp.paymaster,
      pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
      pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
      userOp.paymasterData ?? '0x',
    ])
  }

  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode: initCode as Hex,
    callData: userOp.callData,
    accountGasLimits: accountGasLimits as Hex,
    preVerificationGas: userOp.preVerificationGas,
    gasFees: gasFees as Hex,
    paymasterAndData,
    signature: userOp.signature,
  }
}
