/**
 * UserOperation hash computation
 *
 * EIP-4337 Section 4: userOpHash = keccak256(abi.encode(
 *   keccak256(pack(userOp)), entryPoint, chainId
 * ))
 *
 * The inner hash uses the packed UserOperation without the signature field,
 * following the EIP-712-style hashing from the EntryPoint contract.
 */

import type { Address, Hex } from 'viem'
import { encodeAbiParameters, keccak256 } from 'viem'
import type { UserOperation } from './pack'
import { packUserOperation } from './pack'

/**
 * Compute the userOpHash per EIP-4337 specification.
 *
 * userOpHash = keccak256(abi.encode(
 *   keccak256(packedUserOpWithoutSignature),
 *   entryPoint,
 *   chainId
 * ))
 *
 * This matches the EntryPoint's getUserOpHash() implementation.
 */
export function computeUserOpHash(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: bigint | number
): Hex {
  const packed = packUserOperation(userOp)

  // Encode the packed UserOp fields (excluding signature) for the inner hash
  const encodedUserOp = encodeAbiParameters(
    [
      { type: 'address' },  // sender
      { type: 'uint256' },  // nonce
      { type: 'bytes32' },  // keccak256(initCode)
      { type: 'bytes32' },  // keccak256(callData)
      { type: 'bytes32' },  // accountGasLimits
      { type: 'uint256' },  // preVerificationGas
      { type: 'bytes32' },  // gasFees
      { type: 'bytes32' },  // keccak256(paymasterAndData)
    ],
    [
      packed.sender,
      packed.nonce,
      keccak256(packed.initCode),
      keccak256(packed.callData),
      packed.accountGasLimits as Hex,
      packed.preVerificationGas,
      packed.gasFees as Hex,
      keccak256(packed.paymasterAndData),
    ]
  )

  const userOpPackHash = keccak256(encodedUserOp)

  // Final hash: keccak256(abi.encode(userOpPackHash, entryPoint, chainId))
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
      ],
      [
        userOpPackHash,
        entryPoint,
        BigInt(chainId),
      ]
    )
  )
}
