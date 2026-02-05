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
  Address,
  Hex,
  Hash,
  Signature,
  TypedData,
  TypedDataDomain,
  TypedDataField,
  AbiParameter,
  FunctionAbi,
  EventAbi,
  Abi,
  AbiEncoder,
  HashAlgorithm,
  Signer,
  RpcClient,
  CryptoProvider,
} from './interfaces'

// Utility functions
export {
  bytesToHex,
  hexToBytes,
  concatHex,
  padHex,
  isAddress,
  isHex,
} from './interfaces'

// ============================================================================
// Viem Adapter (TypeScript implementation)
// ============================================================================
export {
  ViemAbiEncoder,
  ViemHashAlgorithm,
  ViemRpcClient,
  ViemCryptoProvider,
  createCryptoProvider,
  createAbiEncoder,
  createHashAlgorithm,
  createRpcClient,
} from './viem-adapter'
