import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, keccak256, pad, toHex } from 'viem'
import type { UserOperation } from '../types'

/**
 * Unpack a UserOperation from RPC format (v0.7)
 */
export function unpackUserOperation(packed: Record<string, Hex>): UserOperation {
  // Parse initCode (factory + factoryData)
  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode && packed.initCode !== '0x' && packed.initCode.length > 42) {
    factory = `0x${packed.initCode.slice(2, 42)}` as Address
    factoryData = `0x${packed.initCode.slice(42)}` as Hex
  } else if (packed.factory && packed.factory !== '0x') {
    factory = packed.factory as Address
    factoryData = packed.factoryData
  }

  // Parse accountGasLimits
  let verificationGasLimit = 0n
  let callGasLimit = 0n
  if (packed.accountGasLimits && packed.accountGasLimits !== '0x') {
    const limits = packed.accountGasLimits
    if (limits.length >= 34) {
      verificationGasLimit = BigInt(`0x${limits.slice(2, 34)}`)
    }
    if (limits.length >= 66) {
      callGasLimit = BigInt(`0x${limits.slice(34, 66)}`)
    }
  } else {
    verificationGasLimit = packed.verificationGasLimit
      ? BigInt(packed.verificationGasLimit)
      : 0n
    callGasLimit = packed.callGasLimit ? BigInt(packed.callGasLimit) : 0n
  }

  // Parse gasFees
  let maxPriorityFeePerGas = 0n
  let maxFeePerGas = 0n
  if (packed.gasFees && packed.gasFees !== '0x') {
    const fees = packed.gasFees
    if (fees.length >= 34) {
      maxPriorityFeePerGas = BigInt(`0x${fees.slice(2, 34)}`)
    }
    if (fees.length >= 66) {
      maxFeePerGas = BigInt(`0x${fees.slice(34, 66)}`)
    }
  } else {
    maxPriorityFeePerGas = packed.maxPriorityFeePerGas
      ? BigInt(packed.maxPriorityFeePerGas)
      : 0n
    maxFeePerGas = packed.maxFeePerGas ? BigInt(packed.maxFeePerGas) : 0n
  }

  // Parse paymasterAndData
  let paymaster: Address | undefined
  let paymasterVerificationGasLimit: bigint | undefined
  let paymasterPostOpGasLimit: bigint | undefined
  let paymasterData: Hex | undefined

  if (packed.paymasterAndData && packed.paymasterAndData !== '0x' && packed.paymasterAndData.length > 42) {
    paymaster = `0x${packed.paymasterAndData.slice(2, 42)}` as Address
    if (packed.paymasterAndData.length >= 106) {
      paymasterVerificationGasLimit = BigInt(
        `0x${packed.paymasterAndData.slice(42, 74)}`
      )
      paymasterPostOpGasLimit = BigInt(
        `0x${packed.paymasterAndData.slice(74, 106)}`
      )
      if (packed.paymasterAndData.length > 106) {
        paymasterData = `0x${packed.paymasterAndData.slice(106)}` as Hex
      }
    }
  } else if (packed.paymaster && packed.paymaster !== '0x') {
    paymaster = packed.paymaster as Address
    paymasterVerificationGasLimit = packed.paymasterVerificationGasLimit
      ? BigInt(packed.paymasterVerificationGasLimit)
      : undefined
    paymasterPostOpGasLimit = packed.paymasterPostOpGasLimit
      ? BigInt(packed.paymasterPostOpGasLimit)
      : undefined
    paymasterData = packed.paymasterData
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
 * Pack a UserOperation for bundler format (v0.7)
 */
export function packUserOperation(userOp: UserOperation): {
  sender: Address
  nonce: Hex
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: Hex
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
} {
  // Build initCode
  const initCode =
    userOp.factory && userOp.factoryData
      ? concat([userOp.factory, userOp.factoryData])
      : '0x'

  // Build accountGasLimits
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  // Build gasFees
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  // Build paymasterAndData
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
