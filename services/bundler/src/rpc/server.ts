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
import type { BundlerConfig } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'
import { AggregatorValidator, UserOperationValidator } from '../validation'
import { ReputationPersistence } from '../validation/reputationPersistence'
import { DebugHandlers } from './debugHandlers'
import { EthHandlers } from './ethHandlers'

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

/** Maximum batch size for JSON-RPC batch requests */
const MAX_BATCH_SIZE = 100

/**
 * Validate a JSON-RPC request structure
 */
function isValidJsonRpcRequest(body: unknown): body is JsonRpcRequest {
  if (typeof body !== 'object' || body === null) return false
  const req = body as Record<string, unknown>
  return (
    req.jsonrpc === '2.0' &&
    (typeof req.id === 'number' || typeof req.id === 'string') &&
    typeof req.method === 'string'
  )
}

/**
 * RPC Server for ERC-4337 Bundler
 */
export class RpcServer {
  private app: FastifyInstance
  private mempool: Mempool
  private executor: BundleExecutor
  private config: BundlerConfig
  private logger: Logger
  private validator: UserOperationValidator
  private debugHandlers: DebugHandlers
  private ethHandlers: EthHandlers
  private reputationPersistence: ReputationPersistence | null = null
  private requestCount = 0
  private errorCount = 0

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    config: BundlerConfig,
    logger: Logger
  ) {
    this.logger = logger.child({ module: 'rpc' })

    // Block debug mode in production environment (immutable — never mutate caller's config)
    const effectiveDebug =
      config.debug && process.env.NODE_ENV === 'production' ? false : config.debug
    if (config.debug && !effectiveDebug) {
      this.logger.warn(
        'Debug mode requested but blocked in production environment (NODE_ENV=production)'
      )
    }
    this.config = { ...config, debug: effectiveDebug }

    // Initialize mempool with optional nonce continuity validation
    this.mempool = new Mempool(logger, {
      validateNonceContinuity: config.validateNonceContinuity,
      maxNonceGap: config.mempoolMaxNonceGap,
    })

    // Get the first entry point (validated in config)
    const primaryEntryPoint = config.entryPoints[0]!

    // Initialize gas estimator (using first entry point)
    const gasEstimator = new GasEstimator(publicClient, primaryEntryPoint, logger)

    // Create aggregator validator when aggregation is enabled
    // (shared between validator pipeline and bundle executor)
    let aggregatorValidator: AggregatorValidator | null = null
    if (config.enableAggregation) {
      aggregatorValidator = new AggregatorValidator(publicClient, primaryEntryPoint, logger)
    }

    // Initialize validator using factory method (DI pattern)
    const validator = UserOperationValidator.create(
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

    this.validator = validator

    // Initialize bundle executor
    this.executor = new BundleExecutor(
      publicClient,
      walletClient,
      this.mempool,
      validator,
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

    // Initialize eth_ handlers
    this.ethHandlers = new EthHandlers(
      publicClient,
      this.mempool,
      validator,
      gasEstimator,
      config,
      this.logger
    )

    // Initialize debug handlers
    this.debugHandlers = new DebugHandlers(
      this.mempool,
      validator,
      config,
      this.ethHandlers.packUserOpForResponse.bind(this.ethHandlers)
    )

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
    // CORS configuration
    const corsOrigins = this.config.debug
      ? true // Allow all origins in debug mode
      : this.config.corsOrigins ?? [...DEFAULT_CORS_ORIGINS]

    await this.app.register(cors, {
      origin: corsOrigins,
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })

    // Rate limiting
    await this.app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })

    const startTime = new Date()

    // Health endpoint
    this.app.get('/health', async () => ({
      status: 'ok',
      service: 'bundler',
      uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
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
bundler_requests_total{service="bundler"} ${this.requestCount}
# HELP bundler_errors_total Total HTTP errors
# TYPE bundler_errors_total counter
bundler_errors_total{service="bundler"} ${this.errorCount}
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
      this.requestCount++
      if (reply.statusCode >= 400) {
        this.errorCount++
      }
      done()
    })

    // JSON-RPC endpoint
    this.app.post('/', async (request, reply) => {
      const body = request.body

      // Handle batch requests
      if (Array.isArray(body)) {
        if (body.length > MAX_BATCH_SIZE) {
          return reply.send({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: RPC_ERROR_CODES.INVALID_REQUEST,
              message: `Batch size ${body.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
            },
          })
        }
        const results = await Promise.all(
          body.map((req) => {
            if (!isValidJsonRpcRequest(req)) {
              return {
                jsonrpc: '2.0' as const,
                id: (req as Record<string, unknown>)?.id ?? null,
                error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON-RPC request' },
              }
            }
            return this.handleRequest(req)
          })
        )
        return reply.send(results)
      }

      // Validate single request
      if (!isValidJsonRpcRequest(body)) {
        return reply.send({
          jsonrpc: '2.0',
          id: (body as Record<string, unknown>)?.id ?? null,
          error: {
            code: RPC_ERROR_CODES.INVALID_REQUEST,
            message: 'Invalid JSON-RPC request: missing or invalid jsonrpc, id, or method',
          },
        })
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
        return this.ethHandlers.ethSendUserOperation(params)

      case 'eth_estimateUserOperationGas':
        return this.ethHandlers.ethEstimateUserOperationGas(params)

      case 'eth_getUserOperationByHash':
        return this.ethHandlers.ethGetUserOperationByHash(params)

      case 'eth_getUserOperationReceipt':
        return this.ethHandlers.ethGetUserOperationReceipt(params)

      case 'eth_supportedEntryPoints':
        return this.ethHandlers.ethSupportedEntryPoints()

      case 'eth_chainId':
        return this.ethHandlers.ethChainId()

      case 'debug_bundler_clearState':
        return this.debugHandlers.clearState()

      case 'debug_bundler_dumpMempool':
        return this.debugHandlers.dumpMempool(params)

      case 'debug_bundler_setReputation':
        return this.debugHandlers.setReputation(params)

      case 'debug_bundler_dumpReputation':
        return this.debugHandlers.dumpReputation(params)

      case 'debug_bundler_clearReputation':
        return this.debugHandlers.clearReputation()

      case 'debug_bundler_getUserOperationStatus':
        return this.debugHandlers.getUserOperationStatus(params)

      default:
        throw new RpcError(`Method ${method} not found`, RPC_ERROR_CODES.METHOD_NOT_FOUND)
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
