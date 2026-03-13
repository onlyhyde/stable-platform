import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the chain client and config modules before importing app
vi.mock('../src/chain/client', () => ({
  getPublicClient: vi.fn(() => ({})),
  getWalletClient: vi.fn(() => ({})),
}))

vi.mock('../src/config/constants', () => ({
  getServerConfig: vi.fn(() => ({
    port: 4338,
    debug: false,
    sponsorName: 'Test Paymaster',
    supportedChainIds: [8283],
  })),
  getReservationPersistenceConfig: vi.fn(() => ({ dataDir: undefined })),
  getDepositMonitorConfig: vi.fn(() => ({
    depositMonitorEnabled: false,
    depositMonitorPollMs: 30000,
    depositMinThreshold: 10n ** 16n,
    depositRejectOnLow: false,
  })),
  getAutoDepositConfig: vi.fn(() => ({
    autoDepositEnabled: false,
    autoDepositAmount: 10n ** 17n,
    autoDepositCooldownMs: 300000,
  })),
  PAYMASTER_ENV_VARS: { SUPPORTED_ENTRY_POINTS: 'SUPPORTED_ENTRY_POINTS' },
  parseEntryPoints: vi.fn(() => ['0xD23Ee0D8E8DfabE76AA52a872Ce015B0BcAED6Ce']),
  getSettlementConfig: vi.fn(() => ({
    bundlerRpcUrl: undefined,
    settlementPollMs: 15000,
    settlementEnabled: false,
  })),
  getDefaultPolicyConfig: vi.fn(() => ({
    maxGasLimit: 5_000_000n,
    maxGasCost: 10n ** 18n,
    dailyLimitPerSender: 10n ** 17n,
    globalDailyLimit: 10n ** 19n,
  })),
}))

import { createApp } from '../src/app'
import type { PaymasterProxyConfig } from '../src/types'

const TEST_CONFIG: PaymasterProxyConfig = {
  port: 4338,
  paymasterAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
  paymasterAddresses: {
    verifying: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
  },
  signerPrivateKey: ('0x' + 'ab'.repeat(32)) as Hex,
  rpcUrl: 'http://localhost:8545',
  supportedChainIds: [8283],
  debug: false,
  supportedEntryPoints: ['0xD23Ee0D8E8DfabE76AA52a872Ce015B0BcAED6Ce' as Address],
}

describe('App - JSON-RPC', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp(TEST_CONFIG)
  })

  it('should reject batch requests exceeding MAX_BATCH_SIZE', async () => {
    const batch = Array.from({ length: 51 }, (_, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'pm_supportedChainIds',
      params: [],
    }))

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Batch size 51 exceeds maximum 50')
  })

  it('should accept batch requests within limit', async () => {
    const batch = Array.from({ length: 3 }, (_, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'pm_supportedChainIds',
      params: [],
    }))

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
    body.forEach((r: { result: number[] }) => {
      expect(r.result).toEqual([8283])
    })
  })

  it('should handle single JSON-RPC requests', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_supportedChainIds',
        params: [],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual([8283])
  })

  it('should return error for invalid JSON-RPC request', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error.code).toBe(-32600) // INVALID_REQUEST
  })

  it('should return error for unknown method', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_unknownMethod',
        params: [],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error.code).toBe(-32601) // METHOD_NOT_FOUND
  })

  it('should work on /rpc path too', async () => {
    const res = await app.request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_supportedChainIds',
        params: [],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual([8283])
  })
})

describe('App - Health endpoints', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp(TEST_CONFIG)
  })

  it('should return health status', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('paymaster-proxy')
    expect(body.paymaster).toBe(TEST_CONFIG.paymasterAddress)
  })

  it('should return ready status', async () => {
    const res = await app.request('/ready')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ready).toBe(true)
  })

  it('should return live status', async () => {
    const res = await app.request('/live')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alive).toBe(true)
  })

  it('should return prometheus metrics', async () => {
    const res = await app.request('/metrics')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('paymaster_proxy_up')
    expect(text).toContain('paymaster_proxy_uptime_seconds')
    expect(text).toContain('paymaster_proxy_requests_total')
  })
})

describe('App - Admin endpoints', () => {
  let app: ReturnType<typeof createApp>
  const adminToken = 'test-admin-token-123'

  beforeEach(() => {
    process.env.PAYMASTER_ADMIN_TOKEN = adminToken
    app = createApp(TEST_CONFIG)
  })

  it('should reject admin requests without auth', async () => {
    const res = await app.request('/admin/policies')
    expect(res.status).toBe(401)
  })

  it('should list policies with auth', async () => {
    const res = await app.request('/admin/policies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.policies).toBeDefined()
    expect(Array.isArray(body.policies)).toBe(true)
  })

  it('should reject invalid policy body', async () => {
    const res = await app.request('/admin/policies', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalid: true }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid policy')
    expect(body.details).toBeDefined()
  })

  it('should accept valid policy body', async () => {
    const res = await app.request('/admin/policies', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'new-policy',
        name: 'New Policy',
        active: true,
        maxGasLimit: '5000000',
        dailyLimitPerSender: '100000000000000000',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify policy was created
    const listRes = await app.request('/admin/policies/new-policy', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(listRes.status).toBe(200)
    const policyBody = await listRes.json()
    expect(policyBody.policy.id).toBe('new-policy')
  })

  it('should return 404 for unknown policy', async () => {
    const res = await app.request('/admin/policies/nonexistent', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(404)
  })

  it('should delete a policy', async () => {
    // First create a policy
    await app.request('/admin/policies', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: 'to-delete', name: 'Delete Me', active: true }),
    })

    const res = await app.request('/admin/policies/to-delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)

    // Verify it's gone
    const getRes = await app.request('/admin/policies/to-delete', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(getRes.status).toBe(404)
  })
})
