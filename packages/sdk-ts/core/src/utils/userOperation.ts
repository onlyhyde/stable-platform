import type { PackedUserOperation, UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, pad, toHex } from 'viem'

/**
 * Pack a UserOperation into the format expected by the bundler RPC
 */
export function packUserOperation(userOp: UserOperation): PackedUserOperation {
  // Build initCode: factory + factoryData
  const initCode =
    userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

  // Build accountGasLimits: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  // Build gasFees: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  // Build paymasterAndData
  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    const paymasterVerificationGasLimit = userOp.paymasterVerificationGasLimit ?? 0n
    const paymasterPostOpGasLimit = userOp.paymasterPostOpGasLimit ?? 0n
    const paymasterData = userOp.paymasterData ?? '0x'

    paymasterAndData = concat([
      userOp.paymaster,
      pad(toHex(paymasterVerificationGasLimit), { size: 16 }),
      pad(toHex(paymasterPostOpGasLimit), { size: 16 }),
      paymasterData,
    ]) as Hex
  }

  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: toHex(userOp.preVerificationGas),
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  }
}

/**
 * Unpack a PackedUserOperation from bundler RPC response
 */
export function unpackUserOperation(packed: Record<string, Hex>): UserOperation {
  // Parse initCode
  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode && packed.initCode !== '0x' && packed.initCode.length > 42) {
    factory = `0x${packed.initCode.slice(2, 42)}` as Address
    factoryData = `0x${packed.initCode.slice(42)}` as Hex
  }

  // Parse accountGasLimits
  const accountGasLimits = packed.accountGasLimits || '0x'
  const verificationGasLimit =
    accountGasLimits.length >= 34 ? BigInt(`0x${accountGasLimits.slice(2, 34)}`) : 0n
  const callGasLimit =
    accountGasLimits.length >= 66 ? BigInt(`0x${accountGasLimits.slice(34, 66)}`) : 0n

  // Parse gasFees
  const gasFees = packed.gasFees || '0x'
  const maxPriorityFeePerGas = gasFees.length >= 34 ? BigInt(`0x${gasFees.slice(2, 34)}`) : 0n
  const maxFeePerGas = gasFees.length >= 66 ? BigInt(`0x${gasFees.slice(34, 66)}`) : 0n

  // Parse paymasterAndData
  let paymaster: Address | undefined
  let paymasterVerificationGasLimit: bigint | undefined
  let paymasterPostOpGasLimit: bigint | undefined
  let paymasterData: Hex | undefined

  if (
    packed.paymasterAndData &&
    packed.paymasterAndData !== '0x' &&
    packed.paymasterAndData.length > 42
  ) {
    paymaster = `0x${packed.paymasterAndData.slice(2, 42)}` as Address
    if (packed.paymasterAndData.length >= 106) {
      paymasterVerificationGasLimit = BigInt(`0x${packed.paymasterAndData.slice(42, 74)}`)
      paymasterPostOpGasLimit = BigInt(`0x${packed.paymasterAndData.slice(74, 106)}`)
      if (packed.paymasterAndData.length > 106) {
        paymasterData = `0x${packed.paymasterAndData.slice(106)}` as Hex
      }
    }
  }

  return {
    sender: packed.sender as Address,
    nonce: BigInt(packed.nonce || '0x0'),
    factory,
    factoryData,
    callData: packed.callData as Hex,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas: BigInt(packed.preVerificationGas || '0x0'),
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    paymasterData,
    signature: packed.signature as Hex,
  }
}

/**
 * Calculate the hash of a UserOperation
 */
export function getUserOperationHash(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: bigint
): Hex {
  const packed = packUserOperation(userOp)

  // Hash the packed user operation (excluding signature)
  const userOpEncoded = encodeAbiParameters(
    [
      { type: 'address' }, // sender
      { type: 'uint256' }, // nonce
      { type: 'bytes32' }, // hashInitCode
      { type: 'bytes32' }, // hashCallData
      { type: 'bytes32' }, // accountGasLimits
      { type: 'uint256' }, // preVerificationGas
      { type: 'bytes32' }, // gasFees
      { type: 'bytes32' }, // hashPaymasterAndData
    ],
    [
      userOp.sender,
      userOp.nonce,
      keccak256(packed.initCode),
      keccak256(packed.callData),
      packed.accountGasLimits as `0x${string}`,
      userOp.preVerificationGas,
      packed.gasFees as `0x${string}`,
      keccak256(packed.paymasterAndData),
    ]
  )

  const userOpHash = keccak256(userOpEncoded)

  // Final hash includes entryPoint and chainId
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [userOpHash, entryPoint, chainId]
    )
  )
}

// Import keccak256 from viem
import { keccak256 } from 'viem'
