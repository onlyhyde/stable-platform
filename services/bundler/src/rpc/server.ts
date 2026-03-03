import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { DEFAULT_CORS_ORIGINS } from '../cli/config'
import { getReputationPersistenceConfig, getServerConfig } from '../config/constants'
import { BundleExecutor } from '../executor/bundleExecutor'
import { GasEstimator } from '../gas/gasEstimator'
import { DependencyTracker } from '../mempool/dependencyTracker'
import { Mempool } from '../mempool/mempool'
import type { BundlerConfig, UserOperation, UserOperationReceipt } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import { AggregatorValidator, UserOperationValidator } from '../validation'
import { ReputationPersistence } from '../validation/reputationPersistence'
import { getUserOperationHash, unpackUserOperation } from './utils'

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
  private reputationPersistence: ReputationPersistence | null = null

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    config: BundlerConfig,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.config = config
    this.logger = logger.child({ module: 'rpc' })

    // Block debug mode in production environment
    if (config.debug && process.env.NODE_ENV === 'production') {
      config.debug = false
      this.logger.warn('Debug mode requested but blocked in production environment (NODE_ENV=production)')
    }

    // Initialize mempool with optional nonce continuity validation
    this.mempool = new Mempool(logger, {
      validateNonceContinuity: config.validateNonceContinuity,
      maxNonceGap: config.mempoolMaxNonceGap,
    })

    // Get the first entry point (validated in config)
    const primaryEntryPoint = config.entryPoints[0]!

    // Initialize gas estimator (using first entry point)
    this.gasEstimator = new GasEstimator(publicClient, primaryEntryPoint, logger)

    // Create aggregator validator when aggregation is enabled
    // (shared between validator pipeline and bundle executor)
    let aggregatorValidator: AggregatorValidator | null = null
    if (config.enableAggregation) {
      aggregatorValidator = new AggregatorValidator(publicClient, primaryEntryPoint, logger)
    }

    // Initialize validator using factory method (DI pattern)
    this.validator = UserOperationValidator.create(
      publicClient,
      {
        entryPoint: primaryEntryPoint,
        skipSimulation: config.debug, // Skip simulation in debug mode for easier testing
        skipOpcodeValidation: config.enableOpcodeValidation === false || config.debug,
        maxNonceGap: config.maxNonceGap,
        minValidUntilBuffer: config.minValidUntilBuffer,
        enableAggregation: config.enableAggregation,
      },
      logger,
      aggregatorValidator ?? undefined
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

    // Wire storage conflict detection when opcode validation is enabled
    // (traces are available only when opcode validation runs)
    if (config.enableOpcodeValidation !== false && !config.debug) {
      const dependencyTracker = new DependencyTracker(logger)
      this.executor.setDependencyTracker(dependencyTracker)
    }

    // Wire aggregator validator to executor for bundle submission
    if (aggregatorValidator) {
      this.executor.setAggregatorValidator(aggregatorValidator)
    }

    // Warn when debug mode is enabled — it bypasses critical security checks
    if (config.debug) {
      this.logger.warn(
        {
          corsAllowAll: true,
          skipSimulation: !!config.debug,
          skipOpcodeValidation: config.enableOpcodeValidation === false || !!config.debug,
          exposeErrorDetails: true,
        },
        'DEBUG MODE ENABLED: CORS allows all origins, simulation/opcode validation bypassed, internal error details exposed to clients. Do NOT use in production.'
      )
    }

    // Get server config from environment
    const serverConfig = getServerConfig()

    // Initialize Fastify with body size limit (configurable via BUNDLER_BODY_LIMIT)
    this.app = Fastify({
      logger: false, // We use our own logger
      bodyLimit: serverConfig.bodyLimit, // Default: 1MB - sufficient for UserOperation batches
    })
  }

  /**
   * Initialize server (async initialization for plugins)
   */
  private async initialize(): Promise<void> {
    await this.setupRoutes()
  }

  /**
   * Setup routes
   */
  private async setupRoutes(): Promise<void> {
    // Get server config for rate limiting (configurable via BUNDLER_RATE_LIMIT_*)
    const serverConfig = getServerConfig()

    // Rate limiting: configurable max requests per window per IP
    await this.app.register(rateLimit, {
      max: serverConfig.rateLimitMax, // Default: 100 requests
      timeWindow: serverConfig.rateLimitWindowMs, // Default: 60000ms (1 minute)
      errorResponseBuilder: () => ({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32005,
          message: 'Rate limit exceeded. Please slow down.',
        },
      }),
    })

    // Enable CORS with origin whitelist
    // In debug mode: allow all origins for easier testing
    // In production: only allow configured origins (default: localhost)
    const corsOrigin = this.config.debug
      ? true // Allow all origins in debug mode
      : this.config.corsOrigins && this.config.corsOrigins.length > 0
        ? this.config.corsOrigins.includes('*')
          ? true // Explicit wildcard
          : this.config.corsOrigins // Whitelist
        : [...DEFAULT_CORS_ORIGINS] // Default: localhost only

    await this.app.register(cors, { origin: corsOrigin })

    // Health check endpoints (Kubernetes probes compatible)
    const startTime = new Date()
    this.app.get('/health', async () => ({
      status: 'ok',
      service: 'bundler',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor((Date.now() - startTime.getTime()) / 1000)}s`,
      mempool: {
        size: this.mempool.size,
        pending: this.mempool.pendingCount,
      },
    }))

    this.app.get('/ready', async () => ({
      ready: true,
      service: 'bundler',
    }))

    this.app.get('/live', async () => ({
      alive: true,
      service: 'bundler',
    }))

    // Prometheus metrics endpoint
    let requestCount = 0
    let errorCount = 0
    this.app.get('/metrics', async () => {
      const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
      return `# HELP bundler_up Service up status
# TYPE bundler_up gauge
bundler_up{service="bundler"} 1
# HELP bundler_uptime_seconds Service uptime in seconds
# TYPE bundler_uptime_seconds gauge
bundler_uptime_seconds{service="bundler"} ${uptime}
# HELP bundler_requests_total Total HTTP requests
# TYPE bundler_requests_total counter
bundler_requests_total{service="bundler"} ${requestCount}
# HELP bundler_errors_total Total HTTP errors
# TYPE bundler_errors_total counter
bundler_errors_total{service="bundler"} ${errorCount}
# HELP bundler_mempool_size Current mempool size
# TYPE bundler_mempool_size gauge
bundler_mempool_size{service="bundler"} ${this.mempool.size}
# HELP bundler_mempool_pending Pending operations in mempool
# TYPE bundler_mempool_pending gauge
bundler_mempool_pending{service="bundler"} ${this.mempool.pendingCount}
`
    })

    // Metrics tracking hook
    this.app.addHook('onResponse', (_request, reply, done) => {
      requestCount++
      if (reply.statusCode >= 400) {
        errorCount++
      }
      done()
    })

    // JSON-RPC endpoint
    this.app.post('/', async (request, reply) => {
      const body = request.body as JsonRpcRequest | JsonRpcRequest[]

      // Handle batch requests
      if (Array.isArray(body)) {
        const results = await Promise.all(body.map((req) => this.handleRequest(req)))
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

      // In production, mask internal error details to prevent information leakage
      // Only show generic message; detailed errors are logged server-side
      const errorMessage = this.config.debug
        ? error instanceof Error
          ? error.message
          : 'Internal error'
        : 'An internal error occurred. Please try again later.'

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: RPC_ERROR_CODES.INTERNAL_ERROR,
          message: errorMessage,
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

      case 'debug_bundler_getUserOperationStatus':
        return this.debugGetUserOperationStatus(params)

      default:
        throw new RpcError(`Method ${method} not found`, RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }
  }

  /**
   * eth_sendUserOperation
   */
  private async ethSendUserOperation(params: unknown[]): Promise<Hex> {
    const [packedOp, entryPoint] = params as [Record<string, Hex>, Address]

    // Validate entry point (case-insensitive address comparison)
    const entryPointLower = entryPoint.toLowerCase()
    const matchedEntryPoint = this.config.entryPoints.find(
      (ep) => ep.toLowerCase() === entryPointLower
    )
    if (!matchedEntryPoint) {
      throw new RpcError(`EntryPoint ${entryPoint} not supported`, RPC_ERROR_CODES.INVALID_PARAMS)
    }

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
  private async ethEstimateUserOperationGas(params: unknown[]): Promise<{
    preVerificationGas: Hex
    verificationGasLimit: Hex
    callGasLimit: Hex
    paymasterVerificationGasLimit?: Hex
    paymasterPostOpGasLimit?: Hex
  }> {
    const [packedOp, entryPoint] = params as [Record<string, Hex>, Address]

    // Validate entry point (case-insensitive address comparison)
    const entryPointLower = entryPoint.toLowerCase()
    if (!this.config.entryPoints.some((ep) => ep.toLowerCase() === entryPointLower)) {
      throw new RpcError(`EntryPoint ${entryPoint} not supported`, RPC_ERROR_CODES.INVALID_PARAMS)
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
    // This covers operations that have left the in-memory mempool.
    try {
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
          fromBlock: 'earliest',
          toBlock: 'latest',
        })

        if (logs.length === 0) {
          continue
        }

        const log = logs[logs.length - 1]!
        const receipt = await this.publicClient.getTransactionReceipt({
          hash: log.transactionHash,
        })

        return {
          userOperation: {} as Record<string, Hex>,
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
  private async ethGetUserOperationReceipt(
    params: unknown[]
  ): Promise<UserOperationReceipt | null> {
    const [hash] = params as [Hex]

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
    // This covers operations that have left the in-memory mempool (e.g., after restart).
    try {
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
          fromBlock: 'earliest',
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
   * Format a UserOperationReceipt from transaction receipt and UserOp metadata
   */
  // biome-ignore lint/suspicious/noExplicitAny: viem log types are complex
  private formatUserOpReceipt(
    userOpHash: Hex,
    entryPoint: Address,
    txReceipt: any,
    meta: {
      sender: Address
      nonce: Hex
      paymaster?: Address
      actualGasCost: Hex
      actualGasUsed: Hex
      success: boolean
      reason?: string
    }
  ): UserOperationReceipt {
    const toHexStr = (v: bigint | number): Hex => `0x${BigInt(v).toString(16)}` as Hex
    // biome-ignore lint/suspicious/noExplicitAny: viem log types are complex
    const mapLogs = (logs: any[]) =>
      logs.map((log: any) => ({
        logIndex: toHexStr(log.logIndex ?? 0),
        transactionIndex: toHexStr(log.transactionIndex ?? 0),
        transactionHash: log.transactionHash,
        blockHash: log.blockHash ?? ('0x' as Hex),
        blockNumber: toHexStr(log.blockNumber ?? 0n),
        address: log.address,
        data: log.data,
        topics: log.topics as Hex[],
      }))

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
      logs: mapLogs(txReceipt.logs),
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
        logs: mapLogs(txReceipt.logs),
        status: txReceipt.status === 'success' ? '0x1' : '0x0',
        effectiveGasPrice: toHexStr(txReceipt.effectiveGasPrice),
      },
    } as unknown as UserOperationReceipt
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
      .filter((e) => !entryPoint || e.entryPoint.toLowerCase() === entryPoint.toLowerCase())
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
      }>,
    ]

    const reputationManager = this.validator.getReputationManager()
    for (const entry of entries) {
      reputationManager.setReputation(entry.address, entry.opsSeen, entry.opsIncluded, entry.status)
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
   * debug_bundler_getUserOperationStatus
   * Returns the current status of a UserOperation in the mempool.
   */
  private debugGetUserOperationStatus(
    params: unknown[]
  ): { status: string; error?: string } | null {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }

    const [hash] = params as [Hex]

    const entry = this.mempool.get(hash)
    if (!entry) {
      return null
    }

    return {
      status: entry.status,
      error: entry.error,
    }
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
    // Initialize plugins and routes
    await this.initialize()

    // Load and start reputation persistence if enabled
    const persistenceConfig = getReputationPersistenceConfig()
    if (persistenceConfig.enabled) {
      const reputationManager = this.validator.getReputationManager()
      this.reputationPersistence = new ReputationPersistence(persistenceConfig, this.logger)
      this.reputationPersistence.load(reputationManager)
      this.reputationPersistence.startPeriodicSave(reputationManager)
    }

    // Start bundle executor
    this.executor.start()

    // Start HTTP server
    await this.app.listen({ port: this.config.port, host: '0.0.0.0' })
    this.logger.info({ port: this.config.port }, 'Bundler RPC server started')
  }

  /**
   * Get the actual bound port (useful when started with port 0)
   */
  getPort(): number {
    const addresses = this.app.addresses()
    if (addresses.length > 0) {
      return addresses[0]!.port
    }
    return this.config.port
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Flush reputation to disk before shutdown
    if (this.reputationPersistence) {
      const reputationManager = this.validator.getReputationManager()
      this.reputationPersistence.stop(reputationManager)
    }

    this.executor.stop()
    await this.app.close()
    this.logger.info('Bundler RPC server stopped')
  }
}
