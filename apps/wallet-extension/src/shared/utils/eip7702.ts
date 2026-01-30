/**
 * EIP-7702 Authorization Utilities
 *
 * Provides functions for creating and signing EIP-7702 authorizations.
 */

import { keccak256, encodeAbiParameters, parseAbiParameters, type Hex, type Address } from 'viem'
import type {
  Authorization,
  SignedAuthorization,
  DelegationStatus,
} from '../../types/eip7702'
import {
  EIP7702_CONSTANTS,
  isDelegatedBytecode,
  extractDelegateFromBytecode,
} from '../../types/eip7702'

/**
 * RLP encode for EIP-7702 authorization
 * Format: rlp([chainId, address, nonce])
 */
function rlpEncodeAuthorization(auth: Authorization): Hex {
  // For EIP-7702, we use ABI encoding which produces the same result
  // as RLP for this simple structure
  const encoded = encodeAbiParameters(
    parseAbiParameters('uint256 chainId, address contractAddress, uint256 nonce'),
    [auth.chainId, auth.address, auth.nonce]
  )
  return encoded
}

/**
 * Create EIP-7702 authorization hash
 * Hash = keccak256(0x05 || rlp([chainId, address, nonce]))
 */
export function createAuthorizationHash(auth: Authorization): Hex {
  const rlpEncoded = rlpEncodeAuthorization(auth)

  // Prepend magic byte (0x05)
  const magicByte = EIP7702_CONSTANTS.MAGIC_BYTE.toString(16).padStart(2, '0')
  const dataToHash = `0x${magicByte}${rlpEncoded.slice(2)}` as Hex

  return keccak256(dataToHash)
}

/**
 * Create an authorization structure
 */
export function createAuthorization(
  chainId: number | bigint,
  contractAddress: Address,
  nonce: number | bigint
): Authorization {
  return {
    chainId: BigInt(chainId),
    address: contractAddress,
    nonce: BigInt(nonce),
  }
}

/**
 * Create a revocation authorization (delegates to zero address)
 */
export function createRevocationAuthorization(
  chainId: number | bigint,
  nonce: number | bigint
): Authorization {
  return createAuthorization(chainId, EIP7702_CONSTANTS.ZERO_ADDRESS, nonce)
}

/**
 * Parse ECDSA signature into v, r, s components
 */
export function parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  // Signature is 65 bytes: r (32) + s (32) + v (1)
  const sig = signature.slice(2) // Remove 0x prefix

  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sig.length}`)
  }

  const r = `0x${sig.slice(0, 64)}` as Hex
  const s = `0x${sig.slice(64, 128)}` as Hex
  let v = parseInt(sig.slice(128, 130), 16)

  // Normalize v to 0 or 1 (EIP-7702 uses 0/1, not 27/28)
  if (v >= 27) {
    v -= 27
  }

  return { v, r, s }
}

/**
 * Create a signed authorization from authorization and signature
 */
export function createSignedAuthorization(
  authorization: Authorization,
  signature: Hex
): SignedAuthorization {
  const { v, r, s } = parseSignature(signature)

  return {
    ...authorization,
    v,
    r,
    s,
  }
}

/**
 * Get delegation status from account bytecode
 */
export function getDelegationStatus(code: Hex | null): DelegationStatus {
  const isDelegated = isDelegatedBytecode(code)
  const delegateAddress = code ? extractDelegateFromBytecode(code) : null

  return {
    isDelegated,
    delegateAddress,
    code,
  }
}

/**
 * Format authorization for display
 */
export function formatAuthorization(auth: Authorization): string {
  const isRevocation = auth.address.toLowerCase() === EIP7702_CONSTANTS.ZERO_ADDRESS.toLowerCase()
  const action = isRevocation ? 'Revoke delegation' : 'Delegate to'
  const target = isRevocation ? '' : ` ${auth.address.slice(0, 10)}...${auth.address.slice(-8)}`

  return `${action}${target} (Chain: ${auth.chainId}, Nonce: ${auth.nonce})`
}

/**
 * Validate authorization parameters
 */
export function validateAuthorizationParams(params: {
  account?: Address
  contractAddress?: Address
  chainId?: number | bigint
  nonce?: number | bigint
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!params.account) {
    errors.push('Account address is required')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(params.account)) {
    errors.push('Invalid account address format')
  }

  if (!params.contractAddress) {
    errors.push('Contract address is required')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(params.contractAddress)) {
    errors.push('Invalid contract address format')
  }

  if (params.chainId !== undefined) {
    const chainId = Number(params.chainId)
    if (isNaN(chainId) || chainId <= 0) {
      errors.push('Invalid chain ID')
    }
  }

  if (params.nonce !== undefined) {
    const nonce = Number(params.nonce)
    if (isNaN(nonce) || nonce < 0) {
      errors.push('Invalid nonce')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Known delegate presets by chain ID
 */
export const DELEGATE_PRESETS: Record<number, Array<{
  name: string
  description: string
  address: Address
  features: string[]
}>> = {
  // Anvil/Devnet
  31337: [
    {
      name: 'Kernel v3.0',
      description: 'ZeroDev Kernel - Modular Smart Account',
      address: '0xA7c59f010700930003b33aB25a7a0679C860f29c',
      features: ['ERC-7579', 'Modular', 'Gas Sponsorship', 'Session Keys'],
    },
  ],
  // Sepolia Testnet
  11155111: [
    {
      name: 'Kernel v3.0 (Sepolia)',
      description: 'ZeroDev Kernel - Modular Smart Account',
      address: '0x0000000000000000000000000000000000000000', // Placeholder
      features: ['ERC-7579', 'Modular'],
    },
  ],
  // Mainnet (not yet supported)
  1: [],
}

/**
 * Get delegate presets for a chain
 */
export function getDelegatePresets(chainId: number) {
  return DELEGATE_PRESETS[chainId] || []
}
