/**
 * Viem Adapter - Concrete implementation of crypto interfaces using viem
 *
 * This adapter connects the abstract crypto interfaces to viem's implementation.
 * For other languages, create similar adapters for:
 * - Go: go-ethereum adapter
 * - Rust: ethers-rs/alloy adapter
 */

import { sha256 as nobleSha256 } from '@noble/hashes/sha256'
import {
  bytesToHex,
  type Chain,
  createPublicClient,
  decodeAbiParameters,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  hexToBytes,
  http,
  type PublicClient,
  parseAbiParameters,
  type Abi as ViemAbi,
  type Address as ViemAddress,
  type Hex as ViemHex,
  keccak256 as viemKeccak256,
} from 'viem'

import type {
  Abi,
  AbiEncoder,
  Address,
  CryptoProvider,
  Hash,
  HashAlgorithm,
  Hex,
  RpcClient,
} from './interfaces'

// ============================================================================
// Viem ABI Encoder
// ============================================================================

export class ViemAbiEncoder implements AbiEncoder {
  encodeParameters(types: readonly string[], values: readonly unknown[]): Hex {
    const parsedTypes = parseAbiParameters(types.join(','))
    return encodeAbiParameters(parsedTypes, values as readonly unknown[]) as Hex
  }

  decodeParameters(types: readonly string[], data: Hex): readonly unknown[] {
    const parsedTypes = parseAbiParameters(types.join(','))
    return decodeAbiParameters(parsedTypes, data as ViemHex)
  }

  encodeFunctionCall(abi: Abi, functionName: string, args: readonly unknown[]): Hex {
    return encodeFunctionData({
      abi: abi as ViemAbi,
      functionName,
      args: args as unknown[],
    }) as Hex
  }

  decodeFunctionResult(abi: Abi, functionName: string, data: Hex): unknown {
    return decodeFunctionResult({
      abi: abi as ViemAbi,
      functionName,
      data: data as ViemHex,
    })
  }

  encodePacked(types: readonly string[], values: readonly unknown[]): Hex {
    return encodePacked(types as readonly string[], values as readonly unknown[]) as Hex
  }
}

// ============================================================================
// Viem Hash Algorithm
// ============================================================================

export class ViemHashAlgorithm implements HashAlgorithm {
  keccak256(data: Uint8Array | Hex): Hash {
    if (data instanceof Uint8Array) {
      return viemKeccak256(data) as Hash
    }
    return viemKeccak256(data as ViemHex) as Hash
  }

  sha256(data: Uint8Array | Hex): Hash {
    const input = data instanceof Uint8Array ? data : hexToBytes(data as ViemHex)
    const hash = nobleSha256(input)
    return bytesToHex(hash) as Hash
  }
}

// ============================================================================
// Viem RPC Client
// ============================================================================

export class ViemRpcClient implements RpcClient {
  private client: PublicClient

  constructor(rpcUrl: string, chain?: Chain) {
    this.client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })
  }

  async request<T>(method: string, params?: readonly unknown[]): Promise<T> {
    return this.client.request({
      method: method as Parameters<typeof this.client.request>[0]['method'],
      params: params as Parameters<typeof this.client.request>[0]['params'],
    }) as Promise<T>
  }

  async getChainId(): Promise<number> {
    return this.client.getChainId()
  }

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber()
  }

  async getBalance(address: Address): Promise<bigint> {
    return this.client.getBalance({ address: address as ViemAddress })
  }

  async getNonce(address: Address): Promise<bigint> {
    const count = await this.client.getTransactionCount({ address: address as ViemAddress })
    return BigInt(count)
  }

  async readContract(params: {
    address: Address
    abi: Abi
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown> {
    return this.client.readContract({
      address: params.address as ViemAddress,
      abi: params.abi as ViemAbi,
      functionName: params.functionName,
      args: params.args as unknown[],
    })
  }

  async estimateGas(params: {
    to: Address
    data?: Hex
    value?: bigint
    from?: Address
  }): Promise<bigint> {
    return this.client.estimateGas({
      to: params.to as ViemAddress,
      data: params.data as ViemHex,
      value: params.value,
      account: params.from as ViemAddress,
    })
  }

  async getGasPrice(): Promise<bigint> {
    return this.client.getGasPrice()
  }

  async getMaxPriorityFeePerGas(): Promise<bigint> {
    const feeHistory = await this.client.estimateFeesPerGas()
    return feeHistory.maxPriorityFeePerGas ?? BigInt(0)
  }

  /**
   * Get the underlying viem PublicClient for advanced usage
   */
  getViemClient(): PublicClient {
    return this.client
  }
}

// ============================================================================
// Viem Crypto Provider
// ============================================================================

export class ViemCryptoProvider implements CryptoProvider {
  readonly abi: AbiEncoder
  readonly hash: HashAlgorithm
  rpc?: RpcClient

  constructor(rpcUrl?: string, chain?: Chain) {
    this.abi = new ViemAbiEncoder()
    this.hash = new ViemHashAlgorithm()

    if (rpcUrl) {
      this.rpc = new ViemRpcClient(rpcUrl, chain)
    }
  }

  /**
   * Create a provider with an RPC client
   */
  static withRpc(rpcUrl: string, chain?: Chain): ViemCryptoProvider {
    return new ViemCryptoProvider(rpcUrl, chain)
  }

  /**
   * Create a provider without RPC (encoding/hashing only)
   */
  static encodingOnly(): ViemCryptoProvider {
    return new ViemCryptoProvider()
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default crypto provider using viem
 */
export function createCryptoProvider(rpcUrl?: string, chain?: Chain): CryptoProvider {
  return new ViemCryptoProvider(rpcUrl, chain)
}

/**
 * Create an ABI encoder using viem
 */
export function createAbiEncoder(): AbiEncoder {
  return new ViemAbiEncoder()
}

/**
 * Create a hash algorithm using viem
 */
export function createHashAlgorithm(): HashAlgorithm {
  return new ViemHashAlgorithm()
}

/**
 * Create an RPC client using viem
 */
export function createRpcClient(rpcUrl: string, chain?: Chain): RpcClient {
  return new ViemRpcClient(rpcUrl, chain)
}
