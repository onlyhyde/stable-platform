import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { getPublicClient, getWalletClient } from './chain/client'
import { getAutoDepositConfig, getDepositMonitorConfig, getReservationPersistenceConfig, getServerConfig } from './config/constants'
import { DepositMonitor } from './deposit/depositMonitor'
import {
  handleEstimateTokenPayment,
  handleGetPaymasterData,
  handleGetPaymasterStubData,
  handleGetSponsorPolicy,
  handleSupportedTokens,
} from './handlers'
import { SponsorPolicyManager } from './policy/sponsorPolicy'
import { BundlerClient } from './settlement/bundlerClient'
import { ReservationPersistence } from './settlement/reservationPersistence'
import { ReservationTracker } from './settlement/reservationTracker'
import { SettlementWorker } from './settlement/settlementWorker'
import {
  estimateTokenPaymentParamsSchema,
  getPaymasterDataParamsSchema,
  getPaymasterStubDataParamsSchema,
  getSponsorPolicyParamsSchema,
  jsonRpcRequestSchema,
  supportedTokensParamsSchema,
} from './schemas'
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
 * Create the Paymaster Proxy application
 */
export function createApp(config: PaymasterProxyConfig): Hono {
  const app = new Hono()

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
    settlementWorker = new SettlementWorker(
      reservationTracker,
      policyManager,
      bundlerClient,
      { pollIntervalMs: config.settlementPollMs }
    )
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

  // Middleware
  app.use('*', cors())
  // Limit request body size to 1 MB to prevent abuse
  app.use('*', bodyLimit({ maxSize: 1024 * 1024 }))
  if (config.debug) {
    app.use('*', logger())
  }

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
      deposit: depositMonitor
        ? depositMonitor.getStats()
        : { enabled: false },
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

  // Prometheus metrics endpoint
  let requestCount = 0
  let errorCount = 0
  app.get('/metrics', (c) => {
    const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
    return c.text(
      `# HELP paymaster_proxy_up Service up status
# TYPE paymaster_proxy_up gauge
paymaster_proxy_up{service="paymaster-proxy"} 1
# HELP paymaster_proxy_uptime_seconds Service uptime in seconds
# TYPE paymaster_proxy_uptime_seconds gauge
paymaster_proxy_uptime_seconds{service="paymaster-proxy"} ${uptime}
# HELP paymaster_proxy_requests_total Total HTTP requests
# TYPE paymaster_proxy_requests_total counter
paymaster_proxy_requests_total{service="paymaster-proxy"} ${requestCount}
# HELP paymaster_proxy_errors_total Total HTTP errors
# TYPE paymaster_proxy_errors_total counter
paymaster_proxy_errors_total{service="paymaster-proxy"} ${errorCount}
`,
      200,
      { 'Content-Type': 'text/plain; charset=utf-8' }
    )
  })

  // Metrics tracking middleware
  app.use('*', async (c, next) => {
    requestCount++
    await next()
    if (c.res.status >= 400) {
      errorCount++
    }
  })

  // Policy management endpoints (admin) - require bearer token authentication
  function registerAdminRoutes(adminApp: Hono) {
    adminApp.get('/admin/policies', (c) => {
      const policies = policyManager.getAllPolicies()
      return c.json({ policies })
    })

    adminApp.get('/admin/policies/:id', (c) => {
      const policy = policyManager.getPolicy(c.req.param('id'))
      if (!policy) {
        return c.json({ error: `Policy ${c.req.param('id')} not found` }, 404)
      }
      return c.json({ policy })
    })

    adminApp.post('/admin/policies', async (c) => {
      const body = await c.req.json()
      policyManager.setPolicy(body)
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

  // Admin endpoints always require bearer token authentication.
  // If PAYMASTER_ADMIN_TOKEN is not set, a random token is generated and logged
  // so the operator can use it during development.
  const configuredToken = process.env.PAYMASTER_ADMIN_TOKEN
  let adminToken: string
  if (configuredToken) {
    adminToken = configuredToken
  } else {
    adminToken = crypto.randomUUID()
    // Mask token in logs: show only first 8 chars to aid debugging without full exposure
    const masked = `${adminToken.slice(0, 8)}...`
    console.warn(
      `[paymaster-proxy] No PAYMASTER_ADMIN_TOKEN configured. Generated ephemeral token: ${masked}`
    )
    console.warn(
      '[paymaster-proxy] Set PAYMASTER_ADMIN_TOKEN env var for persistent admin access.'
    )
    // In development, log the full token to stderr so operator can use it
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[paymaster-proxy] Full ephemeral admin token: ${adminToken}`)
    }
  }
  const auth = bearerAuth({ token: adminToken })
  app.use('/admin/*', auth)
  registerAdminRoutes(app)

  // JSON-RPC endpoint
  app.post('/', async (c) => {
    const body = await c.req.json()

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => handleJsonRpcRequest(req, handlerConfig)))
      return c.json(results)
    }

    const result = await handleJsonRpcRequest(body, handlerConfig)
    return c.json(result)
  })

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

  // Also support /rpc path
  app.post('/rpc', async (c) => {
    const body = await c.req.json()

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => handleJsonRpcRequest(req, handlerConfig)))
      return c.json(results)
    }

    const result = await handleJsonRpcRequest(body, handlerConfig)
    return c.json(result)
  })

  return app
}

/**
 * Handle a single JSON-RPC request
 */
async function handleJsonRpcRequest(
  req: unknown,
  config: HandlerConfig
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

  try {
    const result = await callMethod(method, params, config)
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

    // In production, hide internal error details to prevent information leakage.
    const isProduction = process.env.NODE_ENV === 'production'
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: RPC_ERROR_CODES.INTERNAL_ERROR,
        message: isProduction
          ? 'Internal error'
          : (error instanceof Error ? error.message : 'Internal error'),
      },
    }
  }
}

/**
 * RPC Error class
 */
class RpcError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'RpcError'
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
async function handlePmGetPaymasterData(params: unknown[], config: HandlerConfig): Promise<unknown> {
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
    throw new RpcError(
      'ERC20 paymaster not configured',
      RPC_ERROR_CODES.UNSUPPORTED_PAYMASTER_TYPE
    )
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
    throw new RpcError(
      'ERC20 paymaster not configured',
      RPC_ERROR_CODES.UNSUPPORTED_PAYMASTER_TYPE
    )
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
  // Handle both [address, chainId] and [address, operation, chainId] forms
  const senderAddress = parsed[0] as Address
  const chainId = parsed.length === 3 ? (parsed[2] as string) : (parsed[1] as string)

  const result = handleGetSponsorPolicy(senderAddress, chainId, {
    policyManager: config.policyManager,
    supportedChainIds: config.supportedChainIds,
  })

  if (!result.success) {
    throw new RpcError(result.error.message, result.error.code, result.error.data)
  }

  return result.data
}
