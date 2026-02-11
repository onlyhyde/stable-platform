/**
 * @stablenet/sdk-crypto
 *
 * Cryptographic abstraction layer for StableNet SDK.
 * Enables cross-language portability by abstracting viem-specific code.
 *
 * For other language implementations:
 * - Go: Implement interfaces using go-ethereum
 * - Rust: Implement interfaces using ethers-rs/alloy
 */

// ============================================================================
// Interfaces (Language-agnostic)
// ============================================================================
export type {
  Abi,
  AbiEncoder,
  AbiParameter,
  Address,
  CryptoProvider,
  EventAbi,
  FunctionAbi,
  Hash,
  HashAlgorithm,
  Hex,
  RpcClient,
  Signature,
  Signer,
  TypedData,
  TypedDataDomain,
  TypedDataField,
} from './interfaces'

// Utility functions
export {
  bytesToHex,
  concatHex,
  hexToBytes,
  isAddress,
  isHex,
  padHex,
} from './interfaces'

// ============================================================================
// Viem Adapter (TypeScript implementation)
// ============================================================================
export {
  createAbiEncoder,
  createCryptoProvider,
  createHashAlgorithm,
  createRpcClient,
  ViemAbiEncoder,
  ViemCryptoProvider,
  ViemHashAlgorithm,
  ViemRpcClient,
} from './viem-adapter'
