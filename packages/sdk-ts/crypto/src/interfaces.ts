/**
 * @stablenet/sdk-crypto - Cryptographic Abstraction Interfaces
 *
 * These interfaces abstract away the underlying cryptographic implementation
 * to enable cross-language portability (TypeScript, Go, Rust).
 *
 * Each target language should implement these interfaces with native libraries:
 * - TypeScript: viem (default adapter provided)
 * - Go: go-ethereum/crypto, go-ethereum/abi
 * - Rust: ethers-rs, alloy
 */

// ============================================================================
// Primitive Types (language-agnostic)
// ============================================================================

/** Ethereum address (0x-prefixed, 42 characters) */
export type Address = `0x${string}`

/** Hexadecimal data (0x-prefixed) */
export type Hex = `0x${string}`

/** 32-byte hash (0x-prefixed, 66 characters) */
export type Hash = `0x${string}`

/** Signature components */
export interface Signature {
  r: Hex
  s: Hex
  v: number
}

/** Typed data for EIP-712 signing */
export interface TypedData {
  domain: TypedDataDomain
  types: Record<string, TypedDataField[]>
  primaryType: string
  message: Record<string, unknown>
}

export interface TypedDataDomain {
  name?: string
  version?: string
  chainId?: number | bigint
  verifyingContract?: Address
  salt?: Hex
}

export interface TypedDataField {
  name: string
  type: string
}

// ============================================================================
// ABI Encoding Interface
// ============================================================================

/** ABI parameter definition */
export interface AbiParameter {
  name?: string
  type: string
  components?: AbiParameter[]
  indexed?: boolean
}

/** Function ABI definition */
export interface FunctionAbi {
  type: 'function'
  name: string
  inputs: AbiParameter[]
  outputs: AbiParameter[]
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
}

/** Event ABI definition */
export interface EventAbi {
  type: 'event'
  name: string
  inputs: AbiParameter[]
  anonymous?: boolean
}

/** Contract ABI */
export type Abi = readonly (FunctionAbi | EventAbi | { type: string })[]

/**
 * ABI Encoder Interface
 *
 * Implementations:
 * - TypeScript: viem's encodeAbiParameters, encodeFunctionData
 * - Go: go-ethereum/accounts/abi
 * - Rust: ethers-rs abi module
 */
export interface AbiEncoder {
  /**
   * Encode parameters according to ABI specification
   * @param types - Array of Solidity type strings (e.g., ["address", "uint256"])
   * @param values - Array of values to encode
   * @returns Encoded hex data
   */
  encodeParameters(types: readonly string[], values: readonly unknown[]): Hex

  /**
   * Decode parameters from ABI-encoded data
   * @param types - Array of Solidity type strings
   * @param data - Encoded hex data
   * @returns Decoded values
   */
  decodeParameters(types: readonly string[], data: Hex): readonly unknown[]

  /**
   * Encode a function call with arguments
   * @param abi - Contract ABI
   * @param functionName - Name of the function to call
   * @param args - Function arguments
   * @returns Encoded calldata
   */
  encodeFunctionCall(abi: Abi, functionName: string, args: readonly unknown[]): Hex

  /**
   * Decode function result
   * @param abi - Contract ABI
   * @param functionName - Name of the function
   * @param data - Encoded return data
   * @returns Decoded return values
   */
  decodeFunctionResult(abi: Abi, functionName: string, data: Hex): unknown

  /**
   * Encode packed parameters (non-standard ABI encoding)
   * @param types - Array of Solidity type strings
   * @param values - Array of values to encode
   * @returns Packed hex data
   */
  encodePacked(types: readonly string[], values: readonly unknown[]): Hex
}

// ============================================================================
// Hash Algorithm Interface
// ============================================================================

/**
 * Hash Algorithm Interface
 *
 * Implementations:
 * - TypeScript: viem's keccak256
 * - Go: golang.org/x/crypto/sha3
 * - Rust: tiny-keccak or sha3 crate
 */
export interface HashAlgorithm {
  /**
   * Compute Keccak-256 hash (Ethereum's hash function)
   * @param data - Data to hash (bytes or hex)
   * @returns 32-byte hash
   */
  keccak256(data: Uint8Array | Hex): Hash

  /**
   * Compute SHA-256 hash
   * @param data - Data to hash
   * @returns 32-byte hash
   */
  sha256?(data: Uint8Array | Hex): Hash
}

// ============================================================================
// Signer Interface
// ============================================================================

/**
 * Signer Interface
 *
 * Implementations:
 * - TypeScript: viem's LocalAccount, WalletClient
 * - Go: go-ethereum/crypto
 * - Rust: ethers-rs signers
 */
export interface Signer {
  /**
   * Get the signer's address
   */
  getAddress(): Promise<Address>

  /**
   * Sign a message (EIP-191 personal_sign)
   * @param message - Message to sign (bytes or string)
   * @returns Signature
   */
  signMessage(message: Uint8Array | string): Promise<Hex>

  /**
   * Sign typed data (EIP-712)
   * @param typedData - Typed data structure
   * @returns Signature
   */
  signTypedData(typedData: TypedData): Promise<Hex>

  /**
   * Sign a transaction hash
   * @param hash - Transaction hash to sign
   * @returns Signature
   */
  signHash?(hash: Hash): Promise<Signature>
}

// ============================================================================
// RPC Client Interface
// ============================================================================

/**
 * RPC Client Interface
 *
 * Implementations:
 * - TypeScript: viem's PublicClient, http transport
 * - Go: go-ethereum/ethclient
 * - Rust: ethers-rs providers
 */
export interface RpcClient {
  /**
   * Send a JSON-RPC request
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns Response data
   */
  request<T>(method: string, params?: readonly unknown[]): Promise<T>

  /**
   * Get the current chain ID
   */
  getChainId(): Promise<number>

  /**
   * Get the current block number
   */
  getBlockNumber(): Promise<bigint>

  /**
   * Get account balance
   * @param address - Account address
   */
  getBalance(address: Address): Promise<bigint>

  /**
   * Get account nonce (transaction count)
   * @param address - Account address
   */
  getNonce(address: Address): Promise<bigint>

  /**
   * Read from a contract
   * @param params - Call parameters
   */
  readContract(params: {
    address: Address
    abi: Abi
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>

  /**
   * Estimate gas for a transaction
   */
  estimateGas(params: { to: Address; data?: Hex; value?: bigint; from?: Address }): Promise<bigint>

  /**
   * Get current gas price
   */
  getGasPrice(): Promise<bigint>

  /**
   * Get max priority fee per gas (EIP-1559)
   */
  getMaxPriorityFeePerGas?(): Promise<bigint>
}

// ============================================================================
// Crypto Provider (Combined Interface)
// ============================================================================

/**
 * Crypto Provider - Combined cryptographic utilities
 *
 * This is the main interface that SDK components should depend on.
 * Each language implementation provides a concrete CryptoProvider.
 */
export interface CryptoProvider {
  /** ABI encoding utilities */
  readonly abi: AbiEncoder

  /** Hash algorithms */
  readonly hash: HashAlgorithm

  /** Optional signer (may be injected separately) */
  signer?: Signer

  /** Optional RPC client (may be injected separately) */
  rpc?: RpcClient
}

// ============================================================================
// Utility Functions (Language-agnostic helpers)
// ============================================================================

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as Hex
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: Hex): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Concatenate hex strings
 */
export function concatHex(hexes: readonly Hex[]): Hex {
  return `0x${hexes.map((h) => h.slice(2)).join('')}` as Hex
}

/**
 * Pad hex to specified byte length
 */
export function padHex(hex: Hex, length: number, direction: 'left' | 'right' = 'left'): Hex {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const targetLength = length * 2
  if (cleanHex.length >= targetLength) return `0x${cleanHex}` as Hex

  const padding = '0'.repeat(targetLength - cleanHex.length)
  return direction === 'left'
    ? (`0x${padding}${cleanHex}` as Hex)
    : (`0x${cleanHex}${padding}` as Hex)
}

/**
 * Check if a value is a valid address
 */
export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Check if a value is a valid hex string
 */
export function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value)
}
