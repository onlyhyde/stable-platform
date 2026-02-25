import type { Hex, Address } from 'viem'
import { keccak256, encodeAbiParameters, parseAbiParameters, stringToHex } from 'viem'

// ============ Domain Constants ============

export const PAYMASTER_DOMAIN_NAME = 'StableNetPaymaster'
export const PAYMASTER_DOMAIN_VERSION = '1'

const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToHex(
    'EIP712Domain(string name,string version,uint256 chainId,address entryPoint,address paymaster)'
  )
)

// ============ Domain Separator ============

/**
 * Compute the EIP-712-like domain separator for paymaster hashing
 * Matches BasePaymaster._computeDomainSeparator() in Solidity
 */
export function computePaymasterDomainSeparator(
  chainId: bigint,
  entryPoint: Address,
  paymasterAddress: Address
): Hex {
  const nameHash = keccak256(stringToHex(PAYMASTER_DOMAIN_NAME))
  const versionHash = keccak256(stringToHex(PAYMASTER_DOMAIN_VERSION))

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, bytes32, uint256, address, address'),
      [EIP712_DOMAIN_TYPEHASH, nameHash, versionHash, chainId, entryPoint, paymasterAddress]
    )
  )
}

// ============ UserOp Core Hash ============

/**
 * Compute a deterministic hash of UserOp core fields (excluding paymaster data)
 * Matches BasePaymaster._computeUserOpCoreHash() in Solidity
 *
 * Note: userOp must be a packed user operation with the following fields:
 * sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees
 */
export function computeUserOpCoreHash(userOp: {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
}): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256, bytes32, bytes32, bytes32, uint256, bytes32'),
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
      ]
    )
  )
}

// ============ Paymaster Hash ============

/**
 * Compute the hash to be signed by the paymaster signer
 * Matches PaymasterDataLib.hashForSignature() in Solidity:
 *   keccak256(abi.encode(domainSeparator, userOpCoreHash, keccak256(envelope)))
 */
export function computePaymasterHash(
  domainSeparator: Hex,
  userOpCoreHash: Hex,
  envelopeWithoutSignature: Hex
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, bytes32'),
      [domainSeparator, userOpCoreHash, keccak256(envelopeWithoutSignature)]
    )
  )
}
