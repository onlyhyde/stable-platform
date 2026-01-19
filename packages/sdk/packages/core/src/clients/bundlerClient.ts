import type { Address, Hex } from 'viem'
import type {
  BundlerClient,
  BundlerClientConfig,
  UserOperation,
  UserOperationGasEstimation,
  UserOperationReceipt,
  UserOperationWithTransactionHash,
  WaitForUserOperationReceiptOptions,
} from '@stablenet/types'
import { ENTRY_POINT_V07_ADDRESS } from '@stablenet/types'
import { packUserOperation, unpackUserOperation } from '../utils/userOperation'

/**
 * Create a bundler client for sending UserOperations
 */
export function createBundlerClient(config: BundlerClientConfig): BundlerClient {
  const { url, entryPoint = ENTRY_POINT_V07_ADDRESS } = config

  let requestId = 0

  const rpcRequest = async <T>(method: string, params: unknown[]): Promise<T> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++requestId,
        method,
        params,
      }),
    })

    const data = await response.json() as {
      result?: T
      error?: { message: string; code: number; data?: unknown }
    }

    if (data.error) {
      throw new BundlerError(data.error.message, data.error.code, data.error.data)
    }

    return data.result as T
  }

  const sendUserOperation = async (userOp: UserOperation): Promise<Hex> => {
    const packed = packUserOperation(userOp)
    return rpcRequest<Hex>('eth_sendUserOperation', [packed, entryPoint])
  }

  const estimateUserOperationGas = async (
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex }
  ): Promise<UserOperationGasEstimation> => {
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

    const result = await rpcRequest<{
      preVerificationGas: Hex
      verificationGasLimit: Hex
      callGasLimit: Hex
      paymasterVerificationGasLimit?: Hex
      paymasterPostOpGasLimit?: Hex
    }>('eth_estimateUserOperationGas', [packed, entryPoint])

    return {
      preVerificationGas: BigInt(result.preVerificationGas),
      verificationGasLimit: BigInt(result.verificationGasLimit),
      callGasLimit: BigInt(result.callGasLimit),
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit
        ? BigInt(result.paymasterVerificationGasLimit)
        : undefined,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit
        ? BigInt(result.paymasterPostOpGasLimit)
        : undefined,
    }
  }

  const getUserOperationByHash = async (
    hash: Hex
  ): Promise<UserOperationWithTransactionHash | null> => {
    const result = await rpcRequest<{
      userOperation: Record<string, Hex>
      entryPoint: Address
      transactionHash: Hex
      blockHash: Hex
      blockNumber: Hex
    } | null>('eth_getUserOperationByHash', [hash])

    if (!result) return null

    return {
      userOperation: unpackUserOperation(result.userOperation),
      entryPoint: result.entryPoint,
      transactionHash: result.transactionHash,
      blockHash: result.blockHash,
      blockNumber: BigInt(result.blockNumber),
    }
  }

  const getUserOperationReceipt = async (
    hash: Hex
  ): Promise<UserOperationReceipt | null> => {
    const result = await rpcRequest<{
      userOpHash: Hex
      entryPoint: Address
      sender: Address
      nonce: Hex
      paymaster?: Address
      actualGasCost: Hex
      actualGasUsed: Hex
      success: boolean
      reason?: string
      logs: Array<{
        logIndex: Hex
        transactionIndex: Hex
        transactionHash: Hex
        blockHash: Hex
        blockNumber: Hex
        address: Address
        data: Hex
        topics: Hex[]
      }>
      receipt: {
        transactionHash: Hex
        transactionIndex: Hex
        blockHash: Hex
        blockNumber: Hex
        from: Address
        to?: Address
        cumulativeGasUsed: Hex
        gasUsed: Hex
        contractAddress?: Address
        logs: Array<{
          logIndex: Hex
          transactionIndex: Hex
          transactionHash: Hex
          blockHash: Hex
          blockNumber: Hex
          address: Address
          data: Hex
          topics: Hex[]
        }>
        status: Hex
        effectiveGasPrice: Hex
      }
    } | null>('eth_getUserOperationReceipt', [hash])

    if (!result) return null

    return {
      userOpHash: result.userOpHash,
      entryPoint: result.entryPoint,
      sender: result.sender,
      nonce: BigInt(result.nonce),
      paymaster: result.paymaster,
      actualGasCost: BigInt(result.actualGasCost),
      actualGasUsed: BigInt(result.actualGasUsed),
      success: result.success,
      reason: result.reason,
      logs: result.logs.map((log) => ({
        logIndex: Number(log.logIndex),
        transactionIndex: Number(log.transactionIndex),
        transactionHash: log.transactionHash,
        blockHash: log.blockHash,
        blockNumber: BigInt(log.blockNumber),
        address: log.address,
        data: log.data,
        topics: log.topics,
      })),
      receipt: {
        transactionHash: result.receipt.transactionHash,
        transactionIndex: Number(result.receipt.transactionIndex),
        blockHash: result.receipt.blockHash,
        blockNumber: BigInt(result.receipt.blockNumber),
        from: result.receipt.from,
        to: result.receipt.to,
        cumulativeGasUsed: BigInt(result.receipt.cumulativeGasUsed),
        gasUsed: BigInt(result.receipt.gasUsed),
        contractAddress: result.receipt.contractAddress,
        logs: result.receipt.logs.map((log) => ({
          logIndex: Number(log.logIndex),
          transactionIndex: Number(log.transactionIndex),
          transactionHash: log.transactionHash,
          blockHash: log.blockHash,
          blockNumber: BigInt(log.blockNumber),
          address: log.address,
          data: log.data,
          topics: log.topics,
        })),
        status: result.receipt.status === '0x1' ? 'success' : 'reverted',
        effectiveGasPrice: BigInt(result.receipt.effectiveGasPrice),
      },
    }
  }

  const getSupportedEntryPoints = async (): Promise<Address[]> => {
    return rpcRequest<Address[]>('eth_supportedEntryPoints', [])
  }

  const getChainId = async (): Promise<bigint> => {
    const result = await rpcRequest<Hex>('eth_chainId', [])
    return BigInt(result)
  }

  const waitForUserOperationReceipt = async (
    hash: Hex,
    options: WaitForUserOperationReceiptOptions = {}
  ): Promise<UserOperationReceipt> => {
    const { pollingInterval = 1000, timeout = 60000 } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const receipt = await getUserOperationReceipt(hash)
      if (receipt) return receipt
      await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    }

    throw new Error(`Timeout waiting for user operation receipt: ${hash}`)
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

/**
 * Bundler error class
 */
export class BundlerError extends Error {
  code: number
  data?: unknown

  constructor(message: string, code: number, data?: unknown) {
    super(message)
    this.name = 'BundlerError'
    this.code = code
    this.data = data
  }
}
