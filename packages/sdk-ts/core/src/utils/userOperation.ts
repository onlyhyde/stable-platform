import type { PackedUserOperation, UserOperation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, pad, stringToHex, toHex } from 'viem'

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

// Import keccak256 from viem
import { keccak256 } from 'viem'

// ============================================================================
// EIP-712 / ERC-4337 v0.9 Hash Constants
// ============================================================================

const PACKED_USEROP_TYPEHASH = keccak256(
  stringToHex(
    'PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)'
  )
)

const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToHex(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
  )
)

const EIP712_DOMAIN_NAME_HASH = keccak256(stringToHex('ERC4337'))
const EIP712_DOMAIN_VERSION_HASH = keccak256(stringToHex('1'))

/**
 * Compute the EIP-712 domain separator for the EntryPoint v0.9.
 * domain = { name: "ERC4337", version: "1", chainId, verifyingContract: entryPoint }
 */
export function computeDomainSeparator(entryPoint: Address, chainId: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        EIP712_DOMAIN_NAME_HASH,
        EIP712_DOMAIN_VERSION_HASH,
        chainId,
        entryPoint,
      ]
    )
  )
}

/**
 * Calculate the hash of a UserOperation using EIP-712 (EntryPoint v0.9).
 *
 * This matches the EntryPoint v0.9 contract's getUserOpHash():
 *   MessageHashUtils.toTypedDataHash(domainSeparatorV4, userOp.hash())
 *
 * Where userOp.hash() = keccak256(abi.encode(PACKED_USEROP_TYPEHASH, fields...))
 * and toTypedDataHash = keccak256("\x19\x01" + domainSeparator + structHash)
 */
export function getUserOperationHash(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: bigint
): Hex {
  const packed = packUserOperation(userOp)

  // Struct hash: keccak256(abi.encode(TYPEHASH, sender, nonce, hash(initCode), ...))
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, // PACKED_USEROP_TYPEHASH
        { type: 'address' }, // sender
        { type: 'uint256' }, // nonce
        { type: 'bytes32' }, // keccak256(initCode)
        { type: 'bytes32' }, // keccak256(callData)
        { type: 'bytes32' }, // accountGasLimits
        { type: 'uint256' }, // preVerificationGas
        { type: 'bytes32' }, // gasFees
        { type: 'bytes32' }, // keccak256(paymasterAndData)
      ],
      [
        PACKED_USEROP_TYPEHASH,
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
  )

  const domainSeparator = computeDomainSeparator(entryPoint, chainId)

  // EIP-712: keccak256("\x19\x01" + domainSeparator + structHash)
  return keccak256(concat(['0x1901' as Hex, domainSeparator, structHash]))
}

/**
 * Build an EIP-712 TypedData object for a UserOperation.
 *
 * The returned object can be passed directly to viem's `signTypedData`,
 * producing a signature over the raw EIP-712 hash (no EIP-191 prefix).
 * The on-chain ECDSAValidator accepts both raw EIP-712 and EIP-191 wrapped
 * signatures via its dual-recovery pattern.
 *
 * hashTypedData(buildUserOpTypedData(...)) === getUserOperationHash(...)
 */
export function buildUserOpTypedData(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: bigint
): {
  domain: { name: string; version: string; chainId: bigint; verifyingContract: Address }
  types: { PackedUserOperation: Array<{ name: string; type: string }> }
  primaryType: 'PackedUserOperation'
  message: Record<string, unknown>
} {
  const packed = packUserOperation(userOp)
  return {
    types: {
      PackedUserOperation: [
        { name: 'sender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' },
        { name: 'callData', type: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32' },
        { name: 'preVerificationGas', type: 'uint256' },
        { name: 'gasFees', type: 'bytes32' },
        { name: 'paymasterAndData', type: 'bytes' },
      ],
    },
    primaryType: 'PackedUserOperation' as const,
    domain: {
      name: 'ERC4337',
      version: '1',
      chainId,
      verifyingContract: entryPoint,
    },
    message: {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: packed.initCode,
      callData: packed.callData,
      accountGasLimits: packed.accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees: packed.gasFees,
      paymasterAndData: packed.paymasterAndData,
    },
  }
}

/**
 * Wrap a raw ECDSA signature for Kernel v3 ECDSA validator.
 * Kernel v3 expects: 0x02 prefix + raw ECDSA signature (65 bytes)
 */
export function signUserOpForKernel(rawSignature: Hex): Hex {
  return concat(['0x02', rawSignature]) as Hex
}
