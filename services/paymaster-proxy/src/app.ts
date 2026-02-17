import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Address, Hex } from 'viem'
import { getServerConfig } from './config/constants'
import { handleGetPaymasterData, handleGetPaymasterStubData } from './handlers'
import { SponsorPolicyManager } from './policy/sponsorPolicy'
import {
  getPaymasterDataParamsSchema,
  getPaymasterStubDataParamsSchema,
  jsonRpcRequestSchema,
} from './schemas'
import { PaymasterSigner } from './signer/paymasterSigner'
import type {
  JsonRpcResponse,
  PackedUserOperationRpc,
  PaymasterProxyConfig,
  UserOperationRpc,
} from './types'
import { RPC_ERROR_CODES } from './types'

/**
 * Create the Paymaster Proxy application
 */
export function createApp(config: PaymasterProxyConfig): Hono {
  const app = new Hono()

  // Initialize components
  const signer = new PaymasterSigner(config.signerPrivateKey, config.paymasterAddress)
  const policyManager = new SponsorPolicyManager()

  // Get sponsor name from environment (configurable via PAYMASTER_SPONSOR_NAME)
  const serverConfig = getServerConfig()

  // Handler configuration
  const handlerConfig = {
    paymasterAddress: config.paymasterAddress,
    signer,
    policyManager,
    supportedChainIds: config.supportedChainIds,
    sponsorName: serverConfig.sponsorName,
  }

  // Middleware
  app.use('*', cors())
  if (config.debug) {
    app.use('*', logger())
  }

  // Health check endpoints (Kubernetes probes compatible)
  const startTime = new Date()
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      service: 'paymaster-proxy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor((Date.now() - startTime.getTime()) / 1000)}s`,
      paymaster: config.paymasterAddress,
      signer: signer.getSignerAddress(),
      supportedChainIds: config.supportedChainIds,
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

  const adminToken = process.env.PAYMASTER_ADMIN_TOKEN
  if (adminToken) {
    const auth = bearerAuth({ token: adminToken })
    app.use('/admin/*', auth)
    registerAdminRoutes(app)
  } else if (process.env.NODE_ENV === 'production') {
    // Block admin endpoints in production without token
    app.all('/admin/*', (c) => {
      return c.json(
        { error: 'Admin endpoints disabled: PAYMASTER_ADMIN_TOKEN not configured' },
        503
      )
    })
  } else {
    // Development: allow without auth but log warning
    console.warn(
      '[paymaster-proxy] WARNING: Admin endpoints are unauthenticated (set PAYMASTER_ADMIN_TOKEN)'
    )
    registerAdminRoutes(app)
  }

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
  config: {
    paymasterAddress: Address
    signer: PaymasterSigner
    policyManager: SponsorPolicyManager
    supportedChainIds: number[]
    sponsorName?: string
  }
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
  config: {
    paymasterAddress: Address
    signer: PaymasterSigner
    policyManager: SponsorPolicyManager
    supportedChainIds: number[]
    sponsorName?: string
  }
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

    default:
      throw new RpcError(`Method ${method} not found`, RPC_ERROR_CODES.METHOD_NOT_FOUND)
  }
}

/**
 * Handle pm_getPaymasterStubData
 */
function handlePmGetPaymasterStubData(
  params: unknown[],
  config: {
    paymasterAddress: Address
    signer: PaymasterSigner
    policyManager: SponsorPolicyManager
    supportedChainIds: number[]
    sponsorName?: string
  }
): unknown {
  // Parse params
  const parseResult = getPaymasterStubDataParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [userOp, entryPoint, chainId, context] = parseResult.data

  const result = handleGetPaymasterStubData(
    {
      userOp: userOp as UserOperationRpc | PackedUserOperationRpc,
      entryPoint: entryPoint as Address,
      chainId: chainId as Hex,
      context: context as Record<string, unknown> | undefined,
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
  config: {
    paymasterAddress: Address
    signer: PaymasterSigner
    policyManager: SponsorPolicyManager
    supportedChainIds: number[]
    sponsorName?: string
  }
): Promise<unknown> {
  // Parse params
  const parseResult = getPaymasterDataParamsSchema.safeParse(params)
  if (!parseResult.success) {
    throw new RpcError(
      'Invalid parameters',
      RPC_ERROR_CODES.INVALID_PARAMS,
      parseResult.error.issues
    )
  }

  const [userOp, entryPoint, chainId, context] = parseResult.data

  const result = await handleGetPaymasterData(
    {
      userOp: userOp as UserOperationRpc | PackedUserOperationRpc,
      entryPoint: entryPoint as Address,
      chainId: chainId as Hex,
      context: context as Record<string, unknown> | undefined,
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
