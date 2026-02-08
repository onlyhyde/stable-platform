/**
 * Permit2 Integration
 *
 * Uniswap's Permit2 provides:
 * - Single approval for all tokens
 * - Signature-based token permits
 * - Batch operations
 * - Time-limited approvals
 *
 * @see https://github.com/Uniswap/permit2
 */

import type { Address, Hex } from 'viem'
import { encodeAbiParameters, keccak256, parseAbiParameters, toHex } from 'viem'

// ============================================================================
// Constants
// ============================================================================

/**
 * Permit2 contract addresses by chain
 */
export const PERMIT2_ADDRESSES: Record<number, Address> = {
  1: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Ethereum Mainnet
  10: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Optimism
  137: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Polygon
  42161: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Arbitrum
  8453: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Base
  11155111: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Sepolia
} as const

/**
 * Permit2 type hashes for EIP-712
 */
export const PERMIT2_TYPE_HASHES = {
  PERMIT_SINGLE: keccak256(
    toHex(
      'PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)'
    )
  ),
  PERMIT_BATCH: keccak256(
    toHex(
      'PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)'
    )
  ),
  PERMIT_DETAILS: keccak256(
    toHex('PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)')
  ),
  PERMIT_TRANSFER_FROM: keccak256(
    toHex(
      'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)'
    )
  ),
  PERMIT_BATCH_TRANSFER_FROM: keccak256(
    toHex(
      'PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)'
    )
  ),
} as const

/**
 * Max uint160 for unlimited approval
 */
export const MAX_UINT160 = 2n ** 160n - 1n

/**
 * Max uint48 for far future expiration
 */
export const MAX_UINT48 = 2n ** 48n - 1n

/**
 * Default permit expiration (30 days)
 */
export const DEFAULT_PERMIT_EXPIRATION = 30 * 24 * 60 * 60

// ============================================================================
// Types
// ============================================================================

/**
 * Token permission details for Permit2
 */
export interface PermitDetails {
  /** Token address */
  token: Address
  /** Amount to permit (uint160) */
  amount: bigint
  /** Expiration timestamp (uint48) */
  expiration: number
  /** Nonce for this permit (uint48) */
  nonce: number
}

/**
 * Single permit structure
 */
export interface PermitSingle {
  /** Permit details */
  details: PermitDetails
  /** Spender address */
  spender: Address
  /** Signature deadline */
  sigDeadline: bigint
}

/**
 * Batch permit structure
 */
export interface PermitBatch {
  /** Array of permit details */
  details: PermitDetails[]
  /** Spender address */
  spender: Address
  /** Signature deadline */
  sigDeadline: bigint
}

/**
 * Token permissions for transfer
 */
export interface TokenPermissions {
  /** Token address */
  token: Address
  /** Amount to transfer */
  amount: bigint
}

/**
 * Permit transfer from structure
 */
export interface PermitTransferFrom {
  /** Token permissions */
  permitted: TokenPermissions
  /** Nonce */
  nonce: bigint
  /** Deadline */
  deadline: bigint
}

/**
 * Batch permit transfer from structure
 */
export interface PermitBatchTransferFrom {
  /** Array of token permissions */
  permitted: TokenPermissions[]
  /** Nonce */
  nonce: bigint
  /** Deadline */
  deadline: bigint
}

/**
 * Signature transfer details
 */
export interface SignatureTransferDetails {
  /** Recipient address */
  to: Address
  /** Amount to transfer */
  requestedAmount: bigint
}

/**
 * Allowance data from Permit2
 */
export interface Allowance {
  /** Permitted amount */
  amount: bigint
  /** Expiration timestamp */
  expiration: number
  /** Current nonce */
  nonce: number
}

// ============================================================================
// EIP-712 Domain
// ============================================================================

/**
 * Get Permit2 EIP-712 domain for a chain
 */
export function getPermit2Domain(chainId: number): {
  name: string
  chainId: number
  verifyingContract: Address
} {
  const permit2Address = PERMIT2_ADDRESSES[chainId]
  if (!permit2Address) {
    throw new Error(`Permit2 not deployed on chain ${chainId}`)
  }

  return {
    name: 'Permit2',
    chainId,
    verifyingContract: permit2Address,
  }
}

// ============================================================================
// Typed Data Structures for Signing
// ============================================================================

/**
 * EIP-712 types for PermitSingle
 */
export const PERMIT_SINGLE_TYPES = {
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
} as const

/**
 * EIP-712 types for PermitBatch
 */
export const PERMIT_BATCH_TYPES = {
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
} as const

/**
 * EIP-712 types for PermitTransferFrom
 */
export const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const

/**
 * EIP-712 types for PermitBatchTransferFrom
 */
export const PERMIT_BATCH_TRANSFER_FROM_TYPES = {
  PermitBatchTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions[]' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const

// ============================================================================
// Encoding Functions
// ============================================================================

/**
 * Encode permit single call data
 */
export function encodePermitSingle(owner: Address, permit: PermitSingle, signature: Hex): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature'
    ),
    [
      owner,
      {
        details: {
          token: permit.details.token,
          amount: permit.details.amount,
          expiration: permit.details.expiration,
          nonce: permit.details.nonce,
        },
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      },
      signature,
    ]
  )
}

/**
 * Encode permit batch call data
 */
export function encodePermitBatch(owner: Address, permit: PermitBatch, signature: Hex): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce)[] details, address spender, uint256 sigDeadline) permitBatch, bytes signature'
    ),
    [
      owner,
      {
        details: permit.details.map((d) => ({
          token: d.token,
          amount: d.amount,
          expiration: d.expiration,
          nonce: d.nonce,
        })),
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      },
      signature,
    ]
  )
}

/**
 * Encode transfer from call data
 */
export function encodeTransferFrom(
  from: Address,
  to: Address,
  amount: bigint,
  token: Address
): Hex {
  return encodeAbiParameters(
    parseAbiParameters('address from, address to, uint160 amount, address token'),
    [from, to, amount, token]
  )
}

/**
 * Encode signature transfer from call data
 */
export function encodeSignatureTransferFrom(
  permit: PermitTransferFrom,
  transferDetails: SignatureTransferDetails,
  owner: Address,
  signature: Hex
): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      '((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature'
    ),
    [
      {
        permitted: {
          token: permit.permitted.token,
          amount: permit.permitted.amount,
        },
        nonce: permit.nonce,
        deadline: permit.deadline,
      },
      {
        to: transferDetails.to,
        requestedAmount: transferDetails.requestedAmount,
      },
      owner,
      signature,
    ]
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a permit details object
 */
export function createPermitDetails(
  token: Address,
  amount: bigint,
  expiration?: number,
  nonce?: number
): PermitDetails {
  return {
    token,
    amount: amount > MAX_UINT160 ? MAX_UINT160 : amount,
    expiration: expiration ?? Math.floor(Date.now() / 1000) + DEFAULT_PERMIT_EXPIRATION,
    nonce: nonce ?? 0,
  }
}

/**
 * Create a permit single object
 */
export function createPermitSingle(
  token: Address,
  spender: Address,
  amount: bigint,
  options?: {
    expiration?: number
    nonce?: number
    sigDeadline?: bigint
  }
): PermitSingle {
  return {
    details: createPermitDetails(token, amount, options?.expiration, options?.nonce),
    spender,
    sigDeadline: options?.sigDeadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
  }
}

/**
 * Create a permit batch object
 */
export function createPermitBatch(
  tokens: { token: Address; amount: bigint; nonce?: number }[],
  spender: Address,
  options?: {
    expiration?: number
    sigDeadline?: bigint
  }
): PermitBatch {
  return {
    details: tokens.map((t) =>
      createPermitDetails(t.token, t.amount, options?.expiration, t.nonce)
    ),
    spender,
    sigDeadline: options?.sigDeadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
  }
}

/**
 * Create a permit transfer from object
 */
export function createPermitTransferFrom(
  token: Address,
  amount: bigint,
  nonce: bigint,
  deadline?: bigint
): PermitTransferFrom {
  return {
    permitted: { token, amount },
    nonce,
    deadline: deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
  }
}

/**
 * Get typed data for signing a permit single
 */
export function getPermitSingleTypedData(
  permit: PermitSingle,
  chainId: number
): {
  domain: ReturnType<typeof getPermit2Domain>
  types: typeof PERMIT_SINGLE_TYPES
  primaryType: 'PermitSingle'
  message: PermitSingle
} {
  return {
    domain: getPermit2Domain(chainId),
    types: PERMIT_SINGLE_TYPES,
    primaryType: 'PermitSingle',
    message: permit,
  }
}

/**
 * Get typed data for signing a permit batch
 */
export function getPermitBatchTypedData(
  permit: PermitBatch,
  chainId: number
): {
  domain: ReturnType<typeof getPermit2Domain>
  types: typeof PERMIT_BATCH_TYPES
  primaryType: 'PermitBatch'
  message: PermitBatch
} {
  return {
    domain: getPermit2Domain(chainId),
    types: PERMIT_BATCH_TYPES,
    primaryType: 'PermitBatch',
    message: permit,
  }
}

/**
 * Get typed data for signing a permit transfer from
 */
export function getPermitTransferFromTypedData(
  permit: PermitTransferFrom,
  spender: Address,
  chainId: number
): {
  domain: ReturnType<typeof getPermit2Domain>
  types: typeof PERMIT_TRANSFER_FROM_TYPES
  primaryType: 'PermitTransferFrom'
  message: PermitTransferFrom & { spender: Address }
} {
  return {
    domain: getPermit2Domain(chainId),
    types: PERMIT_TRANSFER_FROM_TYPES,
    primaryType: 'PermitTransferFrom',
    message: { ...permit, spender },
  }
}

// ============================================================================
// Permit2 ABI
// ============================================================================

export const PERMIT2_ABI = [
  // Permit functions
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      {
        name: 'permitSingle',
        type: 'tuple',
        components: [
          {
            name: 'details',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' },
            ],
          },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      {
        name: 'permitBatch',
        type: 'tuple',
        components: [
          {
            name: 'details',
            type: 'tuple[]',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' },
            ],
          },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  // Transfer functions
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
  },
  // Allowance functions
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  // Signature transfer functions
  {
    name: 'permitTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      {
        name: 'transferDetails',
        type: 'tuple',
        components: [
          { name: 'to', type: 'address' },
          { name: 'requestedAmount', type: 'uint256' },
        ],
      },
      { name: 'owner', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const
