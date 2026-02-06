/**
 * RPC Provider Types
 *
 * Abstraction layer for blockchain RPC interactions.
 * Follows DIP: modules depend on this abstraction, not viem directly.
 */

import type { Address, Hash, Hex, TransactionReceipt } from 'viem'

// ============================================================================
// Core Types
// ============================================================================

/**
 * Block data from RPC
 */
export interface BlockData {
  number: bigint
  hash: Hash
  timestamp: bigint
  baseFeePerGas: bigint | null
}

/**
 * Gas prices from RPC
 */
export interface GasPrices {
  gasPrice: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Gas estimation parameters
 */
export interface EstimateGasParams {
  from?: Address
  to: Address
  value?: bigint
  data?: Hex
}

/**
 * Contract read parameters
 */
export interface ReadContractParams {
  address: Address
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

/**
 * Transaction receipt options
 */
export interface WaitForReceiptOptions {
  confirmations?: number
  timeout?: number
}

// ============================================================================
// RPC Provider Interface
// ============================================================================

/**
 * RPC Provider interface
 *
 * Abstracts blockchain RPC calls to allow different implementations.
 * Default implementation uses viem, but can be swapped for other libraries.
 */
export interface RpcProvider {
  /** Chain ID this provider is connected to */
  readonly chainId: number

  /** RPC URL */
  readonly rpcUrl: string

  // ----------------------------------------
  // Block & Chain Methods
  // ----------------------------------------

  /**
   * Get the latest block
   */
  getBlock(blockTag?: 'latest' | 'pending' | 'earliest'): Promise<BlockData>

  /**
   * Get current gas price
   */
  getGasPrice(): Promise<bigint>

  /**
   * Get current gas prices (EIP-1559)
   */
  getGasPrices(): Promise<GasPrices>

  /**
   * Estimate max priority fee per gas
   */
  estimateMaxPriorityFeePerGas(): Promise<bigint>

  // ----------------------------------------
  // Account Methods
  // ----------------------------------------

  /**
   * Get transaction count (nonce) for an address
   */
  getTransactionCount(address: Address, blockTag?: 'latest' | 'pending'): Promise<number>

  /**
   * Get code at an address
   */
  getCode(address: Address): Promise<Hex | undefined>

  /**
   * Get balance of an address
   */
  getBalance(address: Address): Promise<bigint>

  // ----------------------------------------
  // Gas Estimation
  // ----------------------------------------

  /**
   * Estimate gas for a transaction
   */
  estimateGas(params: EstimateGasParams): Promise<bigint>

  // ----------------------------------------
  // Transaction Methods
  // ----------------------------------------

  /**
   * Send a raw signed transaction
   */
  sendRawTransaction(serializedTransaction: Hex): Promise<Hash>

  /**
   * Wait for transaction receipt
   */
  waitForTransactionReceipt(
    hash: Hash,
    options?: WaitForReceiptOptions
  ): Promise<TransactionReceipt>

  // ----------------------------------------
  // Contract Methods
  // ----------------------------------------

  /**
   * Read from a contract
   */
  readContract<TResult = unknown>(params: ReadContractParams): Promise<TResult>

  // ----------------------------------------
  // Utility Methods
  // ----------------------------------------

  /**
   * Check if provider is connected
   */
  isConnected(): Promise<boolean>
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * RPC Provider configuration
 */
export interface RpcProviderConfig {
  /** RPC URL */
  rpcUrl: string

  /** Chain ID */
  chainId: number

  /** Request timeout in milliseconds */
  timeout?: number
}
