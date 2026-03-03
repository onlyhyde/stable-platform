/**
 * Bundler Client
 *
 * ERC-4337 Bundler client for sending and managing UserOperations.
 * Follows SRP: handles only bundler-specific operations.
 * Follows DIP: uses JsonRpcClient abstraction for RPC communication.
 */

import type {
  BundlerClient,
  BundlerClientConfig,
  UserOperation,
  UserOperationGasEstimation,
  UserOperationReceipt,
  UserOperationWithTransactionHash,
  WaitForUserOperationReceiptOptions,
} from '@stablenet/sdk-types'
import { ENTRY_POINT_ADDRESS } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { DEFAULT_CONFIRMATION_TIMEOUT, USER_OP_POLLING_INTERVAL } from '../config'
import { SDK_ERROR_CODES, SdkError } from '../errors'
import { createBundlerRpcClient, type JsonRpcClient } from '../rpc'
import { packUserOperation, unpackUserOperation } from '../utils/userOperation'

// ============================================================================
// Types
// ============================================================================

/**
 * Raw bundler response types (hex strings)
 */
interface RawGasEstimation {
  preVerificationGas: Hex
  verificationGasLimit: Hex
  callGasLimit: Hex
  paymasterVerificationGasLimit?: Hex
  paymasterPostOpGasLimit?: Hex
}

interface RawLog {
  logIndex: Hex
  transactionIndex: Hex
  transactionHash: Hex
  blockHash: Hex
  blockNumber: Hex
  address: Address
  data: Hex
  topics: Hex[]
}

interface RawReceipt {
  transactionHash: Hex
  transactionIndex: Hex
  blockHash: Hex
  blockNumber: Hex
  from: Address
  to?: Address
  cumulativeGasUsed: Hex
  gasUsed: Hex
  contractAddress?: Address
  logs: RawLog[]
  status: Hex
  effectiveGasPrice: Hex
}

interface RawUserOperationReceipt {
  userOpHash: Hex
  entryPoint: Address
  sender: Address
  nonce: Hex
  paymaster?: Address
  actualGasCost: Hex
  actualGasUsed: Hex
  success: boolean
  reason?: string
  logs: RawLog[]
  receipt: RawReceipt
}

interface RawUserOperationWithHash {
  userOperation: Record<string, Hex>
  entryPoint: Address
  transactionHash: Hex
  blockHash: Hex
  blockNumber: Hex
}

// ============================================================================
// Bundler Client Implementation
// ============================================================================

/**
 * Create a bundler client for sending UserOperations
 *
 * @example
 * ```typescript
 * const bundler = createBundlerClient({
 *   url: 'https://bundler.example.com',
 *   entryPoint: ENTRY_POINT_ADDRESS,
 * })
 *
 * const hash = await bundler.sendUserOperation(userOp)
 * const receipt = await bundler.waitForUserOperationReceipt(hash)
 * ```
 */
export function createBundlerClient(config: BundlerClientConfig): BundlerClient {
  const { url, entryPoint = ENTRY_POINT_ADDRESS } = config

  // Use shared RPC client
  const rpcClient: JsonRpcClient = createBundlerRpcClient(url)

  /**
   * Send a UserOperation to the bundler
   */
  async function sendUserOperation(userOp: UserOperation): Promise<Hex> {
    const packed = packUserOperation(userOp)
    return rpcClient.request<Hex>('eth_sendUserOperation', [packed, entryPoint])
  }

  /**
   * Estimate gas for a UserOperation
   */
  async function estimateUserOperationGas(
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex }
  ): Promise<UserOperationGasEstimation> {
    const packed = packUserOperation({
      sender: userOp.sender,
      nonce: userOp.nonce ?? 0n,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit ?? 0n,
      verificationGasLimit: userOp.verificationGasLimit ?? 0n,
      preVerificationGas: userOp.preVerificationGas ?? 0n,
      maxFeePerGas: userOp.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas ?? 0n,
      signature: userOp.signature ?? '0x',
      factory: userOp.factory,
      factoryData: userOp.factoryData,
      paymaster: userOp.paymaster,
      paymasterData: userOp.paymasterData,
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
    })

    const result = await rpcClient.request<RawGasEstimation>('eth_estimateUserOperationGas', [
      packed,
      entryPoint,
    ])

    return parseGasEstimation(result)
  }

  /**
   * Get UserOperation by hash
   */
  async function getUserOperationByHash(
    hash: Hex
  ): Promise<UserOperationWithTransactionHash | null> {
    const result = await rpcClient.request<RawUserOperationWithHash | null>(
      'eth_getUserOperationByHash',
      [hash]
    )

    if (!result) return null

    return {
      userOperation: unpackUserOperation(result.userOperation),
      entryPoint: result.entryPoint,
      transactionHash: result.transactionHash,
      blockHash: result.blockHash,
      blockNumber: BigInt(result.blockNumber),
    }
  }

  /**
   * Get UserOperation receipt
   */
  async function getUserOperationReceipt(hash: Hex): Promise<UserOperationReceipt | null> {
    const result = await rpcClient.request<RawUserOperationReceipt | null>(
      'eth_getUserOperationReceipt',
      [hash]
    )

    if (!result) return null

    return parseUserOperationReceipt(result)
  }

  /**
   * Get supported entry points
   */
  async function getSupportedEntryPoints(): Promise<Address[]> {
    return rpcClient.request<Address[]>('eth_supportedEntryPoints', [])
  }

  /**
   * Get chain ID
   */
  async function getChainId(): Promise<bigint> {
    const result = await rpcClient.request<Hex>('eth_chainId', [])
    return BigInt(result)
  }

  /**
   * Wait for UserOperation receipt with polling
   */
  async function waitForUserOperationReceipt(
    hash: Hex,
    options: WaitForUserOperationReceiptOptions = {}
  ): Promise<UserOperationReceipt> {
    const { pollingInterval = USER_OP_POLLING_INTERVAL, timeout = DEFAULT_CONFIRMATION_TIMEOUT } =
      options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const receipt = await getUserOperationReceipt(hash)
      if (receipt) return receipt
      await sleep(pollingInterval)
    }

    throw new SdkError({
      code: SDK_ERROR_CODES.USER_OP_TIMEOUT,
      message: `Timeout waiting for user operation receipt: ${hash}`,
      context: { hash, operation: 'waitForUserOperationReceipt' },
    })
  }

  return {
    sendUserOperation,
    estimateUserOperationGas,
    getUserOperationByHash,
    getUserOperationReceipt,
    getSupportedEntryPoints,
    getChainId,
    waitForUserOperationReceipt,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse raw gas estimation response
 */
function parseGasEstimation(raw: RawGasEstimation): UserOperationGasEstimation {
  return {
    preVerificationGas: BigInt(raw.preVerificationGas),
    verificationGasLimit: BigInt(raw.verificationGasLimit),
    callGasLimit: BigInt(raw.callGasLimit),
    paymasterVerificationGasLimit: raw.paymasterVerificationGasLimit
      ? BigInt(raw.paymasterVerificationGasLimit)
      : undefined,
    paymasterPostOpGasLimit: raw.paymasterPostOpGasLimit
      ? BigInt(raw.paymasterPostOpGasLimit)
      : undefined,
  }
}

/**
 * Parse raw log
 */
function parseLog(raw: RawLog) {
  return {
    logIndex: Number(raw.logIndex),
    transactionIndex: Number(raw.transactionIndex),
    transactionHash: raw.transactionHash,
    blockHash: raw.blockHash,
    blockNumber: BigInt(raw.blockNumber),
    address: raw.address,
    data: raw.data,
    topics: raw.topics,
  }
}

/**
 * Parse raw UserOperation receipt
 */
function parseUserOperationReceipt(raw: RawUserOperationReceipt): UserOperationReceipt {
  return {
    userOpHash: raw.userOpHash,
    entryPoint: raw.entryPoint,
    sender: raw.sender,
    nonce: BigInt(raw.nonce),
    paymaster: raw.paymaster,
    actualGasCost: BigInt(raw.actualGasCost),
    actualGasUsed: BigInt(raw.actualGasUsed),
    success: raw.success,
    reason: raw.reason,
    logs: raw.logs.map(parseLog),
    receipt: {
      transactionHash: raw.receipt.transactionHash,
      transactionIndex: Number(raw.receipt.transactionIndex),
      blockHash: raw.receipt.blockHash,
      blockNumber: BigInt(raw.receipt.blockNumber),
      from: raw.receipt.from,
      to: raw.receipt.to,
      cumulativeGasUsed: BigInt(raw.receipt.cumulativeGasUsed),
      gasUsed: BigInt(raw.receipt.gasUsed),
      contractAddress: raw.receipt.contractAddress,
      logs: raw.receipt.logs.map(parseLog),
      status: raw.receipt.status === '0x1' ? 'success' : 'reverted',
      effectiveGasPrice: BigInt(raw.receipt.effectiveGasPrice),
    },
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
