import type { Address, Hex, Hash, TransactionSerializable } from 'viem'
import { createPublicClient, http, parseGwei } from 'viem'
import type {
  MultiModeTransactionRequest,
  GasEstimate,
  TransactionResult,
} from '@stablenet/types'
import { createTransactionError } from '../errors'

// ============================================================================
// Types
// ============================================================================

/**
 * EOA Transaction configuration
 */
export interface EOATransactionConfig {
  /** RPC URL for the network */
  rpcUrl: string

  /** Chain ID */
  chainId: number
}

/**
 * Signer interface for signing transactions
 * Compatible with wallet-extension keyring
 */
export interface TransactionSigner {
  /** Sign a transaction and return serialized signed transaction */
  signTransaction(tx: TransactionSerializable): Promise<Hex>

  /** Get the signer's address */
  getAddress(): Promise<Address>
}

/**
 * Built EOA transaction ready for signing
 */
export interface BuiltEOATransaction {
  /** Transaction data */
  transaction: TransactionSerializable

  /** Gas estimate */
  gasEstimate: GasEstimate

  /** Sender address */
  from: Address

  /** Recipient address */
  to: Address

  /** Value in wei */
  value: bigint
}

// ============================================================================
// Constants
// ============================================================================

/** Default gas buffer multiplier (10% extra) */
const GAS_BUFFER_MULTIPLIER = 110n
const GAS_BUFFER_DIVISOR = 100n

/** Maximum gas limit to prevent excessive fees */
const MAX_GAS_LIMIT = 30_000_000n

/** Minimum priority fee (1 gwei) */
const MIN_PRIORITY_FEE = parseGwei('1')

// ============================================================================
// EOA Transaction Builder
// ============================================================================

/**
 * Create an EOA transaction builder
 *
 * @param config - Configuration for the transaction builder
 * @returns EOA transaction builder instance
 *
 * @example
 * ```typescript
 * const builder = createEOATransactionBuilder({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 * })
 *
 * const built = await builder.build({
 *   mode: 'eoa',
 *   from: '0x...',
 *   to: '0x...',
 *   value: parseEther('1'),
 *   data: '0x',
 * })
 *
 * const result = await builder.send(built, signer)
 * ```
 */
export function createEOATransactionBuilder(config: EOATransactionConfig) {
  const { rpcUrl, chainId } = config

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })

  /**
   * Get current nonce for address
   */
  async function getNonce(address: Address): Promise<number> {
    const nonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    })
    return nonce
  }

  /**
   * Get current gas prices (EIP-1559)
   */
  async function getGasPrices(): Promise<{
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }> {
    const block = await publicClient.getBlock({ blockTag: 'latest' })
    const baseFee = block.baseFeePerGas ?? 0n

    // Priority fee from network or minimum
    let maxPriorityFeePerGas: bigint
    try {
      maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas()
    } catch {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }

    // Ensure minimum priority fee
    if (maxPriorityFeePerGas < MIN_PRIORITY_FEE) {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }

    // Max fee = 2 * baseFee + priorityFee (safe buffer for base fee fluctuation)
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

    return { maxFeePerGas, maxPriorityFeePerGas }
  }

  /**
   * Estimate gas for a transaction
   */
  async function estimateGas(
    request: MultiModeTransactionRequest
  ): Promise<GasEstimate> {
    const { maxFeePerGas, maxPriorityFeePerGas } = await getGasPrices()

    // Estimate gas limit
    let gasLimit: bigint
    try {
      gasLimit = await publicClient.estimateGas({
        account: request.from,
        to: request.to,
        value: request.value,
        data: request.data,
      })
    } catch (error) {
      throw createTransactionError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          from: request.from,
          to: request.to,
          reason: 'GAS_ESTIMATION_FAILED',
        }
      )
    }

    // Apply buffer and cap
    gasLimit = (gasLimit * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR
    if (gasLimit > MAX_GAS_LIMIT) {
      gasLimit = MAX_GAS_LIMIT
    }

    // Calculate estimated cost
    const estimatedCost = gasLimit * maxFeePerGas

    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedCost,
    }
  }

  /**
   * Build a transaction for signing
   */
  async function build(
    request: MultiModeTransactionRequest
  ): Promise<BuiltEOATransaction> {
    // Validate request
    if (!request.from) {
      throw createTransactionError('Missing "from" address', {
        reason: 'INVALID_REQUEST',
      })
    }
    if (!request.to) {
      throw createTransactionError('Missing "to" address', {
        reason: 'INVALID_REQUEST',
      })
    }

    // Get nonce if not provided
    const nonce = request.nonce ?? (await getNonce(request.from))

    // Get gas estimate
    const gasEstimate = await estimateGas(request)

    // Use provided gas values or estimated ones
    const maxFeePerGas = request.maxFeePerGas ?? gasEstimate.maxFeePerGas
    const maxPriorityFeePerGas =
      request.maxPriorityFeePerGas ?? gasEstimate.maxPriorityFeePerGas
    const gas = request.gas ?? gasEstimate.gasLimit

    // Build transaction object
    const transaction: TransactionSerializable = {
      type: 'eip1559',
      chainId,
      nonce,
      to: request.to,
      value: request.value,
      data: request.data,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    }

    return {
      transaction,
      gasEstimate: {
        ...gasEstimate,
        gasLimit: gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost: gas * maxFeePerGas,
      },
      from: request.from,
      to: request.to,
      value: request.value,
    }
  }

  /**
   * Sign and send a built transaction
   */
  async function send(
    built: BuiltEOATransaction,
    signer: TransactionSigner
  ): Promise<TransactionResult> {
    // Verify signer address matches
    const signerAddress = await signer.getAddress()
    if (signerAddress.toLowerCase() !== built.from.toLowerCase()) {
      throw createTransactionError(
        `Signer address ${signerAddress} does not match transaction from ${built.from}`,
        {
          from: built.from,
          reason: 'SIGNER_MISMATCH',
        }
      )
    }

    // Sign the transaction
    let signedTx: Hex
    try {
      signedTx = await signer.signTransaction(built.transaction)
    } catch (error) {
      throw createTransactionError(
        `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          from: built.from,
          reason: 'SIGNING_FAILED',
        }
      )
    }

    // Send raw transaction
    let hash: Hash
    try {
      hash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx,
      })
    } catch (error) {
      throw createTransactionError(
        `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          from: built.from,
          to: built.to,
          reason: 'SEND_FAILED',
        }
      )
    }

    return {
      hash,
      mode: 'eoa',
      chainId,
      timestamp: Date.now(),
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async function waitForReceipt(
    hash: Hash,
    options: { confirmations?: number; timeout?: number } = {}
  ) {
    const { confirmations = 1, timeout = 60_000 } = options

    return publicClient.waitForTransactionReceipt({
      hash,
      confirmations,
      timeout,
    })
  }

  return {
    estimateGas,
    build,
    send,
    waitForReceipt,
    getNonce,
    getGasPrices,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type EOATransactionBuilder = ReturnType<typeof createEOATransactionBuilder>
