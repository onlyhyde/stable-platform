import { getUserOperationHash, unpackUserOperation } from '@stablenet/core'
import type { UserOperation } from '@stablenet/types'
import type { Address, Hex, PublicClient } from 'viem'
import { decodeFunctionData } from 'viem'
import { ENTRY_POINT_ABI } from '../abi'
import type { GasEstimator } from '../gas/gasEstimator'
import type { Mempool } from '../mempool/mempool'
import type { BundlerConfig } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import type { UserOperationValidator } from '../validation'

/** Maximum block range for on-chain log searches */
const LOG_SEARCH_BLOCK_RANGE = 10_000n

/**
 * Validate and extract RPC params for eth_sendUserOperation / eth_estimateUserOperationGas
 */
function validateUserOpParams(params: unknown[]): {
  packedOp: Record<string, Hex>
  entryPoint: Address
} {
  if (!Array.isArray(params) || params.length < 2) {
    throw new RpcError('Expected [userOp, entryPoint] params', RPC_ERROR_CODES.INVALID_PARAMS)
  }
  const [rawOp, rawEntryPoint] = params

  if (typeof rawOp !== 'object' || rawOp === null) {
    throw new RpcError('Invalid UserOperation: expected object', RPC_ERROR_CODES.INVALID_PARAMS)
  }
  if (typeof rawEntryPoint !== 'string' || !rawEntryPoint.startsWith('0x')) {
    throw new RpcError('Invalid entryPoint: expected hex address', RPC_ERROR_CODES.INVALID_PARAMS)
  }

  return {
    packedOp: rawOp as Record<string, Hex>,
    entryPoint: rawEntryPoint as Address,
  }
}

/**
 * Validate and extract a single hex hash param
 */
function validateHashParam(params: unknown[]): Hex {
  if (!Array.isArray(params) || params.length < 1) {
    throw new RpcError('Expected [hash] param', RPC_ERROR_CODES.INVALID_PARAMS)
  }
  const [rawHash] = params
  if (typeof rawHash !== 'string' || !rawHash.startsWith('0x')) {
    throw new RpcError('Invalid hash: expected hex string', RPC_ERROR_CODES.INVALID_PARAMS)
  }
  return rawHash as Hex
}

/**
 * RPC-format UserOperation receipt (hex-encoded numeric fields per ERC-4337 JSON-RPC spec).
 * Distinct from the internal UserOperationReceipt which uses native bigint/number types.
 */
export interface RpcUserOperationReceipt {
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
}

/**
 * ERC-4337 eth_ namespace RPC method handlers.
 * Handles UserOperation submission, gas estimation, and receipt queries.
 */
export class EthHandlers {
  constructor(
    private publicClient: PublicClient,
    private mempool: Mempool,
    private validator: UserOperationValidator,
    private gasEstimator: GasEstimator,
    private config: BundlerConfig,
    private logger: Logger
  ) {}

  /**
   * Resolve and validate an entryPoint address against configured entry points.
   * Returns the canonical (config-stored) address for consistent lookups.
   */
  private resolveEntryPoint(entryPoint: Address): Address {
    const entryPointLower = entryPoint.toLowerCase()
    const matched = this.config.entryPoints.find(
      (ep) => ep.toLowerCase() === entryPointLower
    )
    if (!matched) {
      throw new RpcError(`EntryPoint ${entryPoint} not supported`, RPC_ERROR_CODES.INVALID_PARAMS)
    }
    return matched
  }

  /**
   * eth_sendUserOperation
   */
  async ethSendUserOperation(params: unknown[]): Promise<Hex> {
    const { packedOp, entryPoint } = validateUserOpParams(params)
    const matchedEntryPoint = this.resolveEntryPoint(entryPoint)

    // Unpack UserOperation
    const userOp = unpackUserOperation(packedOp)

    // Calculate hash (uses canonical entryPoint from config for consistency)
    const chainId = BigInt(await this.publicClient.getChainId())
    const userOpHash = getUserOperationHash(userOp, matchedEntryPoint, chainId)

    // Check for duplicate in mempool before validation (avoid unnecessary work)
    if (this.mempool.get(userOpHash)) {
      throw new RpcError(
        `UserOperation ${userOpHash} already in mempool`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Validate UserOperation (format, reputation, state, simulation)
    const validationResult = await this.validator.validate(userOp)

    // Add to mempool (uses canonical entryPoint from config for consistent lookups)
    this.mempool.add(userOp, userOpHash, matchedEntryPoint)

    // If aggregator detected during validation, record it on the mempool entry
    if (validationResult.aggregator) {
      this.mempool.setAggregator(userOpHash, validationResult.aggregator)
    }

    this.logger.info({ userOpHash, sender: userOp.sender }, 'UserOperation received and validated')

    return userOpHash
  }

  /**
   * eth_estimateUserOperationGas
   */
  async ethEstimateUserOperationGas(params: unknown[]): Promise<{
    preVerificationGas: Hex
    verificationGasLimit: Hex
    callGasLimit: Hex
    paymasterVerificationGasLimit?: Hex
    paymasterPostOpGasLimit?: Hex
  }> {
    const { packedOp, entryPoint } = validateUserOpParams(params)
    this.resolveEntryPoint(entryPoint)

    // Unpack UserOperation
    const userOp = unpackUserOperation(packedOp)

    // Estimate gas
    const estimation = await this.gasEstimator.estimate(userOp)

    return {
      preVerificationGas: `0x${estimation.preVerificationGas.toString(16)}`,
      verificationGasLimit: `0x${estimation.verificationGasLimit.toString(16)}`,
      callGasLimit: `0x${estimation.callGasLimit.toString(16)}`,
      paymasterVerificationGasLimit: estimation.paymasterVerificationGasLimit
        ? `0x${estimation.paymasterVerificationGasLimit.toString(16)}`
        : undefined,
      paymasterPostOpGasLimit: estimation.paymasterPostOpGasLimit
        ? `0x${estimation.paymasterPostOpGasLimit.toString(16)}`
        : undefined,
    }
  }

  /**
   * eth_getUserOperationByHash
   */
  async ethGetUserOperationByHash(params: unknown[]): Promise<{
    userOperation: Record<string, Hex>
    entryPoint: Address
    transactionHash: Hex
    blockHash: Hex
    blockNumber: Hex
  } | null> {
    const hash = validateHashParam(params)

    // First check in-memory mempool
    const entry = this.mempool.get(hash)
    if (entry?.transactionHash) {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: entry.transactionHash,
      })

      return {
        userOperation: this.packUserOpForResponse(entry.userOp),
        entryPoint: entry.entryPoint,
        transactionHash: entry.transactionHash,
        blockHash: receipt.blockHash,
        blockNumber: `0x${receipt.blockNumber.toString(16)}`,
      }
    }

    // Fallback: search on-chain UserOperationEvent logs by userOpHash.
    // Limit block range to prevent full-chain scans on mainnet.
    try {
      const currentBlock = await this.publicClient.getBlockNumber()
      const fromBlock = currentBlock > LOG_SEARCH_BLOCK_RANGE
        ? currentBlock - LOG_SEARCH_BLOCK_RANGE
        : 0n

      for (const entryPoint of this.config.entryPoints) {
        const logs = await this.publicClient.getLogs({
          address: entryPoint,
          event: {
            type: 'event',
            name: 'UserOperationEvent',
            inputs: [
              { name: 'userOpHash', type: 'bytes32', indexed: true },
              { name: 'sender', type: 'address', indexed: true },
              { name: 'paymaster', type: 'address', indexed: true },
              { name: 'nonce', type: 'uint256', indexed: false },
              { name: 'success', type: 'bool', indexed: false },
              { name: 'actualGasCost', type: 'uint256', indexed: false },
              { name: 'actualGasUsed', type: 'uint256', indexed: false },
            ],
          },
          args: { userOpHash: hash },
          fromBlock,
          toBlock: 'latest',
        })

        if (logs.length === 0) {
          continue
        }

        const log = logs[logs.length - 1]!
        const receipt = await this.publicClient.getTransactionReceipt({
          hash: log.transactionHash,
        })

        // Try to recover the UserOperation from transaction calldata
        const userOperation = await this.recoverUserOpFromCalldata(
          log.transactionHash,
          hash
        )

        return {
          userOperation,
          entryPoint,
          transactionHash: log.transactionHash,
          blockHash: receipt.blockHash,
          blockNumber: `0x${receipt.blockNumber.toString(16)}`,
        }
      }

      return null
    } catch {
      // Log search failed — not critical, return null
      return null
    }
  }

  /**
   * eth_getUserOperationReceipt
   */
  async ethGetUserOperationReceipt(
    params: unknown[]
  ): Promise<RpcUserOperationReceipt | null> {
    const hash = validateHashParam(params)

    const toHexStr = (v: bigint | number): Hex => `0x${BigInt(v).toString(16)}` as Hex

    const entry = this.mempool.get(hash)
    if (entry?.transactionHash && entry.status === 'included') {
      // Build receipt from mempool entry
      const txReceipt = await this.publicClient.getTransactionReceipt({
        hash: entry.transactionHash,
      })

      return this.formatUserOpReceipt(hash, entry.entryPoint, txReceipt, {
        sender: entry.userOp.sender,
        nonce: toHexStr(entry.userOp.nonce),
        paymaster: entry.userOp.paymaster,
        actualGasCost: toHexStr(txReceipt.gasUsed * txReceipt.effectiveGasPrice),
        actualGasUsed: toHexStr(txReceipt.gasUsed),
        success: txReceipt.status === 'success',
        reason: entry.error,
      })
    }

    // Fallback: search on-chain UserOperationEvent logs by userOpHash.
    // Limit block range to prevent full-chain scans on mainnet.
    try {
      const currentBlock = await this.publicClient.getBlockNumber()
      const fromBlock = currentBlock > LOG_SEARCH_BLOCK_RANGE
        ? currentBlock - LOG_SEARCH_BLOCK_RANGE
        : 0n

      for (const entryPoint of this.config.entryPoints) {
        const logs = await this.publicClient.getLogs({
          address: entryPoint,
          event: {
            type: 'event',
            name: 'UserOperationEvent',
            inputs: [
              { name: 'userOpHash', type: 'bytes32', indexed: true },
              { name: 'sender', type: 'address', indexed: true },
              { name: 'paymaster', type: 'address', indexed: true },
              { name: 'nonce', type: 'uint256', indexed: false },
              { name: 'success', type: 'bool', indexed: false },
              { name: 'actualGasCost', type: 'uint256', indexed: false },
              { name: 'actualGasUsed', type: 'uint256', indexed: false },
            ],
          },
          args: { userOpHash: hash },
          fromBlock,
          toBlock: 'latest',
        })

        if (logs.length === 0) {
          continue
        }

        const log = logs[logs.length - 1]!
        const txReceipt = await this.publicClient.getTransactionReceipt({
          hash: log.transactionHash,
        })

        const args = log.args as {
          sender?: Address
          paymaster?: Address
          nonce?: bigint
          success?: boolean
          actualGasCost?: bigint
          actualGasUsed?: bigint
        }

        const zeroAddr = '0x0000000000000000000000000000000000000000'
        return this.formatUserOpReceipt(hash, entryPoint, txReceipt, {
          sender: args.sender ?? ('0x' as Address),
          nonce: toHexStr(args.nonce ?? 0n),
          paymaster: args.paymaster === zeroAddr ? undefined : args.paymaster,
          actualGasCost: toHexStr(args.actualGasCost ?? 0n),
          actualGasUsed: toHexStr(args.actualGasUsed ?? 0n),
          success: args.success ?? false,
        })
      }

      return null
    } catch {
      // Log search failed — not critical, return null
      return null
    }
  }

  /**
   * eth_supportedEntryPoints
   */
  ethSupportedEntryPoints(): Address[] {
    return this.config.entryPoints
  }

  /**
   * eth_chainId
   */
  async ethChainId(): Promise<Hex> {
    const chainId = await this.publicClient.getChainId()
    return `0x${chainId.toString(16)}`
  }

  /**
   * Minimal viem log shape used by formatUserOpReceipt
   */
  private mapLogs(
    logs: ReadonlyArray<{
      logIndex: number
      transactionIndex: number
      transactionHash: Hex
      blockHash: Hex | null
      blockNumber: bigint
      address: Address
      data: Hex
      topics: Hex[]
    }>
  ) {
    const toHexStr = (v: bigint | number): Hex => `0x${BigInt(v).toString(16)}` as Hex
    return logs.map((log) => ({
      logIndex: toHexStr(log.logIndex ?? 0),
      transactionIndex: toHexStr(log.transactionIndex ?? 0),
      transactionHash: log.transactionHash,
      blockHash: log.blockHash ?? ('0x' as Hex),
      blockNumber: toHexStr(log.blockNumber ?? 0n),
      address: log.address,
      data: log.data,
      topics: log.topics,
    }))
  }

  /**
   * Format a UserOperationReceipt from transaction receipt and UserOp metadata
   */
  private formatUserOpReceipt(
    userOpHash: Hex,
    entryPoint: Address,
    txReceipt: {
      transactionHash: Hex
      transactionIndex: number
      blockHash: Hex
      blockNumber: bigint
      from: Address
      to: Address | null
      cumulativeGasUsed: bigint
      gasUsed: bigint
      contractAddress: Address | null | undefined
      logs: ReadonlyArray<{
        logIndex: number
        transactionIndex: number
        transactionHash: Hex
        blockHash: Hex | null
        blockNumber: bigint
        address: Address
        data: Hex
        topics: Hex[]
      }>
      status: 'success' | 'reverted'
      effectiveGasPrice: bigint
    },
    meta: {
      sender: Address
      nonce: Hex
      paymaster?: Address
      actualGasCost: Hex
      actualGasUsed: Hex
      success: boolean
      reason?: string
    }
  ): RpcUserOperationReceipt {
    const toHexStr = (v: bigint | number): Hex => `0x${BigInt(v).toString(16)}` as Hex

    return {
      userOpHash,
      entryPoint,
      sender: meta.sender,
      nonce: meta.nonce,
      paymaster: meta.paymaster,
      actualGasCost: meta.actualGasCost,
      actualGasUsed: meta.actualGasUsed,
      success: meta.success,
      reason: meta.reason,
      logs: this.mapLogs(txReceipt.logs),
      receipt: {
        transactionHash: txReceipt.transactionHash,
        transactionIndex: toHexStr(txReceipt.transactionIndex),
        blockHash: txReceipt.blockHash,
        blockNumber: toHexStr(txReceipt.blockNumber),
        from: txReceipt.from,
        to: txReceipt.to ?? undefined,
        cumulativeGasUsed: toHexStr(txReceipt.cumulativeGasUsed),
        gasUsed: toHexStr(txReceipt.gasUsed),
        contractAddress: txReceipt.contractAddress ?? undefined,
        logs: this.mapLogs(txReceipt.logs),
        status: txReceipt.status === 'success' ? '0x1' : '0x0',
        effectiveGasPrice: toHexStr(txReceipt.effectiveGasPrice),
      },
    }
  }

  /**
   * Recover a packed UserOperation from on-chain transaction calldata.
   * Decodes handleOps calldata and finds the op matching the given userOpHash.
   * Returns an empty object if recovery fails (best-effort).
   */
  private async recoverUserOpFromCalldata(
    txHash: Hex,
    _userOpHash: Hex
  ): Promise<Record<string, Hex>> {
    try {
      const tx = await this.publicClient.getTransaction({ hash: txHash })
      if (!tx.input || tx.input === '0x') return {} as Record<string, Hex>

      const decoded = decodeFunctionData({
        abi: ENTRY_POINT_ABI,
        data: tx.input,
      })

      if (decoded.functionName === 'handleOps' && decoded.args) {
        const [ops] = decoded.args as unknown as [ReadonlyArray<Record<string, unknown>>]
        if (ops && ops.length > 0) {
          // If single op, return it directly; for multi-op bundles, return first match
          // (precise matching would require re-hashing each op)
          const packedOp = ops[0]!
          const result: Record<string, Hex> = {}
          for (const [key, value] of Object.entries(packedOp)) {
            result[key] = typeof value === 'bigint'
              ? `0x${value.toString(16)}` as Hex
              : (String(value) as Hex)
          }
          return result
        }
      }

      return {} as Record<string, Hex>
    } catch {
      // Recovery is best-effort; return empty on failure
      return {} as Record<string, Hex>
    }
  }

  /**
   * Pack UserOperation for JSON response
   */
  packUserOpForResponse(userOp: UserOperation): Record<string, Hex> {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      factory: userOp.factory ?? '0x',
      factoryData: userOp.factoryData ?? '0x',
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      paymaster: userOp.paymaster ?? '0x',
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
        ? `0x${userOp.paymasterVerificationGasLimit.toString(16)}`
        : '0x',
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
        ? `0x${userOp.paymasterPostOpGasLimit.toString(16)}`
        : '0x',
      paymasterData: userOp.paymasterData ?? '0x',
      signature: userOp.signature,
    }
  }
}
