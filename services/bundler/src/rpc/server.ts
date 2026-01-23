import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import type { BundlerConfig, UserOperation, UserOperationReceipt } from '../types'
import { RpcError, RPC_ERROR_CODES } from '../types'
import { Mempool } from '../mempool/mempool'
import { GasEstimator } from '../gas/gasEstimator'
import { BundleExecutor } from '../executor/bundleExecutor'
import { UserOperationValidator } from '../validation'
import type { Logger } from '../utils/logger'
import { unpackUserOperation, getUserOperationHash } from './utils'

/**
 * JSON-RPC request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown[]
}

/**
 * JSON-RPC response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * RPC Server for ERC-4337 Bundler
 */
export class RpcServer {
  private app: FastifyInstance
  private mempool: Mempool
  private gasEstimator: GasEstimator
  private executor: BundleExecutor
  private validator: UserOperationValidator
  private config: BundlerConfig
  private publicClient: PublicClient
  private logger: Logger

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    config: BundlerConfig,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.config = config
    this.logger = logger.child({ module: 'rpc' })

    // Initialize mempool with optional nonce continuity validation
    this.mempool = new Mempool(logger, {
      validateNonceContinuity: config.validateNonceContinuity,
      maxNonceGap: config.mempoolMaxNonceGap,
    })

    // Get the first entry point (validated in config)
    const primaryEntryPoint = config.entryPoints[0]!

    // Initialize gas estimator (using first entry point)
    this.gasEstimator = new GasEstimator(
      publicClient,
      primaryEntryPoint,
      logger
    )

    // Initialize validator using factory method (DI pattern)
    this.validator = UserOperationValidator.create(
      publicClient,
      {
        entryPoint: primaryEntryPoint,
        skipSimulation: config.debug, // Skip simulation in debug mode for easier testing
        maxNonceGap: config.maxNonceGap,
        minValidUntilBuffer: config.minValidUntilBuffer,
      },
      logger
    )

    // Initialize bundle executor
    this.executor = new BundleExecutor(
      publicClient,
      walletClient,
      this.mempool,
      this.validator,
      {
        entryPoint: primaryEntryPoint,
        beneficiary: config.beneficiary,
        maxBundleSize: config.maxBundleSize,
        bundleInterval: config.bundleInterval,
      },
      logger
    )

    // Initialize Fastify
    this.app = Fastify({
      logger: false, // We use our own logger
    })

    this.setupRoutes()
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Enable CORS
    this.app.register(cors, { origin: true })

    // Health check
    this.app.get('/health', async () => ({
      status: 'ok',
      mempool: {
        size: this.mempool.size,
        pending: this.mempool.pendingCount,
      },
    }))

    // JSON-RPC endpoint
    this.app.post('/', async (request, reply) => {
      const body = request.body as JsonRpcRequest | JsonRpcRequest[]

      // Handle batch requests
      if (Array.isArray(body)) {
        const results = await Promise.all(
          body.map((req) => this.handleRequest(req))
        )
        return reply.send(results)
      }

      const result = await this.handleRequest(body)
      return reply.send(result)
    })
  }

  /**
   * Handle a single JSON-RPC request
   */
  private async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params = [] } = req

    this.logger.debug({ method, params }, 'RPC request')

    try {
      const result = await this.callMethod(method, params)
      return { jsonrpc: '2.0', id, result }
    } catch (error) {
      if (error instanceof RpcError) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: error.code,
            message: error.message,
            data: error.data,
          },
        }
      }

      this.logger.error({ error, method }, 'RPC method error')

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: RPC_ERROR_CODES.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }
    }
  }

  /**
   * Call an RPC method
   */
  private async callMethod(method: string, params: unknown[]): Promise<unknown> {
    switch (method) {
      case 'eth_sendUserOperation':
        return this.ethSendUserOperation(params)

      case 'eth_estimateUserOperationGas':
        return this.ethEstimateUserOperationGas(params)

      case 'eth_getUserOperationByHash':
        return this.ethGetUserOperationByHash(params)

      case 'eth_getUserOperationReceipt':
        return this.ethGetUserOperationReceipt(params)

      case 'eth_supportedEntryPoints':
        return this.ethSupportedEntryPoints()

      case 'eth_chainId':
        return this.ethChainId()

      case 'debug_bundler_clearState':
        return this.debugClearState()

      case 'debug_bundler_dumpMempool':
        return this.debugDumpMempool(params)

      case 'debug_bundler_setReputation':
        return this.debugSetReputation(params)

      case 'debug_bundler_dumpReputation':
        return this.debugDumpReputation(params)

      case 'debug_bundler_clearReputation':
        return this.debugClearReputation()

      default:
        throw new RpcError(
          `Method ${method} not found`,
          RPC_ERROR_CODES.METHOD_NOT_FOUND
        )
    }
  }

  /**
   * eth_sendUserOperation
   */
  private async ethSendUserOperation(params: unknown[]): Promise<Hex> {
    const [packedOp, entryPoint] = params as [Record<string, Hex>, Address]

    // Validate entry point
    if (!this.config.entryPoints.includes(entryPoint)) {
      throw new RpcError(
        `EntryPoint ${entryPoint} not supported`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Unpack UserOperation
    const userOp = unpackUserOperation(packedOp)

    // Calculate hash
    const chainId = BigInt(await this.publicClient.getChainId())
    const userOpHash = getUserOperationHash(userOp, entryPoint, chainId)

    // Validate UserOperation (format, reputation, state, simulation)
    await this.validator.validate(userOp)

    // Add to mempool
    this.mempool.add(userOp, userOpHash, entryPoint)

    this.logger.info({ userOpHash, sender: userOp.sender }, 'UserOperation received and validated')

    return userOpHash
  }

  /**
   * eth_estimateUserOperationGas
   */
  private async ethEstimateUserOperationGas(
    params: unknown[]
  ): Promise<{
    preVerificationGas: Hex
    verificationGasLimit: Hex
    callGasLimit: Hex
    paymasterVerificationGasLimit?: Hex
    paymasterPostOpGasLimit?: Hex
  }> {
    const [packedOp, entryPoint] = params as [Record<string, Hex>, Address]

    // Validate entry point
    if (!this.config.entryPoints.includes(entryPoint)) {
      throw new RpcError(
        `EntryPoint ${entryPoint} not supported`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

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
  private async ethGetUserOperationByHash(params: unknown[]): Promise<{
    userOperation: Record<string, Hex>
    entryPoint: Address
    transactionHash: Hex
    blockHash: Hex
    blockNumber: Hex
  } | null> {
    const [hash] = params as [Hex]

    const entry = this.mempool.get(hash)
    if (!entry || !entry.transactionHash) {
      return null
    }

    // Get transaction receipt
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

  /**
   * eth_getUserOperationReceipt
   */
  private async ethGetUserOperationReceipt(
    params: unknown[]
  ): Promise<UserOperationReceipt | null> {
    const [hash] = params as [Hex]

    const entry = this.mempool.get(hash)
    if (!entry || !entry.transactionHash || entry.status !== 'included') {
      return null
    }

    // Get transaction receipt
    const txReceipt = await this.publicClient.getTransactionReceipt({
      hash: entry.transactionHash,
    })

    return {
      userOpHash: hash,
      entryPoint: entry.entryPoint,
      sender: entry.userOp.sender,
      nonce: entry.userOp.nonce,
      paymaster: entry.userOp.paymaster,
      actualGasCost: txReceipt.gasUsed * txReceipt.effectiveGasPrice,
      actualGasUsed: txReceipt.gasUsed,
      success: txReceipt.status === 'success',
      reason: entry.error,
      logs: txReceipt.logs.map((log) => ({
        logIndex: log.logIndex ?? 0,
        transactionIndex: log.transactionIndex ?? 0,
        transactionHash: log.transactionHash,
        blockHash: log.blockHash ?? '0x',
        blockNumber: log.blockNumber ?? 0n,
        address: log.address,
        data: log.data,
        topics: log.topics as Hex[],
      })),
      receipt: {
        transactionHash: txReceipt.transactionHash,
        transactionIndex: txReceipt.transactionIndex,
        blockHash: txReceipt.blockHash,
        blockNumber: txReceipt.blockNumber,
        from: txReceipt.from,
        to: txReceipt.to ?? undefined,
        cumulativeGasUsed: txReceipt.cumulativeGasUsed,
        gasUsed: txReceipt.gasUsed,
        contractAddress: txReceipt.contractAddress ?? undefined,
        logs: txReceipt.logs.map((log) => ({
          logIndex: log.logIndex ?? 0,
          transactionIndex: log.transactionIndex ?? 0,
          transactionHash: log.transactionHash,
          blockHash: log.blockHash ?? '0x',
          blockNumber: log.blockNumber ?? 0n,
          address: log.address,
          data: log.data,
          topics: log.topics as Hex[],
        })),
        status: txReceipt.status,
        effectiveGasPrice: txReceipt.effectiveGasPrice,
      },
    }
  }

  /**
   * eth_supportedEntryPoints
   */
  private ethSupportedEntryPoints(): Address[] {
    return this.config.entryPoints
  }

  /**
   * eth_chainId
   */
  private async ethChainId(): Promise<Hex> {
    const chainId = await this.publicClient.getChainId()
    return `0x${chainId.toString(16)}`
  }

  /**
   * debug_bundler_clearState
   */
  private debugClearState(): { success: boolean } {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }
    this.mempool.clear()
    return { success: true }
  }

  /**
   * debug_bundler_dumpMempool
   */
  private debugDumpMempool(params: unknown[]): unknown[] {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }
    const [entryPoint] = params as [Address]
    const entries = this.mempool.dump()
    return entries
      .filter((e) => !entryPoint || e.entryPoint === entryPoint)
      .map((e) => ({
        userOp: this.packUserOpForResponse(e.userOp),
        userOpHash: e.userOpHash,
        status: e.status,
      }))
  }

  /**
   * debug_bundler_setReputation
   */
  private debugSetReputation(params: unknown[]): { success: boolean } {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }

    const [entries] = params as [
      Array<{
        address: Address
        opsSeen: number
        opsIncluded: number
        status?: 'ok' | 'throttled' | 'banned'
      }>
    ]

    const reputationManager = this.validator.getReputationManager()
    for (const entry of entries) {
      reputationManager.setReputation(
        entry.address,
        entry.opsSeen,
        entry.opsIncluded,
        entry.status
      )
    }

    return { success: true }
  }

  /**
   * debug_bundler_dumpReputation
   */
  private debugDumpReputation(params: unknown[]): unknown[] {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }

    const [_entryPoint] = params as [Address | undefined]
    // EntryPoint parameter is ignored since reputation is global
    // but we accept it for API compatibility (unused intentionally)

    const reputationManager = this.validator.getReputationManager()
    return reputationManager.dump().map((entry) => ({
      address: entry.address,
      opsSeen: entry.opsSeen,
      opsIncluded: entry.opsIncluded,
      status: entry.status,
    }))
  }

  /**
   * debug_bundler_clearReputation
   */
  private debugClearReputation(): { success: boolean } {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }

    this.validator.clearAllReputation()
    return { success: true }
  }

  /**
   * Pack UserOperation for JSON response
   */
  private packUserOpForResponse(userOp: UserOperation): Record<string, Hex> {
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

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Start bundle executor
    this.executor.start()

    // Start HTTP server
    await this.app.listen({ port: this.config.port, host: '0.0.0.0' })
    this.logger.info({ port: this.config.port }, 'Bundler RPC server started')
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.executor.stop()
    await this.app.close()
    this.logger.info('Bundler RPC server stopped')
  }
}
