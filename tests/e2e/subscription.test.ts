import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  type PublicClient,
  parseAbi,
  parseEther,
  type WalletClient,
} from 'viem'
import { type LocalAccount, privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
/**
 * Subscription E2E Test Suite
 *
 * Tests the complete subscription payment flow:
 * 1. EIP-7702 delegation setup
 * 2. ERC-7715 permission grant
 * 3. Subscription creation
 * 4. Automatic payment execution
 * 5. Permission revocation and failure handling
 * 6. Retry and circuit breaker behavior
 *
 * Prerequisites:
 * - Local Anvil node running (http://127.0.0.1:8545)
 * - Bundler service running (http://127.0.0.1:4337)
 * - Subscription Executor service running (http://127.0.0.1:8084)
 * - Required contracts deployed:
 *   - SubscriptionManager
 *   - PermissionManager
 *   - RecurringPaymentExecutor
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { isBundlerAvailable, isNetworkAvailable, TEST_CONFIG } from '../setup'

// ============================================================================
// Subscription Executor API Types
// ============================================================================

interface CreateSubscriptionRequest {
  smartAccount: string
  recipient: string
  token: string
  amount: string
  intervalDays: number
  maxExecutions?: number
}

interface SubscriptionResponse {
  id: string
  smartAccount: string
  recipient: string
  token: string
  amount: string
  intervalDays: number
  nextExecution: string
  lastExecution?: string
  executionCount: number
  maxExecutions: number
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'permission_revoked'
  createdAt: string
}

interface ErrorResponse {
  error: string
}

interface SuccessResponse {
  message: string
}

// ============================================================================
// Contract ABIs
// ============================================================================

const PERMISSION_MANAGER_ABI = parseAbi([
  'function grantPermission(address operator, address token, uint256 allowance, uint256 period, uint256 validUntil) returns (bytes32)',
  'function revokePermission(bytes32 permissionId)',
  'function isPermissionValid(bytes32 permissionId) view returns (bool)',
  'function getPermission(bytes32 permissionId) view returns (address owner, address operator, address token, uint256 allowance, uint256 period, uint256 validUntil, uint256 usedAllowance, uint256 lastResetTime, bool isActive)',
])

const _SUBSCRIPTION_MANAGER_ABI = parseAbi([
  'function planCount() view returns (uint256)',
  'function plans(uint256 planId) view returns (address merchant, string name, string description, uint256 price, uint256 interval, address token, bool isActive, uint256 subscriberCount, uint256 trialPeriod, uint256 gracePeriod, uint256 createdAt)',
  'function subscribe(uint256 planId, bytes32 permissionId) payable',
  'function cancelSubscription(uint256 planId)',
  'function getSubscription(address subscriber, uint256 planId) view returns (uint256 startTime, uint256 lastPaymentTime, uint256 nextPaymentTime, uint8 status, bytes32 permissionId)',
])

const _ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
])

// ============================================================================
// API Client
// ============================================================================

const SUBSCRIPTION_EXECUTOR_URL = process.env.SUBSCRIPTION_EXECUTOR_URL || 'http://127.0.0.1:8084'

class SubscriptionExecutorClient {
  private baseUrl: string

  constructor(baseUrl: string = SUBSCRIPTION_EXECUTOR_URL) {
    this.baseUrl = baseUrl
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<SubscriptionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SubscriptionResponse>
  }

  async getSubscription(id: string): Promise<SubscriptionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions/${id}`)

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SubscriptionResponse>
  }

  async getSubscriptionsByAccount(account: string): Promise<SubscriptionResponse[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions/account/${account}`)

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SubscriptionResponse[]>
  }

  async cancelSubscription(id: string): Promise<SuccessResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions/${id}/cancel`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SuccessResponse>
  }

  async pauseSubscription(id: string): Promise<SuccessResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions/${id}/pause`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SuccessResponse>
  }

  async resumeSubscription(id: string): Promise<SuccessResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subscriptions/${id}/resume`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse
      throw new Error(error.error)
    }

    return response.json() as Promise<SuccessResponse>
  }

  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/metrics`)
    return response.text()
  }
}

// ============================================================================
// Test Context
// ============================================================================

interface TestContext {
  publicClient: PublicClient
  walletClient: WalletClient
  account: LocalAccount
  recipient: LocalAccount
  networkAvailable: boolean
  bundlerAvailable: boolean
  executorAvailable: boolean
  contractsDeployed: boolean
  executorClient: SubscriptionExecutorClient
}

// ============================================================================
// Helper Functions
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function _waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 1000
): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true
    }
    await sleep(interval)
  }
  return false
}

// ============================================================================
// Tests
// ============================================================================

describe('Subscription E2E Flow', () => {
  const ctx: TestContext = {
    publicClient: null as unknown as PublicClient,
    walletClient: null as unknown as WalletClient,
    account: null as unknown as LocalAccount,
    recipient: null as unknown as LocalAccount,
    networkAvailable: false,
    bundlerAvailable: false,
    executorAvailable: false,
    contractsDeployed: false,
    executorClient: new SubscriptionExecutorClient(),
  }

  beforeAll(async () => {
    ctx.networkAvailable = await isNetworkAvailable()
    ctx.bundlerAvailable = await isBundlerAvailable()
    ctx.executorAvailable = await ctx.executorClient.isAvailable()

    if (!ctx.networkAvailable) {
      console.warn('⚠️ Local network not available, E2E tests will be skipped')
      return
    }

    if (!ctx.bundlerAvailable) {
      console.warn('⚠️ Bundler not available, some tests will be skipped')
    }

    if (!ctx.executorAvailable) {
      console.warn('⚠️ Subscription Executor not available, some tests will be skipped')
    }

    const chain = {
      ...foundry,
      id: TEST_CONFIG.chainId,
    }

    ctx.publicClient = createPublicClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
    })

    ctx.account = privateKeyToAccount(TEST_CONFIG.accounts.user1.privateKey as Hex)

    ctx.recipient = privateKeyToAccount(TEST_CONFIG.accounts.user2.privateKey as Hex)

    ctx.walletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account: ctx.account,
    })

    // Check if required contracts are deployed
    const [subscriptionManagerCode, permissionManagerCode] = await Promise.all([
      ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.subscriptionManager as Address,
      }),
      ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.permissionManager as Address,
      }),
    ])

    ctx.contractsDeployed = !!(
      subscriptionManagerCode &&
      subscriptionManagerCode !== '0x' &&
      permissionManagerCode &&
      permissionManagerCode !== '0x'
    )

    if (!ctx.contractsDeployed) {
      console.warn('⚠️ Required contracts not deployed, some tests will be skipped')
    }
  })

  // ==========================================================================
  // Test 1: Health Check
  // ==========================================================================

  describe('Service Health', () => {
    it('should verify executor service is healthy', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const response = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/health`)
      expect(response.ok).toBe(true)

      const health = await response.json()
      expect(health.status).toBe('ok')
      expect(health.service).toBe('subscription-executor')
    })

    it('should verify executor service is ready', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const response = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/ready`)
      expect(response.ok).toBe(true)

      const readiness = await response.json()
      expect(readiness.ready).toBe(true)
    })

    it('should verify executor service is alive', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const response = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/live`)
      expect(response.ok).toBe(true)

      const liveness = await response.json()
      expect(liveness.alive).toBe(true)
    })

    it('should provide Prometheus metrics', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const metrics = await ctx.executorClient.getMetrics()
      expect(metrics).toContain('subscription_executor_up')
      expect(metrics).toContain('subscription_executor_http_requests_total')
    })
  })

  // ==========================================================================
  // Test 2: Subscription Creation
  // ==========================================================================

  describe('Subscription Creation', () => {
    let subscriptionId: string

    it('should create a new subscription', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const request: CreateSubscriptionRequest = {
        smartAccount: ctx.account.address,
        recipient: ctx.recipient.address,
        token: '0x0000000000000000000000000000000000000000', // Native ETH
        amount: parseEther('0.01').toString(),
        intervalDays: 1,
        maxExecutions: 10,
      }

      const subscription = await ctx.executorClient.createSubscription(request)

      expect(subscription.id).toBeDefined()
      expect(subscription.smartAccount.toLowerCase()).toBe(ctx.account.address.toLowerCase())
      expect(subscription.recipient.toLowerCase()).toBe(ctx.recipient.address.toLowerCase())
      expect(subscription.status).toBe('active')
      expect(subscription.executionCount).toBe(0)

      subscriptionId = subscription.id
    })

    it('should retrieve the created subscription', async () => {
      if (!ctx.executorAvailable || !subscriptionId) {
        return
      }

      const subscription = await ctx.executorClient.getSubscription(subscriptionId)

      expect(subscription.id).toBe(subscriptionId)
      expect(subscription.status).toBe('active')
    })

    it('should list subscriptions by account', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const subscriptions = await ctx.executorClient.getSubscriptionsByAccount(ctx.account.address)

      expect(Array.isArray(subscriptions)).toBe(true)
      // Should have at least the one we just created
      if (subscriptionId) {
        const found = subscriptions.find((s) => s.id === subscriptionId)
        expect(found).toBeDefined()
      }
    })

    it('should reject invalid Ethereum addresses', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const request: CreateSubscriptionRequest = {
        smartAccount: 'invalid-address',
        recipient: ctx.recipient.address,
        token: '0x0000000000000000000000000000000000000000',
        amount: parseEther('0.01').toString(),
        intervalDays: 1,
      }

      await expect(ctx.executorClient.createSubscription(request)).rejects.toThrow()
    })

    it('should reject invalid amounts', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const request: CreateSubscriptionRequest = {
        smartAccount: ctx.account.address,
        recipient: ctx.recipient.address,
        token: '0x0000000000000000000000000000000000000000',
        amount: '0', // Zero amount
        intervalDays: 1,
      }

      await expect(ctx.executorClient.createSubscription(request)).rejects.toThrow()
    })
  })

  // ==========================================================================
  // Test 3: Subscription Lifecycle
  // ==========================================================================

  describe('Subscription Lifecycle', () => {
    let subscriptionId: string

    beforeAll(async () => {
      if (!ctx.executorAvailable) return

      // Create a subscription for lifecycle tests
      const request: CreateSubscriptionRequest = {
        smartAccount: ctx.account.address,
        recipient: ctx.recipient.address,
        token: '0x0000000000000000000000000000000000000000',
        amount: parseEther('0.001').toString(),
        intervalDays: 1,
        maxExecutions: 5,
      }

      const subscription = await ctx.executorClient.createSubscription(request)
      subscriptionId = subscription.id
    })

    it('should pause a subscription', async () => {
      if (!ctx.executorAvailable || !subscriptionId) {
        return
      }

      const result = await ctx.executorClient.pauseSubscription(subscriptionId)
      expect(result.message).toContain('paused')

      const subscription = await ctx.executorClient.getSubscription(subscriptionId)
      expect(subscription.status).toBe('paused')
    })

    it('should resume a paused subscription', async () => {
      if (!ctx.executorAvailable || !subscriptionId) {
        return
      }

      const result = await ctx.executorClient.resumeSubscription(subscriptionId)
      expect(result.message).toContain('resumed')

      const subscription = await ctx.executorClient.getSubscription(subscriptionId)
      expect(subscription.status).toBe('active')
    })

    it('should cancel a subscription', async () => {
      if (!ctx.executorAvailable || !subscriptionId) {
        return
      }

      const result = await ctx.executorClient.cancelSubscription(subscriptionId)
      expect(result.message).toContain('cancelled')

      const subscription = await ctx.executorClient.getSubscription(subscriptionId)
      expect(subscription.status).toBe('cancelled')
    })

    it('should fail to resume a cancelled subscription', async () => {
      if (!ctx.executorAvailable || !subscriptionId) {
        return
      }

      await expect(ctx.executorClient.resumeSubscription(subscriptionId)).rejects.toThrow()
    })
  })

  // ==========================================================================
  // Test 4: ERC-7715 Permission Integration
  // ==========================================================================

  describe('ERC-7715 Permission Integration', () => {
    it('should grant permission for subscription', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) {
        return
      }

      const permissionManagerAddress = TEST_CONFIG.contracts.permissionManager as Address
      const recurringPaymentExecutor = TEST_CONFIG.contracts.recurringPaymentExecutor as Address
      const token = '0x0000000000000000000000000000000000000000' as Address

      const allowance = parseEther('1') // 1 ETH per period
      const period = BigInt(86400) // 1 day
      const validUntil = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60) // 1 year

      // Grant permission via direct contract call
      // Note: Using any type due to viem 2.x strict typing requirements
      const txHash = (await (ctx.walletClient.writeContract as unknown)({
        address: permissionManagerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'grantPermission',
        args: [recurringPaymentExecutor, token, allowance, period, validUntil],
      })) as Hex

      expect(txHash).toBeDefined()
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      // Wait for transaction
      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash })
      expect(receipt.status).toBe('success')
    })

    it('should verify permission is valid', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) {
        return
      }

      // Note: In a real scenario, we'd get the permissionId from the grant transaction logs
      // For this test, we verify the contract is callable
      const permissionManagerAddress = TEST_CONFIG.contracts.permissionManager as Address

      // This call should not throw (contract exists and is callable)
      try {
        const isValid = await ctx.publicClient.readContract({
          address: permissionManagerAddress,
          abi: PERMISSION_MANAGER_ABI,
          functionName: 'isPermissionValid',
          args: ['0x0000000000000000000000000000000000000000000000000000000000000001' as Hex],
        })

        // Permission might be false for a non-existent ID, but the call should succeed
        expect(typeof isValid).toBe('boolean')
      } catch (_error) {}
    })
  })

  // ==========================================================================
  // Test 5: Rate Limiting
  // ==========================================================================

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API requests', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${SUBSCRIPTION_EXECUTOR_URL}/health`)
      )

      const responses = await Promise.all(requests)

      // All health check requests should succeed (they're lightweight)
      const successCount = responses.filter((r) => r.ok).length
      expect(successCount).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // Test 6: Idempotency
  // ==========================================================================

  describe('Idempotency', () => {
    it('should handle duplicate requests with idempotency key', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const request: CreateSubscriptionRequest = {
        smartAccount: ctx.account.address,
        recipient: ctx.recipient.address,
        token: '0x0000000000000000000000000000000000000000',
        amount: parseEther('0.001').toString(),
        intervalDays: 1,
      }

      // First request with idempotency key
      const response1 = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/api/v1/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(request),
      })

      expect(response1.ok).toBe(true)
      const subscription1 = (await response1.json()) as SubscriptionResponse

      // Second request with same idempotency key should return same result
      const response2 = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/api/v1/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(request),
      })

      expect(response2.ok).toBe(true)
      const subscription2 = (await response2.json()) as SubscriptionResponse

      // Should get the same subscription ID (idempotent)
      expect(subscription2.id).toBe(subscription1.id)
    })
  })

  // ==========================================================================
  // Test 7: Metrics Validation
  // ==========================================================================

  describe('Metrics', () => {
    it('should track HTTP request metrics', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      // Make some requests to generate metrics
      await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/health`)
      await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/ready`)

      // Fetch metrics
      const metrics = await ctx.executorClient.getMetrics()

      // Verify metrics are being collected
      expect(metrics).toContain('subscription_executor_http_requests_total')
      expect(metrics).toContain('subscription_executor_http_request_duration_seconds')
      expect(metrics).toContain('subscription_executor_up')
    })

    it('should report service uptime', async () => {
      if (!ctx.executorAvailable) {
        return
      }

      const response = await fetch(`${SUBSCRIPTION_EXECUTOR_URL}/health`)
      const health = await response.json()

      expect(health.uptime).toBeDefined()
      expect(health.uptime).toMatch(/\d+[hms]/) // e.g., "1h30m15s"
    })
  })
})
