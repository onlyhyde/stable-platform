/**
 * PackedUserOperation encoding/decoding
 *
 * EIP-4337 Section 3: Off-chain UserOperation ↔ Packed on-chain format conversion
 */

import type { Address, Hex } from 'viem'
import { concat, pad, sliceHex, hexToBigInt, toHex } from 'viem'

/**
 * Off-chain UserOperation (v0.7 unpacked format)
 */
export interface UserOperation {
  sender: Address
  nonce: bigint
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: Address
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: Hex
  signature: Hex
}

/**
 * On-chain PackedUserOperation (v0.7 packed format)
 */
export interface PackedUserOperation {
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
 * Pack a UserOperation into the on-chain PackedUserOperation format
 *
 * Packing rules (EIP-4337 Section 3):
 * - factory + factoryData → initCode (concatenated, or '0x' if no factory)
 * - verificationGasLimit(uint128) + callGasLimit(uint128) → accountGasLimits (bytes32)
 * - maxPriorityFeePerGas(uint128) + maxFeePerGas(uint128) → gasFees (bytes32)
 * - paymaster(address) + paymasterVerificationGasLimit(uint128) + paymasterPostOpGasLimit(uint128) + paymasterData → paymasterAndData
 */
export function packUserOperation(userOp: UserOperation): PackedUserOperation {
  // initCode = factory(20 bytes) || factoryData
  const initCode: Hex =
    userOp.factory && userOp.factoryData
      ? concat([userOp.factory, userOp.factoryData])
      : '0x'

  // accountGasLimits = verificationGasLimit(uint128) || callGasLimit(uint128)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  // gasFees = maxPriorityFeePerGas(uint128) || maxFeePerGas(uint128)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  // paymasterAndData = paymaster(20) || paymasterVerificationGasLimit(16) || paymasterPostOpGasLimit(16) || paymasterData
  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    paymasterAndData = concat([
      userOp.paymaster,
      pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
      pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
      userOp.paymasterData ?? '0x',
    ]) as Hex
  }

  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: userOp.preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  }
}

/**
 * Unpack a PackedUserOperation back to the off-chain UserOperation format
 */
export function unpackUserOperation(packed: PackedUserOperation): UserOperation {
  // Parse initCode → factory + factoryData
  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode !== '0x' && packed.initCode.length >= 42) {
    factory = sliceHex(packed.initCode, 0, 20) as Address
    factoryData = (packed.initCode.length > 42
      ? sliceHex(packed.initCode, 20)
      : '0x') as Hex
  }

  // Parse accountGasLimits → verificationGasLimit + callGasLimit
  const verificationGasLimit = hexToBigInt(sliceHex(packed.accountGasLimits, 0, 16))
  const callGasLimit = hexToBigInt(sliceHex(packed.accountGasLimits, 16, 32))

  // Parse gasFees → maxPriorityFeePerGas + maxFeePerGas
  const maxPriorityFeePerGas = hexToBigInt(sliceHex(packed.gasFees, 0, 16))
  const maxFeePerGas = hexToBigInt(sliceHex(packed.gasFees, 16, 32))

  // Parse paymasterAndData → paymaster + gas limits + data
  let paymaster: Address | undefined
  let paymasterVerificationGasLimit: bigint | undefined
  let paymasterPostOpGasLimit: bigint | undefined
  let paymasterData: Hex | undefined

  // paymasterAndData: paymaster(20) + verificationGasLimit(16) + postOpGasLimit(16) + data(variable)
  // Minimum length: 20 + 16 + 16 = 52 bytes = 104 hex chars + '0x' prefix = 106
  if (packed.paymasterAndData !== '0x' && packed.paymasterAndData.length >= 106) {
    paymaster = sliceHex(packed.paymasterAndData, 0, 20) as Address
    paymasterVerificationGasLimit = hexToBigInt(sliceHex(packed.paymasterAndData, 20, 36))
    paymasterPostOpGasLimit = hexToBigInt(sliceHex(packed.paymasterAndData, 36, 52))
    paymasterData = (packed.paymasterAndData.length > 106
      ? sliceHex(packed.paymasterAndData, 52)
      : '0x') as Hex
  }

  return {
    sender: packed.sender,
    nonce: packed.nonce,
    factory,
    factoryData,
    callData: packed.callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas: packed.preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    paymasterData,
    signature: packed.signature,
  }
}
