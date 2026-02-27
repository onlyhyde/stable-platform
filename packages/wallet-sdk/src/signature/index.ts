/**
 * ERC-1271 Contract Signature Verification
 *
 * Supports both EOA (ecrecover) and smart contract account (ERC-1271)
 * signature verification with automatic detection.
 */

import type { Address, Hex } from 'viem'
import { recoverAddress, type PublicClient } from 'viem'

/** ERC-1271 magic value: bytes4(keccak256("isValidSignature(bytes32,bytes)")) */
const ERC1271_MAGIC_VALUE = '0x1626ba7e' as const

/** ERC-1271 isValidSignature ABI */
const ERC1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
    stateMutability: 'view',
  },
] as const

/**
 * Result of signature verification
 */
export interface SignatureVerificationResult {
  isValid: boolean
  signerType: 'eoa' | 'contract'
  recoveredAddress?: Address // EOA only
}

/**
 * Check if an address is a smart contract account.
 *
 * @param publicClient - Viem public client
 * @param address - Address to check
 * @returns true if the address has deployed code
 */
export async function isSmartContractAccount(
  publicClient: PublicClient,
  address: Address
): Promise<boolean> {
  const code = await publicClient.getCode({ address })
  return code !== undefined && code !== '0x'
}

/**
 * Verify a signature using ERC-1271 (on-chain contract signature verification).
 *
 * Calls `isValidSignature(bytes32, bytes)` on the contract and checks
 * if the return value matches the ERC-1271 magic value (0x1626ba7e).
 *
 * @param publicClient - Viem public client
 * @param account - Smart contract account address
 * @param hash - Message hash (bytes32)
 * @param signature - Signature bytes
 */
export async function isValidSignature(
  publicClient: PublicClient,
  account: Address,
  hash: Hex,
  signature: Hex
): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: account,
      abi: ERC1271_ABI,
      functionName: 'isValidSignature',
      args: [hash, signature],
    })
    return result === ERC1271_MAGIC_VALUE
  } catch {
    return false
  }
}

/**
 * Unified signature verification for both EOA and smart contract accounts.
 *
 * Automatically detects account type:
 * - EOA: Uses ecrecover (viem's recoverAddress)
 * - Smart Contract: Uses ERC-1271 isValidSignature
 *
 * @param publicClient - Viem public client
 * @param account - Account address to verify against
 * @param hash - Message hash (bytes32)
 * @param signature - Signature bytes
 */
export async function verifySignature(
  publicClient: PublicClient,
  account: Address,
  hash: Hex,
  signature: Hex
): Promise<SignatureVerificationResult> {
  const isContract = await isSmartContractAccount(publicClient, account)

  if (isContract) {
    const valid = await isValidSignature(publicClient, account, hash, signature)
    return {
      isValid: valid,
      signerType: 'contract',
    }
  }

  // EOA verification via ecrecover
  try {
    const recovered = await recoverAddress({ hash, signature })
    const isValid = recovered.toLowerCase() === account.toLowerCase()
    return {
      isValid,
      signerType: 'eoa',
      recoveredAddress: recovered,
    }
  } catch {
    return {
      isValid: false,
      signerType: 'eoa',
    }
  }
}
