import { RpcError } from '@stablenet/types'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { RateLimiter } from './middleware/rateLimiter'
import { getPublicClient, getWalletClient } from './chain/client'
import {
  getAutoDepositConfig,
  getDepositMonitorConfig,
  getReservationPersistenceConfig,
  getServerConfig,
} from './config/constants'
import { DepositMonitor } from './deposit/depositMonitor'
import {
  handleEstimateTokenPayment,
  handleGetPaymasterData,
  handleGetPaymasterStubData,
  handleGetSponsorPolicy,
  handleSupportedTokens,
} from './handlers'
import { SponsorPolicyManager } from './policy/sponsorPolicy'
import {
  estimateTokenPaymentParamsSchema,
  getPaymasterDataParamsSchema,
  getPaymasterStubDataParamsSchema,
  getSponsorPolicyParamsSchema,
  jsonRpcRequestSchema,
  sponsorPolicySchema,
  supportedTokensParamsSchema,
} from './schemas'
import { BundlerClient } from './settlement/bundlerClient'
import { ReservationPersistence } from './settlement/reservationPersistence'
import { ReservationTracker } from './settlement/reservationTracker'
import { SettlementWorker } from './settlement/settlementWorker'
import { PaymasterSigner } from './signer/paymasterSigner'
import type {
  JsonRpcResponse,
  PackedUserOperationRpc,
  PaymasterAddresses,
  PaymasterContext,
  PaymasterProxyConfig,
  PaymasterType,
  UserOperationRpc,
} from './types'
import { RPC_ERROR_CODES } from './types'
import { getGlobalLogger } from './utils/logger'

/** Maximum number of JSON-RPC requests in a single batch */
const MAX_BATCH_SIZE = 50

/**
 * Handler configuration used internally by callMethod
 */
interface HandlerConfig {
  paymasterAddress: Address
  paymasterAddresses: PaymasterAddresses
  signer: PaymasterSigner
  policyManager: SponsorPolicyManager
  supportedChainIds: number[]
  supportedEntryPoints: Address[]
  sponsorName?: string
  client?: PublicClient
  erc20PaymasterAddress?: Address
  oracleAddress?: Address
  reservationTracker?: ReservationTracker
  depositMonitor?: DepositMonitor
}

/**
 * Metrics counters for Prometheus-style endpoint.
 * Simple in-memory counters — keyed by RPC method for observability.
 */
interface MetricsState {
  requestCount: number
  errorCount: number
  methodCounts: Map<string, number>
  methodErrors: Map<string, number>
}

/**
 * Create the Paymaster Proxy application
 */
export function createApp(config: PaymasterProxyConfig): Hono {
  const app = new Hono()
  const log = getGlobalLogger()

  // Initialize components
  const signer = new PaymasterSigner(config.signerPrivateKey, config.paymasterAddress)
  const policyManager = new SponsorPolicyManager()

  // Reservation persistence — load from disk on startup if configured
  const persistenceConfig = getReservationPersistenceConfig()
  const reservationPersistence = persistenceConfig.dataDir
    ? new ReservationPersistence(persistenceConfig.dataDir)
    : undefined
  const reservationTracker = new ReservationTracker(reservationPersistence)
  reservationTracker.loadFromDisk()

  // Phase 2: Settlement worker — graceful degradation when BUNDLER_RPC_URL not set
  let settlementWorker: SettlementWorker | undefined
  if (config.bundlerRpcUrl && config.settlementEnabled !== false) {
    const bundlerClient = new BundlerClient(config.bundlerRpcUrl)
    settlementWorker = new SettlementWorker(reservationTracker, policyManager, bundlerClient, {
      pollIntervalMs: config.settlementPollMs,
    })
    settlementWorker.start()
  }

  // Get sponsor name from environment (configurable via PAYMASTER_SPONSOR_NAME)
  const serverConfig = getServerConfig()

  // Initialize chain client for on-chain reads
  const client = getPublicClient(config.rpcUrl)

  // Deposit monitoring — periodically check paymaster deposits on EntryPoint
  const depositConfig = getDepositMonitorConfig()
  const autoDepositConfig = getAutoDepositConfig()
  // Monitor deposits on all supported EntryPoints (not just the first one)
  let depositMonitor: DepositMonitor | undefined
  const depositMonitors: DepositMonitor[] = []
  if (depositConfig.depositMonitorEnabled && config.supportedEntryPoints.length > 0) {
    const walletClient: WalletClient | undefined = autoDepositConfig.autoDepositEnabled
      ? getWalletClient(config.rpcUrl, config.signerPrivateKey)
      : undefined

    for (const ep of config.supportedEntryPoints) {
      const monitor = new DepositMonitor(
        client,
        {
          entryPoint: ep,
          paymasterAddresses: config.paymasterAddresses,
          minDepositThreshold: depositConfig.depositMinThreshold,
          pollIntervalMs: depositConfig.depositMonitorPollMs,
          rejectOnLowDeposit: depositConfig.depositRejectOnLow,
          autoDepositEnabled: autoDepositConfig.autoDepositEnabled,
          autoDepositAmount: autoDepositConfig.autoDepositAmount,
          autoDepositCooldownMs: autoDepositConfig.autoDepositCooldownMs,
        },
        walletClient
      )
      monitor.start()
      depositMonitors.push(monitor)
    }
    // Primary monitor (first EntryPoint) used for handler config
    depositMonitor = depositMonitors[0]
  }

  // Handler configuration
  const handlerConfig: HandlerConfig = {
    paymasterAddress: config.paymasterAddress,
    paymasterAddresses: config.paymasterAddresses,
    signer,
    policyManager,
    supportedChainIds: config.supportedChainIds,
    supportedEntryPoints: config.supportedEntryPoints,
    sponsorName: serverConfig.sponsorName,
    client,
    erc20PaymasterAddress: config.paymasterAddresses.erc20,
    oracleAddress: config.oracleAddress,
    reservationTracker,
    depositMonitor,
  }

  // Middleware — restrict CORS to configured origins (default: allow all in dev, none in prod)
  const allowedOrigins = process.env.PAYMASTER_CORS_ORIGINS
  app.use(
    '*',
    cors(
      allowedOrigins
        ? { origin: allowedOrigins.split(',').map((o) => o.trim()) }
        : undefined
    )
  )
  // Limit request body size to 1 MB to prevent abuse
  app.use('*', bodyLimit({ maxSize: 1024 * 1024 }))
  if (config.debug) {
    app.use('*', logger())
  }

  // Rate limiting — configurable via env vars (default: 100 req/min per IP)
  const rateLimitMax = Number(process.env.PAYMASTER_RATE_LIMIT_MAX || '100')
  const rateLimitWindowMs = Number(process.env.PAYMASTER_RATE_LIMIT_WINDOW_MS || '60000')
  const rateLimiter = new RateLimiter({
    maxRequests: rateLimitMax,
    windowMs: rateLimitWindowMs,
  })
  app.use('/rpc', rateLimiter.middleware())
  app.use('/', rateLimiter.middleware())

  // Health check endpoints (Kubernetes probes compatible)
  const startTime = new Date()
  app.get('/health', (c) => {
    const availableTypes = Object.keys(config.paymasterAddresses).filter(
      (k) => config.paymasterAddresses[k as PaymasterType]
    )
    const trackerStats = reservationTracker.getStats()
    const workerStats = settlementWorker?.getStats()
    return c.json({
      status: 'ok',
      service: 'paymaster-proxy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor((Date.now() - startTime.getTime()) / 1000)}s`,
      paymaster: config.paymasterAddress,
      paymasterTypes: availableTypes,
      signer: signer.getSignerAddress(),
      supportedChainIds: config.supportedChainIds,
      settlement: {
        enabled: !!settlementWorker,
        pendingReservations: trackerStats.total,
        ...(workerStats
          ? {
              settled: workerStats.settled,
              cancelled: workerStats.cancelled,
              errors: workerStats.errors,
              lastPollAt: workerStats.lastPollAt
                ? new Date(workerStats.lastPollAt).toISOString()
                : null,
            }
          : {}),
      },
      deposit: depositMonitor ? depositMonitor.getStats() : { enabled: false },
    })
  })

  app.get('/ready', (c) => {
    return c.json({
      ready: true,
      service: 'paymaster-proxy',
    })
  })

  app.get('/live', (c) => {
    return c.json({
      alive: true,
      service: 'paymaster-proxy',
    })
  })

  // Prometheus metrics — keyed by method for better observability
  const metrics: MetricsState = {
    requestCount: 0,
    errorCount: 0,
    methodCounts: new Map(),
    methodErrors: new Map(),
  }

  app.get('/metrics', (c) => {
    const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
    const lines: string[] = [
      '# HELP paymaster_proxy_up Service up status',
      '# TYPE paymaster_proxy_up gauge',
      'paymaster_proxy_up{service="paymaster-proxy"} 1',
      '# HELP paymaster_proxy_uptime_seconds Service uptime in seconds',
      '# TYPE paymaster_proxy_uptime_seconds gauge',
      `paymaster_proxy_uptime_seconds{service="paymaster-proxy"} ${uptime}`,
      '# HELP paymaster_proxy_requests_total Total HTTP requests',
      '# TYPE paymaster_proxy_requests_total counter',
      `paymaster_proxy_requests_total{service="paymaster-proxy"} ${metrics.requestCount}`,
      '# HELP paymaster_proxy_errors_total Total HTTP errors',
      '# TYPE paymaster_proxy_errors_total counter',
      `paymaster_proxy_errors_total{service="paymaster-proxy"} ${metrics.errorCount}`,
      '# HELP paymaster_proxy_rpc_method_total RPC requests by method',
      '# TYPE paymaster_proxy_rpc_method_total counter',
    ]

    for (const [method, count] of metrics.methodCounts) {
      lines.push(`paymaster_proxy_rpc_method_total{method="${method}"} ${count}`)
    }

    lines.push('# HELP paymaster_proxy_rpc_method_errors_total RPC errors by method')
    lines.push('# TYPE paymaster_proxy_rpc_method_errors_total counter')
    for (const [method, count] of metrics.methodErrors) {
      lines.push(`paymaster_proxy_rpc_method_errors_total{method="${method}"} ${count}`)
    }

    return c.text(lines.join('\n') + '\n', 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    })
  })

  // Metrics tracking middleware
  app.use('*', async (c, next) => {
    metrics.requestCount++
    await next()
    if (c.res.status >= 400) {
      metrics.errorCount++
    }
  })

  // Admin endpoints always require bearer token authentication.
  // If PAYMASTER_ADMIN_TOKEN is not set, a random token is generated and logged
  // so the operator can use it during development.
  const configuredToken = process.env.PAYMASTER_ADMIN_TOKEN
  let adminToken: string
  if (configuredToken) {
    adminToken = configuredToken
  } else {
    adminToken = crypto.randomUUID()
    const masked = `${adminToken.slice(0, 8)}...`
    log.warn(`No PAYMASTER_ADMIN_TOKEN configured. Generated ephemeral token: ${masked}`)
    log.warn('Set PAYMASTER_ADMIN_TOKEN env var for persistent admin access.')
    if (process.env.NODE_ENV !== 'production') {
      log.warn(`Full ephemeral admin token: ${adminToken}`)
    }
  }
  const auth = bearerAuth({ token: adminToken })
  app.use('/admin/*', auth)

  // Policy management endpoints (admin) - registered after auth middleware
  registerAdminRoutes(app, policyManager)

  // JSON-RPC endpoints — shared handler for both / and /rpc
  const rpcHandler = createRpcHandler(handlerConfig, metrics)
  app.post('/', rpcHandler)
  app.post('/rpc', rpcHandler)

  // Periodic cleanup of expired spending reservations (every 60s)
  // Reservation TTL: 5 minutes (matches SponsorPolicyManager.RESERVATION_TTL_MS)
  const RESERVATION_TTL_MS = 5 * 60 * 1000
  const cleanupInterval = setInterval(() => {
    policyManager.expireReservations()
    reservationTracker.expireOlderThan(RESERVATION_TTL_MS)
  }, 60_000)
  // Allow process to exit without waiting for the interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return app
}

/**
 * Register admin CRUD routes for policy management.
 * All inputs are validated via Zod sponsorPolicySchema.
 */
/** Convert BigInt fields to strings for JSON serialization */
function serializePolicy(policy: object): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(policy)) {
    result[key] = typeof value === 'bigint' ? value.toString() : value
  }
  return result
}

function registerAdminRoutes(adminApp: Hono, policyManager: SponsorPolicyManager): void {
  adminApp.get('/admin/policies', (c) => {
    const policies = policyManager.getAllPolicies().map(serializePolicy)
    return c.json({ policies })
  })

  adminApp.get('/admin/policies/:id', (c) => {
    const policy = policyManager.getPolicy(c.req.param('id'))
    if (!policy) {
      return c.json({ error: `Policy ${c.req.param('id')} not found` }, 404)
    }
    return c.json({ policy: serializePolicy(policy) })
  })

  adminApp.post('/admin/policies', async (c) => {
    const body = await c.req.json()
    const parseResult = sponsorPolicySchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        { error: 'Invalid policy', details: parseResult.error.issues },
        400
      )
    }
    policyManager.setPolicy(parseResult.data as import('./types').SponsorPolicy)
    return c.json({ success: true })
  })

  adminApp.delete('/admin/policies/:id', (c) => {
    const deleted = policyManager.deletePolicy(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: `Policy ${c.req.param('id')} not found` }, 404)
    }
    return c.json({ success: true })
  })
}

/**
 * Create a shared JSON-RPC handler for both / and /rpc endpoints.
 * Enforces batch size limit to prevent resource exhaustion.
 */
function createRpcHandler(
  handlerConfig: HandlerConfig,
  metrics: MetricsState
): (c: { req: { json: () => Promise<unknown> }; json: (data: unknown, status?: number) => Response }) => Promise<Response> {
  return async (c) => {
    const body = await c.req.json()

    if (Array.isArray(body)) {
      if (body.length > MAX_BATCH_SIZE) {
        return c.json(
          {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: RPC_ERROR_CODES.INVALID_REQUEST,
              message: `Batch size ${body.length} exceeds maximum ${MAX_BATCH_SIZE}`,
            },
          },
          400
        )
      }
      const results = await Promise.all(
        body.map((req) => handleJsonRpcRequest(req, handlerConfig, metrics))
      )
      return c.json(results)
    }

    const result = await handleJsonRpcRequest(body, handlerConfig, metrics)
    return c.json(result)
  }
}

/**
 * Handle a single JSON-RPC request
 */
async function handleJsonRpcRequest(
  req: unknown,
  config: HandlerConfig,
  metrics: MetricsState
): Promise<JsonRpcResponse> {
  // Parse request
  const parseResult = jsonRpcRequestSchema.safeParse(req)
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      id: (req as { id?: number | string })?.id ?? (null as unknown as number),
      error: {
        code: RPC_ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid JSON-RPC request',
        data: parseResult.error.issues,
      },
    }
  }

  const { id, method, params } = parseResult.data

  // Track method-level metrics
  metrics.methodCounts.set(method, (metrics.methodCounts.get(method) ?? 0) + 1)

  try {
    const result = await callMethod(method, params, config)
    return { jsonrpc: '2.0', id, result }
  } catch (error) {
    metrics.methodErrors.set(method, (metrics.methodErrors.get(method) ?? 0) + 1)

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

    // In production, hide internal error details to prevent information leakage.
    const isProduction = process.env.NODE_ENV === 'production'
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: RPC_ERROR_CODES.INTERNAL_ERROR,
        message: isProduction
          ? 'Internal error'
          : error instanceof Error
            ? error.message
            : 'Internal error',
      },
    }
  }
}

/**
 * Call an RPC method
 */
async function callMethod(
  method: string,
  params: unknown[],
  config: HandlerConfig
): Promise<unknown> {
  switch (method) {
    case 'pm_getPaymasterStubData':
      return handlePmGetPaymasterStubData(params, config)

    case 'pm_getPaymasterData':
      return handlePmGetPaymasterData(params, config)

    case 'pm_supportedChainIds':
      return config.supportedChainIds

    case 'pm_sponsorUserOperation':
      // Alias for pm_getPaymasterData (for compatibility)
      return handlePmGetPaymasterData(params, config)

    case 'pm_supportedPaymasterTypes':
      return handlePmSupportedPaymasterTypes(config)

    case 'pm_supportedTokens':
      return handlePmSupportedTokens(params, config)

    case 'pm_estimateTokenPayment':
      return handlePmEstimateTokenPayment(params, config)

    case 'pm_getSponsorPolicy':
      return handlePmGetSponsorPolicy(params, config)

    default:
      throw new RpcError(`Method ${method} not found`, RPC_ERROR_CODES.METHOD_NOT_FOUND)
  }
}

/**
 * Handle pm_supportedPaymasterTypes
 */
function handlePmSupportedPaymasterTypes(config: HandlerConfig): string[] {
  return (Object.keys(config.paymasterAddresses) as PaymasterType[]).filter(
    (type) => config.paymasterAddresses[type]
  )
}

/**
 * Handle pm_getPaymasterStubData
 */
function handlePmGetPaymasterStubData(params: unknown[], config: HandlerConfig): unknown {
  const parseResult = getPaymasterStubDataParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [userOp, entryPoint, chainId, context] = parseResult.data

  // Check deposit sufficiency early at stub stage to fail fast
  const stubPaymasterType = (context as PaymasterContext | undefined)?.paymasterType ?? 'verifying'
  const stubTargetPaymaster = config.paymasterAddresses[stubPaymasterType as PaymasterType]
  if (stubTargetPaymaster && config.depositMonitor?.shouldRejectSigning(stubTargetPaymaster)) {
    throw new RpcError(
      `Paymaster ${stubPaymasterType} deposit is below minimum threshold. Please try again later.`,
      RPC_ERROR_CODES.INTERNAL_ERROR
    )
  }

  const result = handleGetPaymasterStubData(
    {
      userOp: userOp as UserOperationRpc | PackedUserOperationRpc,
      entryPoint: entryPoint as Address,
      chainId: chainId as Hex,
      context: context as PaymasterContext | undefined,
    },
    {
      ...config,
    }
  )

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}

/**
 * Handle pm_getPaymasterData
 */
async function handlePmGetPaymasterData(
  params: unknown[],
  config: HandlerConfig
): Promise<unknown> {
  const parseResult = getPaymasterDataParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [userOp, entryPoint, chainId, context] = parseResult.data

  // Check deposit sufficiency before signing (when rejectOnLowDeposit is enabled)
  const paymasterType = (context as PaymasterContext | undefined)?.paymasterType ?? 'verifying'
  const targetPaymaster = config.paymasterAddresses[paymasterType as PaymasterType]
  if (targetPaymaster && config.depositMonitor?.shouldRejectSigning(targetPaymaster)) {
    throw new RpcError(
      `Paymaster ${paymasterType} deposit is below minimum threshold. Please try again later.`,
      RPC_ERROR_CODES.INTERNAL_ERROR
    )
  }

  const result = await handleGetPaymasterData(
    {
      userOp: userOp as UserOperationRpc | PackedUserOperationRpc,
      entryPoint: entryPoint as Address,
      chainId: chainId as Hex,
      context: context as PaymasterContext | undefined,
    },
    {
      ...config,
    }
  )

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}

/**
 * Handle pm_supportedTokens
 */
async function handlePmSupportedTokens(params: unknown[], config: HandlerConfig): Promise<unknown> {
  if (!config.erc20PaymasterAddress) {
    throw new RpcError('ERC20 paymaster not configured', RPC_ERROR_CODES.UNSUPPORTED_PAYMASTER_TYPE)
  }

  if (!config.client) {
    throw new RpcError('Chain client not available', RPC_ERROR_CODES.INTERNAL_ERROR)
  }

  const parseResult = supportedTokensParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [chainId] = parseResult.data

  const result = await handleSupportedTokens(chainId, {
    client: config.client,
    erc20PaymasterAddress: config.erc20PaymasterAddress,
    oracleAddress: config.oracleAddress,
    supportedChainIds: config.supportedChainIds,
  })

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}

/**
 * Handle pm_estimateTokenPayment
 */
async function handlePmEstimateTokenPayment(
  params: unknown[],
  config: HandlerConfig
): Promise<unknown> {
  if (!config.erc20PaymasterAddress) {
    throw new RpcError('ERC20 paymaster not configured', RPC_ERROR_CODES.UNSUPPORTED_PAYMASTER_TYPE)
  }

  if (!config.client) {
    throw new RpcError('Chain client not available', RPC_ERROR_CODES.INTERNAL_ERROR)
  }

  const parseResult = estimateTokenPaymentParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [userOp, entryPoint, chainId, tokenAddress] = parseResult.data

  const result = await handleEstimateTokenPayment(
    userOp as UserOperationRpc | PackedUserOperationRpc,
    entryPoint as Address,
    chainId,
    tokenAddress as Address,
    {
      client: config.client,
      erc20PaymasterAddress: config.erc20PaymasterAddress,
      oracleAddress: config.oracleAddress,
      supportedChainIds: config.supportedChainIds,
      supportedEntryPoints: config.supportedEntryPoints,
    }
  )

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}

/**
 * Handle pm_getSponsorPolicy
 */
function handlePmGetSponsorPolicy(params: unknown[], config: HandlerConfig): unknown {
  const parseResult = getSponsorPolicyParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const parsed = parseResult.data
  // Handle [address, chainId], [address, operation, chainId], and [address, operation, chainId, policyId] forms
  const senderAddress = parsed[0] as Address
  const chainId = parsed.length >= 3 ? (parsed[2] as string) : (parsed[1] as string)
  const policyId = parsed.length === 4 ? (parsed[3] as string) : undefined

  const result = handleGetSponsorPolicy(senderAddress, chainId, {
    policyManager: config.policyManager,
    supportedChainIds: config.supportedChainIds,
  }, policyId)

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}
