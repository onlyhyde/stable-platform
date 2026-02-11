/**
 * Viem RPC Provider
 *
 * RpcProvider implementation using viem library.
 */

import {
  type Address,
  createPublicClient,
  type Hash,
  type Hex,
  http,
  type PublicClient,
  type TransactionReceipt,
} from 'viem'
import { DEFAULT_PROVIDER_TIMEOUT, MIN_PRIORITY_FEE } from '../config'
import type {
  BlockData,
  EstimateGasParams,
  GasPrices,
  ReadContractParams,
  RpcProvider,
  RpcProviderConfig,
  WaitForReceiptOptions,
} from './types'

// ============================================================================
// Viem Provider Implementation
// ============================================================================

/**
 * Create a Viem-based RPC provider
 *
 * @example
 * ```typescript
 * const provider = createViemProvider({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 * })
 *
 * const block = await provider.getBlock()
 * const nonce = await provider.getTransactionCount(address)
 * ```
 */
export function createViemProvider(config: RpcProviderConfig): RpcProvider {
  const { rpcUrl, chainId, timeout = DEFAULT_PROVIDER_TIMEOUT } = config

  // Create viem public client
  const client: PublicClient = createPublicClient({
    transport: http(rpcUrl, { timeout }),
  })

  return {
    chainId,
    rpcUrl,

    // ----------------------------------------
    // Block & Chain Methods
    // ----------------------------------------

    async getBlock(blockTag = 'latest'): Promise<BlockData> {
      const block = await client.getBlock({ blockTag })
      return {
        // For pending blocks, number/hash can be null. Use 0n/'0x' as fallback.
        number: block.number ?? 0n,
        hash:
          block.hash ??
          ('0x0000000000000000000000000000000000000000000000000000000000000000' as Hash),
        timestamp: block.timestamp,
        baseFeePerGas: block.baseFeePerGas ?? null,
      }
    },

    async getGasPrice(): Promise<bigint> {
      return client.getGasPrice()
    },

    async getGasPrices(): Promise<GasPrices> {
      const [block, gasPrice] = await Promise.all([
        client.getBlock({ blockTag: 'latest' }),
        client.getGasPrice(),
      ])

      const baseFee = block.baseFeePerGas ?? 0n

      let maxPriorityFeePerGas: bigint
      try {
        maxPriorityFeePerGas = await client.estimateMaxPriorityFeePerGas()
      } catch {
        maxPriorityFeePerGas = MIN_PRIORITY_FEE
      }

      // Ensure minimum priority fee
      if (maxPriorityFeePerGas < MIN_PRIORITY_FEE) {
        maxPriorityFeePerGas = MIN_PRIORITY_FEE
      }

      // Max fee = 2 * baseFee + priorityFee (buffer for base fee fluctuation)
      const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

      return {
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
      }
    },

    async estimateMaxPriorityFeePerGas(): Promise<bigint> {
      try {
        const priorityFee = await client.estimateMaxPriorityFeePerGas()
        return priorityFee < MIN_PRIORITY_FEE ? MIN_PRIORITY_FEE : priorityFee
      } catch {
        return MIN_PRIORITY_FEE
      }
    },

    // ----------------------------------------
    // Account Methods
    // ----------------------------------------

    async getTransactionCount(
      address: Address,
      blockTag: 'latest' | 'pending' = 'pending'
    ): Promise<number> {
      return client.getTransactionCount({ address, blockTag })
    },

    async getCode(address: Address): Promise<Hex | undefined> {
      const code = await client.getCode({ address })
      return code && code !== '0x' ? code : undefined
    },

    async getBalance(address: Address): Promise<bigint> {
      return client.getBalance({ address })
    },

    // ----------------------------------------
    // Gas Estimation
    // ----------------------------------------

    async estimateGas(params: EstimateGasParams): Promise<bigint> {
      return client.estimateGas({
        account: params.from,
        to: params.to,
        value: params.value,
        data: params.data,
      })
    },

    // ----------------------------------------
    // Transaction Methods
    // ----------------------------------------

    async sendRawTransaction(serializedTransaction: Hex): Promise<Hash> {
      return client.sendRawTransaction({ serializedTransaction })
    },

    async waitForTransactionReceipt(
      hash: Hash,
      options?: WaitForReceiptOptions
    ): Promise<TransactionReceipt> {
      return client.waitForTransactionReceipt({
        hash,
        confirmations: options?.confirmations ?? 1,
        timeout: options?.timeout,
      })
    },

    // ----------------------------------------
    // Contract Methods
    // ----------------------------------------

    async readContract<TResult = unknown>(params: ReadContractParams): Promise<TResult> {
      const result = await client.readContract({
        address: params.address,
        abi: params.abi as readonly unknown[],
        functionName: params.functionName,
        args: params.args,
      })
      return result as TResult
    },

    // ----------------------------------------
    // Utility Methods
    // ----------------------------------------

    async isConnected(): Promise<boolean> {
      try {
        await client.getChainId()
        return true
      } catch {
        return false
      }
    },
  }
}

// ============================================================================
// Exports
// ============================================================================

export type ViemProvider = ReturnType<typeof createViemProvider>
