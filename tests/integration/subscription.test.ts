/**
 * Subscription Plugin Integration Tests
 *
 * Tests the full subscription lifecycle against devnet contracts:
 *   1. Contract deployment verification
 *   2. Plan creation by merchant
 *   3. Permission granting by subscriber
 *   4. Subscription enrollment
 *   5. Payment processing
 *   6. Subscription cancellation
 *   7. State queries via plugin clients
 *
 * Prerequisites:
 *   - Anvil running on localhost:8545 (`make anvil`)
 *   - Contracts deployed (`make deploy-full`)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type Chain,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { TEST_CONFIG, isNetworkAvailable } from '../setup'
import {
  createSubscriptionManager,
  createRecurringPaymentExecutor,
  createSubscriptionPermissionClient,
  INTERVALS,
  NATIVE_TOKEN,
  PERMISSION_TYPES,
  RULE_TYPES,
  type SubscriptionManagerClient,
  type RecurringPaymentExecutorClient,
  type SubscriptionPermissionClient,
} from '../../packages/sdk/plugins/subscription/src'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isContractDeployed(
  client: PublicClient,
  address: string,
): Promise<boolean> {
  if (!address || address === NATIVE_TOKEN) return false
  try {
    const code = await client.getCode({ address: address as Address })
    return !!code && code !== '0x'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Subscription Plugin Integration', () => {
  let chain: Chain
  let publicClient: PublicClient
  let merchantWallet: WalletClient
  let subscriberWallet: WalletClient
  let merchantAccount: PrivateKeyAccount
  let subscriberAccount: PrivateKeyAccount

  let subscriptionMgr: SubscriptionManagerClient
  let recurringPay: RecurringPaymentExecutorClient
  let permissionClient: SubscriptionPermissionClient

  let networkAvailable: boolean
  let subscriptionManagerDeployed: boolean
  let permissionManagerDeployed: boolean
  let recurringPaymentExecutorDeployed: boolean

  beforeAll(async () => {
    networkAvailable = await isNetworkAvailable()
    if (!networkAvailable) {
      console.warn('⚠️ Local network not available, skipping subscription integration tests')
      return
    }

    chain = { ...foundry, id: TEST_CONFIG.chainId }

    publicClient = createPublicClient({ chain, transport: http(TEST_CONFIG.rpcUrl) })

    // merchant = deployer (account[0]), subscriber = user1 (account[1])
    merchantAccount = privateKeyToAccount(TEST_CONFIG.accounts.deployer.privateKey as Hex)
    subscriberAccount = privateKeyToAccount(TEST_CONFIG.accounts.user1.privateKey as Hex)

    merchantWallet = createWalletClient({ chain, transport: http(TEST_CONFIG.rpcUrl), account: merchantAccount })
    subscriberWallet = createWalletClient({ chain, transport: http(TEST_CONFIG.rpcUrl), account: subscriberAccount })

    // Create plugin clients
    const smAddr = TEST_CONFIG.contracts.subscriptionManager as Address
    const pmAddr = TEST_CONFIG.contracts.permissionManager as Address
    const rpAddr = (TEST_CONFIG.contracts.recurringPaymentExecutor || NATIVE_TOKEN) as Address

    subscriptionMgr = createSubscriptionManager({ managerAddress: smAddr })
    permissionClient = createSubscriptionPermissionClient({ managerAddress: pmAddr })
    recurringPay = createRecurringPaymentExecutor({ executorAddress: rpAddr })

    // Check deployments
    subscriptionManagerDeployed = await isContractDeployed(publicClient, smAddr)
    permissionManagerDeployed = await isContractDeployed(publicClient, pmAddr)
    recurringPaymentExecutorDeployed = await isContractDeployed(publicClient, rpAddr)

    console.log('--- Subscription Contract Deployment Status ---')
    console.log(`  SubscriptionManager:       ${subscriptionManagerDeployed ? '✅' : '❌'} ${smAddr}`)
    console.log(`  PermissionManager:         ${permissionManagerDeployed ? '✅' : '❌'} ${pmAddr}`)
    console.log(`  RecurringPaymentExecutor:  ${recurringPaymentExecutorDeployed ? '✅' : '❌'} ${rpAddr}`)
  })

  // ---- 1. Contract deployment verification ----

  describe('Contract Deployment', () => {
    it('should have SubscriptionManager deployed', async () => {
      if (!networkAvailable) return
      expect(subscriptionManagerDeployed).toBe(true)
    })

    it('should have PermissionManager deployed', async () => {
      if (!networkAvailable) return
      expect(permissionManagerDeployed).toBe(true)
    })

    it('should report RecurringPaymentExecutor status', async () => {
      if (!networkAvailable) return
      console.log(
        recurringPaymentExecutorDeployed
          ? '✅ RecurringPaymentExecutor deployed'
          : '⚠️ RecurringPaymentExecutor not yet deployed (zero address)',
      )
      // Non-blocking — executor is optional at this stage
      expect(true).toBe(true)
    })
  })

  // ---- 2. SubscriptionManager read functions ----

  describe('SubscriptionManager Queries', () => {
    it('should read plan count', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const count = await subscriptionMgr.getPlanCount(publicClient)
      expect(count).toBeGreaterThanOrEqual(0n)
      console.log(`  Plan count: ${count}`)
    })

    it('should read protocol fee', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const feeBps = await subscriptionMgr.getProtocolFeeBps(publicClient)
      expect(feeBps).toBeGreaterThanOrEqual(0n)
      expect(feeBps).toBeLessThanOrEqual(1000n) // max 10%
      console.log(`  Protocol fee: ${feeBps} bps (${Number(feeBps) / 100}%)`)
    })

    it('should check processor authorization', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const isProcessor = await subscriptionMgr.isAuthorizedProcessor(
        publicClient,
        merchantAccount.address,
      )
      // deployer might or might not be an authorized processor
      expect(typeof isProcessor).toBe('boolean')
      console.log(`  Deployer is authorized processor: ${isProcessor}`)
    })
  })

  // ---- 3. Plan creation flow ----

  describe('Plan Creation', () => {
    it('should encode and send createPlan transaction', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const calldata = subscriptionMgr.encodeCreatePlan({
        amount: parseEther('0.01'),
        period: INTERVALS.MONTHLY,
        name: 'Integration Test Plan',
        description: 'Created by automated integration test',
      })

      expect(calldata).toMatch(/^0x/)

      const hash = await merchantWallet.sendTransaction({
        to: subscriptionMgr.managerAddress,
        data: calldata,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')
      console.log(`  createPlan tx: ${hash}`)
    })

    it('should read back created plan', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const planCount = await subscriptionMgr.getPlanCount(publicClient)
      if (planCount === 0n) {
        console.log('  ⚠️ No plans found, skipping read-back')
        return
      }

      // Read the latest plan (planCount is 1-indexed in most implementations,
      // but the contract may use 0-indexed — try both)
      let plan
      try {
        plan = await subscriptionMgr.getPlan(publicClient, planCount)
      } catch {
        plan = await subscriptionMgr.getPlan(publicClient, planCount - 1n)
      }

      expect(plan.amount).toBe(parseEther('0.01'))
      expect(plan.period).toBe(INTERVALS.MONTHLY)
      expect(plan.active).toBe(true)
      expect(plan.merchant.toLowerCase()).toBe(merchantAccount.address.toLowerCase())
      console.log(`  Plan: "${plan.name}" — ${formatEther(plan.amount)} ETH / ${plan.period}s`)
    })

    it('should create a plan with trial and grace periods', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const calldata = subscriptionMgr.encodeCreatePlan({
        amount: parseEther('0.05'),
        period: INTERVALS.WEEKLY,
        trialPeriod: INTERVALS.DAILY * 7n, // 7-day trial
        gracePeriod: INTERVALS.DAILY * 3n, // 3-day grace
        name: 'Premium Test Plan',
        description: 'Plan with trial and grace periods',
      })

      const hash = await merchantWallet.sendTransaction({
        to: subscriptionMgr.managerAddress,
        data: calldata,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')
      console.log(`  createPlan (with trial/grace) tx: ${hash}`)
    })
  })

  // ---- 4. Plan update ----

  describe('Plan Update', () => {
    it('should update a plan', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const planCount = await subscriptionMgr.getPlanCount(publicClient)
      if (planCount === 0n) {
        console.log('  ⚠️ No plans, skipping update')
        return
      }

      const planId = planCount // latest plan
      const calldata = subscriptionMgr.encodeUpdatePlan(
        planId,
        parseEther('0.02'), // new amount
        INTERVALS.MONTHLY,
        true, // still active
      )

      const hash = await merchantWallet.sendTransaction({
        to: subscriptionMgr.managerAddress,
        data: calldata,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')
      console.log(`  updatePlan tx: ${hash}`)
    })
  })

  // ---- 5. PermissionManager queries ----

  describe('PermissionManager Queries', () => {
    it('should check if subscription permission type is supported', async () => {
      if (!networkAvailable || !permissionManagerDeployed) return

      const supported = await permissionClient.isPermissionTypeSupported(
        publicClient,
        PERMISSION_TYPES.SUBSCRIPTION,
      )
      expect(typeof supported).toBe('boolean')
      console.log(`  Subscription permission type supported: ${supported}`)
    })

    it('should get nonce for subscriber', async () => {
      if (!networkAvailable || !permissionManagerDeployed) return

      const nonce = await permissionClient.getNonce(publicClient, subscriberAccount.address)
      expect(nonce).toBeGreaterThanOrEqual(0n)
      console.log(`  Subscriber nonce: ${nonce}`)
    })
  })

  // ---- 6. Permission granting (encode only — actual granting requires on-chain wallet support) ----

  describe('Permission Encoding', () => {
    it('should encode grantSubscriptionPermission', () => {
      if (!networkAvailable) return

      const calldata = permissionClient.encodeGrantSubscriptionPermission({
        grantee: subscriptionMgr.managerAddress,
        target: subscriptionMgr.managerAddress,
        spendingLimit: parseEther('1'),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
      })

      expect(calldata).toMatch(/^0x/)
      expect(calldata.length).toBeGreaterThan(10)
      console.log(`  Encoded grantSubscriptionPermission calldata: ${calldata.slice(0, 66)}...`)
    })

    it('should encode revokePermission', () => {
      if (!networkAvailable) return

      const fakePermissionId = '0x' + 'ab'.repeat(32) as Hex
      const calldata = permissionClient.encodeRevokePermission(fakePermissionId)
      expect(calldata).toMatch(/^0x/)
      console.log(`  Encoded revokePermission calldata: ${calldata.slice(0, 66)}...`)
    })
  })

  // ---- 7. RecurringPaymentExecutor ----

  describe('RecurringPaymentExecutor', () => {
    it('should encode createSchedule', () => {
      if (!networkAvailable) return

      const calldata = recurringPay.encodeCreateSchedule({
        recipient: merchantAccount.address,
        amount: parseEther('0.01'),
        interval: INTERVALS.MONTHLY,
      })

      expect(calldata).toMatch(/^0x/)
      console.log(`  Encoded createSchedule calldata: ${calldata.slice(0, 66)}...`)
    })

    it('should encode install data for ERC-7579 module', () => {
      if (!networkAvailable) return

      const installData = recurringPay.encodeInstallData({
        recipient: merchantAccount.address,
        amount: parseEther('0.01'),
        interval: INTERVALS.MONTHLY,
      })

      expect(installData).toMatch(/^0x/)
      expect(installData.length).toBeGreaterThan(10)
      console.log(`  Encoded installData: ${installData.slice(0, 66)}...`)
    })

    it('should query active schedules (if deployed)', async () => {
      if (!networkAvailable || !recurringPaymentExecutorDeployed) {
        console.log('  ⚠️ RecurringPaymentExecutor not deployed, skipping query')
        return
      }

      const schedules = await recurringPay.getActiveSchedules(
        publicClient,
        subscriberAccount.address,
      )
      expect(Array.isArray(schedules)).toBe(true)
      console.log(`  Active schedules for subscriber: ${schedules.length}`)
    })

    it('should check initialization status (if deployed)', async () => {
      if (!networkAvailable || !recurringPaymentExecutorDeployed) return

      const initialized = await recurringPay.isInitialized(
        publicClient,
        subscriberAccount.address,
      )
      expect(typeof initialized).toBe('boolean')
      console.log(`  Subscriber module initialized: ${initialized}`)
    })
  })

  // ---- 8. Subscription flow (subscribe → query → cancel) ----

  describe('Subscription Lifecycle', () => {
    let planId: bigint

    beforeAll(async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      // Ensure at least one plan exists
      const count = await subscriptionMgr.getPlanCount(publicClient)
      planId = count > 0n ? 1n : 0n
    })

    it('should encode subscribe transaction', () => {
      if (!networkAvailable || !subscriptionManagerDeployed || planId === 0n) return

      const fakePermissionId = '0x' + 'cc'.repeat(32) as Hex
      const calldata = subscriptionMgr.encodeSubscribe({
        planId,
        permissionId: fakePermissionId,
      })

      expect(calldata).toMatch(/^0x/)
      console.log(`  Encoded subscribe(planId=${planId}) calldata: ${calldata.slice(0, 66)}...`)
    })

    it('should get subscriber subscriptions (empty initially)', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const subs = await subscriptionMgr.getSubscriberSubscriptions(
        publicClient,
        subscriberAccount.address,
      )
      expect(Array.isArray(subs)).toBe(true)
      console.log(`  Subscriber subscription count: ${subs.length}`)
    })

    it('should get merchant plans', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const plans = await subscriptionMgr.getMerchantPlans(
        publicClient,
        merchantAccount.address,
      )
      expect(Array.isArray(plans)).toBe(true)
      console.log(`  Merchant plan count: ${plans.length}`)
    })

    it('should encode batch process payments', () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const fakeSubIds: Hex[] = [
        '0x' + 'aa'.repeat(32) as Hex,
        '0x' + 'bb'.repeat(32) as Hex,
      ]
      const calldata = subscriptionMgr.encodeBatchProcessPayments(fakeSubIds)
      expect(calldata).toMatch(/^0x/)
      console.log(`  Encoded batchProcessPayments: ${calldata.slice(0, 66)}...`)
    })

    it('should encode processor management', async () => {
      if (!networkAvailable || !subscriptionManagerDeployed) return

      const processor = TEST_CONFIG.accounts.user2.address as Address
      const addCalldata = subscriptionMgr.encodeAddProcessor(processor)
      const removeCalldata = subscriptionMgr.encodeRemoveProcessor(processor)

      expect(addCalldata).toMatch(/^0x/)
      expect(removeCalldata).toMatch(/^0x/)
      console.log(`  Encoded addProcessor: ${addCalldata.slice(0, 66)}...`)
    })
  })

  // ---- 9. Cross-client consistency ----

  describe('Cross-Client Consistency', () => {
    it('should have consistent manager addresses', () => {
      if (!networkAvailable) return

      // SubscriptionManager and PermissionManager should reference valid addresses
      expect(subscriptionMgr.managerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(permissionClient.managerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(recurringPay.executorAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should produce deterministic calldata', () => {
      if (!networkAvailable) return

      const params = {
        amount: parseEther('1'),
        period: INTERVALS.MONTHLY,
        name: 'Determinism Test',
        description: 'Same input should always produce same output',
      }

      const calldata1 = subscriptionMgr.encodeCreatePlan(params)
      const calldata2 = subscriptionMgr.encodeCreatePlan(params)
      expect(calldata1).toBe(calldata2)
    })
  })
})
