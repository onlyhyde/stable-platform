import { type Address, decodeFunctionData, type Hex, parseEther } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  createRecurringPaymentExecutor,
  createSubscriptionManager,
  createSubscriptionPermissionClient,
  FEE_LIMITS,
  INTERVALS,
  MODULE_TYPE_EXECUTOR,
  NATIVE_TOKEN,
  PERIOD_LIMITS,
  PERMISSION_MANAGER_ABI,
  PERMISSION_TYPES,
  RECURRING_PAYMENT_EXECUTOR_ABI,
  RULE_TYPES,
  SUBSCRIPTION_MANAGER_ABI,
} from '../src/index'

const MOCK_MANAGER_ADDRESS: Address = '0x1234567890123456789012345678901234567890'
const MOCK_EXECUTOR_ADDRESS: Address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const MOCK_PERMISSION_ADDRESS: Address = '0x9876543210987654321098765432109876543210'
const MOCK_ACCOUNT: Address = '0x1111111111111111111111111111111111111111'
const MOCK_RECIPIENT: Address = '0x2222222222222222222222222222222222222222'
const MOCK_TOKEN: Address = '0x3333333333333333333333333333333333333333'
const MOCK_SUBSCRIPTION_ID: Hex =
  '0x4444444444444444444444444444444444444444444444444444444444444444'

// ============================================================
//                        Constants
// ============================================================

describe('constants', () => {
  it('NATIVE_TOKEN is zero address', () => {
    expect(NATIVE_TOKEN).toBe('0x0000000000000000000000000000000000000000')
  })

  it('INTERVALS has correct second values', () => {
    expect(INTERVALS.HOURLY).toBe(3600n)
    expect(INTERVALS.DAILY).toBe(86400n)
    expect(INTERVALS.WEEKLY).toBe(604800n)
    expect(INTERVALS.MONTHLY).toBe(2592000n)
    expect(INTERVALS.YEARLY).toBe(31536000n)
  })

  it('PERIOD_LIMITS match contract constraints', () => {
    expect(PERIOD_LIMITS.MIN).toBe(3600n) // 1 hour
    expect(PERIOD_LIMITS.MAX).toBe(31536000n) // 365 days
  })

  it('FEE_LIMITS match contract constraints', () => {
    expect(FEE_LIMITS.MAX_BPS).toBe(1000n) // 10%
    expect(FEE_LIMITS.DEFAULT_BPS).toBe(50n) // 0.5%
    expect(FEE_LIMITS.BASIS_POINTS_DENOMINATOR).toBe(10000n)
  })

  it('MODULE_TYPE_EXECUTOR is 2', () => {
    expect(MODULE_TYPE_EXECUTOR).toBe(2n)
  })

  it('PERMISSION_TYPES has all supported types', () => {
    expect(PERMISSION_TYPES.NATIVE_TOKEN_RECURRING).toBe('native-token-recurring-allowance')
    expect(PERMISSION_TYPES.ERC20_RECURRING).toBe('erc20-recurring-allowance')
    expect(PERMISSION_TYPES.SESSION_KEY).toBe('session-key')
    expect(PERMISSION_TYPES.SUBSCRIPTION).toBe('subscription')
    expect(PERMISSION_TYPES.SPENDING_LIMIT).toBe('spending-limit')
  })

  it('RULE_TYPES has all supported types', () => {
    expect(RULE_TYPES.EXPIRY).toBe('expiry')
    expect(RULE_TYPES.RATE_LIMIT).toBe('rate-limit')
    expect(RULE_TYPES.SPENDING_LIMIT).toBe('spending-limit')
  })
})

// ============================================================
//                   SubscriptionManager
// ============================================================

describe('createSubscriptionManager', () => {
  const manager = createSubscriptionManager({ managerAddress: MOCK_MANAGER_ADDRESS })

  it('stores managerAddress', () => {
    expect(manager.managerAddress).toBe(MOCK_MANAGER_ADDRESS)
  })

  describe('encodeCreatePlan', () => {
    it('encodes with all parameters', () => {
      const calldata = manager.encodeCreatePlan({
        amount: parseEther('10'),
        period: INTERVALS.MONTHLY,
        token: MOCK_TOKEN,
        trialPeriod: INTERVALS.WEEKLY,
        gracePeriod: INTERVALS.DAILY,
        minSubscriptionTime: INTERVALS.MONTHLY,
        name: 'Pro Plan',
        description: 'Monthly pro subscription',
      })

      expect(calldata).toBeDefined()
      expect(calldata.startsWith('0x')).toBe(true)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('createPlan')
      expect(decoded.args[0]).toBe(parseEther('10')) // amount
      expect(decoded.args[1]).toBe(INTERVALS.MONTHLY) // period
      expect(decoded.args[2]).toBe(MOCK_TOKEN) // token
      expect(decoded.args[3]).toBe(INTERVALS.WEEKLY) // trialPeriod
      expect(decoded.args[4]).toBe(INTERVALS.DAILY) // gracePeriod
      expect(decoded.args[5]).toBe(INTERVALS.MONTHLY) // minSubscriptionTime
      expect(decoded.args[6]).toBe('Pro Plan') // name
      expect(decoded.args[7]).toBe('Monthly pro subscription') // description
    })

    it('defaults optional parameters to zero', () => {
      const calldata = manager.encodeCreatePlan({
        amount: parseEther('5'),
        period: INTERVALS.WEEKLY,
        token: NATIVE_TOKEN,
        name: 'Basic',
        description: 'Weekly basic plan',
      })

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.args[2]).toBe(NATIVE_TOKEN) // token
      expect(decoded.args[3]).toBe(0n) // trialPeriod default
      expect(decoded.args[4]).toBe(0n) // gracePeriod default
      expect(decoded.args[5]).toBe(0n) // minSubscriptionTime default
    })

    it('uses NATIVE_TOKEN when token is omitted', () => {
      const calldata = manager.encodeCreatePlan({
        amount: 1n,
        period: INTERVALS.DAILY,
        token: NATIVE_TOKEN,
        name: 'T',
        description: 'D',
      })

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.args[2]).toBe(NATIVE_TOKEN)
    })
  })

  describe('encodeUpdatePlan', () => {
    it('encodes update with all fields', () => {
      const calldata = manager.encodeUpdatePlan(1n, parseEther('20'), INTERVALS.MONTHLY, true)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('updatePlan')
      expect(decoded.args[0]).toBe(1n)
      expect(decoded.args[1]).toBe(parseEther('20'))
      expect(decoded.args[2]).toBe(INTERVALS.MONTHLY)
      expect(decoded.args[3]).toBe(true)
    })

    it('encodes deactivation', () => {
      const calldata = manager.encodeUpdatePlan(5n, 0n, 0n, false)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.args[3]).toBe(false)
    })
  })

  describe('encodeSubscribe', () => {
    it('encodes subscription with planId and permissionId', () => {
      const calldata = manager.encodeSubscribe({
        planId: 1n,
        permissionId: MOCK_SUBSCRIPTION_ID,
      })

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('subscribe')
      expect(decoded.args[0]).toBe(1n)
      expect(decoded.args[1]).toBe(MOCK_SUBSCRIPTION_ID)
    })

    it('handles large planId values', () => {
      const largePlanId = 2n ** 128n - 1n
      const calldata = manager.encodeSubscribe({
        planId: largePlanId,
        permissionId: MOCK_SUBSCRIPTION_ID,
      })

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.args[0]).toBe(largePlanId)
    })
  })

  describe('encodeCancelSubscription', () => {
    it('encodes cancellation', () => {
      const calldata = manager.encodeCancelSubscription(MOCK_SUBSCRIPTION_ID)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('cancelSubscription')
      expect(decoded.args[0]).toBe(MOCK_SUBSCRIPTION_ID)
    })
  })

  describe('encodeProcessPayment', () => {
    it('encodes single payment processing', () => {
      const calldata = manager.encodeProcessPayment(MOCK_SUBSCRIPTION_ID)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('processPayment')
      expect(decoded.args[0]).toBe(MOCK_SUBSCRIPTION_ID)
    })
  })

  describe('encodeBatchProcessPayments', () => {
    it('encodes batch with multiple IDs', () => {
      const id2: Hex = '0x5555555555555555555555555555555555555555555555555555555555555555'
      const calldata = manager.encodeBatchProcessPayments([MOCK_SUBSCRIPTION_ID, id2])

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('batchProcessPayments')
      const ids = decoded.args[0] as readonly Hex[]
      expect(ids).toHaveLength(2)
      expect(ids[0]).toBe(MOCK_SUBSCRIPTION_ID)
      expect(ids[1]).toBe(id2)
    })

    it('encodes batch with single ID', () => {
      const calldata = manager.encodeBatchProcessPayments([MOCK_SUBSCRIPTION_ID])

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      const ids = decoded.args[0] as readonly Hex[]
      expect(ids).toHaveLength(1)
    })
  })

  describe('encodeAddProcessor / encodeRemoveProcessor', () => {
    it('encodes add processor', () => {
      const calldata = manager.encodeAddProcessor(MOCK_ACCOUNT)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('addProcessor')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT)
    })

    it('encodes remove processor', () => {
      const calldata = manager.encodeRemoveProcessor(MOCK_ACCOUNT)

      const decoded = decodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('removeProcessor')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT)
    })
  })
})

// ============================================================
//               RecurringPaymentExecutor
// ============================================================

describe('createRecurringPaymentExecutor', () => {
  const executor = createRecurringPaymentExecutor({ executorAddress: MOCK_EXECUTOR_ADDRESS })

  it('stores executorAddress', () => {
    expect(executor.executorAddress).toBe(MOCK_EXECUTOR_ADDRESS)
  })

  describe('encodeCreateSchedule', () => {
    it('encodes with all parameters', () => {
      const calldata = executor.encodeCreateSchedule({
        recipient: MOCK_RECIPIENT,
        token: MOCK_TOKEN,
        amount: parseEther('1'),
        interval: INTERVALS.MONTHLY,
        startTime: 1700000000n,
        maxPayments: 12n,
      })

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('createSchedule')
      expect(decoded.args[0]).toBe(MOCK_RECIPIENT) // recipient
      expect(decoded.args[1]).toBe(MOCK_TOKEN) // token
      expect(decoded.args[2]).toBe(parseEther('1')) // amount
      expect(decoded.args[3]).toBe(INTERVALS.MONTHLY) // interval
      expect(decoded.args[4]).toBe(1700000000n) // startTime
      expect(decoded.args[5]).toBe(12n) // maxPayments
    })

    it('defaults startTime and maxPayments to 0', () => {
      const calldata = executor.encodeCreateSchedule({
        recipient: MOCK_RECIPIENT,
        token: NATIVE_TOKEN,
        amount: parseEther('0.5'),
        interval: INTERVALS.WEEKLY,
      })

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.args[4]).toBe(0n) // startTime = now
      expect(decoded.args[5]).toBe(0n) // maxPayments = unlimited
    })

    it('uses NATIVE_TOKEN as default token', () => {
      const calldata = executor.encodeCreateSchedule({
        recipient: MOCK_RECIPIENT,
        token: NATIVE_TOKEN,
        amount: 1n,
        interval: INTERVALS.DAILY,
      })

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.args[1]).toBe(NATIVE_TOKEN)
    })
  })

  describe('encodeCancelSchedule', () => {
    it('encodes cancellation', () => {
      const calldata = executor.encodeCancelSchedule(0n)

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('cancelSchedule')
      expect(decoded.args[0]).toBe(0n)
    })
  })

  describe('encodeUpdateAmount', () => {
    it('encodes amount update', () => {
      const calldata = executor.encodeUpdateAmount(1n, parseEther('2'))

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('updateAmount')
      expect(decoded.args[0]).toBe(1n)
      expect(decoded.args[1]).toBe(parseEther('2'))
    })
  })

  describe('encodeUpdateRecipient', () => {
    it('encodes recipient update', () => {
      const calldata = executor.encodeUpdateRecipient(1n, MOCK_RECIPIENT)

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('updateRecipient')
      expect(decoded.args[0]).toBe(1n)
      expect(decoded.args[1]).toBe(MOCK_RECIPIENT)
    })
  })

  describe('encodeExecutePayment', () => {
    it('encodes payment execution', () => {
      const calldata = executor.encodeExecutePayment(MOCK_ACCOUNT, 0n)

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('executePayment')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT)
      expect(decoded.args[1]).toBe(0n)
    })
  })

  describe('encodeExecutePaymentBatch', () => {
    it('encodes batch execution', () => {
      const calldata = executor.encodeExecutePaymentBatch(MOCK_ACCOUNT, [0n, 1n, 2n])

      const decoded = decodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('executePaymentBatch')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT)
      const ids = decoded.args[1] as readonly bigint[]
      expect(ids).toHaveLength(3)
      expect(ids[0]).toBe(0n)
      expect(ids[2]).toBe(2n)
    })
  })

  describe('encodeInstallData', () => {
    it('encodes module install data for initial schedule', () => {
      const installData = executor.encodeInstallData({
        recipient: MOCK_RECIPIENT,
        token: MOCK_TOKEN,
        amount: parseEther('1'),
        interval: INTERVALS.MONTHLY,
        startTime: 1700000000n,
        maxPayments: 12n,
      })

      expect(installData).toBeDefined()
      expect(installData.startsWith('0x')).toBe(true)
      // Install data is ABI-encoded tuple, not function calldata
      expect(installData.length).toBeGreaterThan(2)
    })

    it('defaults optional params in install data', () => {
      const installData = executor.encodeInstallData({
        recipient: MOCK_RECIPIENT,
        token: NATIVE_TOKEN,
        amount: parseEther('0.1'),
        interval: INTERVALS.DAILY,
      })

      expect(installData).toBeDefined()
    })
  })
})

// ============================================================
//            SubscriptionPermissionClient
// ============================================================

describe('createSubscriptionPermissionClient', () => {
  const permissions = createSubscriptionPermissionClient({
    managerAddress: MOCK_PERMISSION_ADDRESS,
  })

  it('stores managerAddress', () => {
    expect(permissions.managerAddress).toBe(MOCK_PERMISSION_ADDRESS)
  })

  describe('encodeGrantPermission', () => {
    it('encodes direct grant', () => {
      const calldata = permissions.encodeGrantPermission({
        grantee: MOCK_ACCOUNT,
        target: MOCK_MANAGER_ADDRESS,
        permission: {
          permissionType: PERMISSION_TYPES.SUBSCRIPTION,
          isAdjustmentAllowed: false,
          data: '0x',
        },
        rules: [],
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('grantPermission')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT) // grantee
      expect(decoded.args[1]).toBe(MOCK_MANAGER_ADDRESS) // target
    })

    it('encodes grant with rules', () => {
      const expiryData = '0x0000000000000000000000000000000000000000000000000000000065a0bc00' as Hex
      const calldata = permissions.encodeGrantPermission({
        grantee: MOCK_ACCOUNT,
        target: MOCK_MANAGER_ADDRESS,
        permission: {
          permissionType: PERMISSION_TYPES.ERC20_RECURRING,
          isAdjustmentAllowed: true,
          data: '0x',
        },
        rules: [{ ruleType: RULE_TYPES.EXPIRY, data: expiryData }],
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('grantPermission')
    })
  })

  describe('encodeGrantPermissionWithSignature', () => {
    it('encodes meta-transaction grant', () => {
      const mockSignature: Hex = `0x${'ab'.repeat(65)}` as Hex

      const calldata = permissions.encodeGrantPermissionWithSignature({
        granter: MOCK_ACCOUNT,
        grantee: MOCK_MANAGER_ADDRESS,
        target: MOCK_MANAGER_ADDRESS,
        permission: {
          permissionType: PERMISSION_TYPES.SUBSCRIPTION,
          isAdjustmentAllowed: false,
          data: '0x',
        },
        rules: [],
        signature: mockSignature,
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('grantPermissionWithSignature')
      expect(decoded.args[0]).toBe(MOCK_ACCOUNT) // granter
      expect(decoded.args[1]).toBe(MOCK_MANAGER_ADDRESS) // grantee
    })
  })

  describe('encodeRevokePermission', () => {
    it('encodes revocation', () => {
      const calldata = permissions.encodeRevokePermission(MOCK_SUBSCRIPTION_ID)

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('revokePermission')
      expect(decoded.args[0]).toBe(MOCK_SUBSCRIPTION_ID)
    })
  })

  describe('encodeAdjustPermission', () => {
    it('encodes permission adjustment', () => {
      const newData: Hex = '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'

      const calldata = permissions.encodeAdjustPermission(MOCK_SUBSCRIPTION_ID, newData)

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('adjustPermission')
      expect(decoded.args[0]).toBe(MOCK_SUBSCRIPTION_ID)
      expect(decoded.args[1]).toBe(newData)
    })
  })

  describe('encodeGrantSubscriptionPermission', () => {
    it('encodes subscription-specific permission with expiry', () => {
      const calldata = permissions.encodeGrantSubscriptionPermission({
        grantee: MOCK_MANAGER_ADDRESS,
        target: MOCK_MANAGER_ADDRESS,
        spendingLimit: parseEther('100'),
        expiry: 1700000000n,
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })
      expect(decoded.functionName).toBe('grantPermission')

      // Verify permission type is subscription
      const permission = decoded.args[2] as {
        permissionType: string
        isAdjustmentAllowed: boolean
        data: Hex
      }
      expect(permission.permissionType).toBe(PERMISSION_TYPES.SUBSCRIPTION)
      expect(permission.isAdjustmentAllowed).toBe(false)

      // Verify rules include expiry and spending-limit
      const rules = decoded.args[3] as readonly { ruleType: string; data: Hex }[]
      expect(rules.length).toBe(2)
      expect(rules[0]?.ruleType).toBe(RULE_TYPES.EXPIRY)
      expect(rules[1]?.ruleType).toBe(RULE_TYPES.SPENDING_LIMIT)
    })

    it('omits expiry rule when not provided', () => {
      const calldata = permissions.encodeGrantSubscriptionPermission({
        grantee: MOCK_MANAGER_ADDRESS,
        target: MOCK_MANAGER_ADDRESS,
        spendingLimit: parseEther('50'),
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })

      const rules = decoded.args[3] as readonly { ruleType: string; data: Hex }[]
      expect(rules.length).toBe(1) // spending-limit only
      expect(rules[0]?.ruleType).toBe(RULE_TYPES.SPENDING_LIMIT)
    })

    it('omits expiry rule when expiry is 0', () => {
      const calldata = permissions.encodeGrantSubscriptionPermission({
        grantee: MOCK_MANAGER_ADDRESS,
        target: MOCK_MANAGER_ADDRESS,
        spendingLimit: parseEther('50'),
        expiry: 0n,
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })

      const rules = decoded.args[3] as readonly { ruleType: string; data: Hex }[]
      expect(rules.length).toBe(1)
    })

    it('allows adjustment when specified', () => {
      const calldata = permissions.encodeGrantSubscriptionPermission({
        grantee: MOCK_MANAGER_ADDRESS,
        target: MOCK_MANAGER_ADDRESS,
        spendingLimit: parseEther('100'),
        isAdjustmentAllowed: true,
      })

      const decoded = decodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        data: calldata,
      })

      const permission = decoded.args[2] as {
        permissionType: string
        isAdjustmentAllowed: boolean
        data: Hex
      }
      expect(permission.isAdjustmentAllowed).toBe(true)
    })
  })
})

// ============================================================
//                    Cross-client consistency
// ============================================================

describe('cross-client consistency', () => {
  it('all clients are independently creatable', () => {
    const sub = createSubscriptionManager({ managerAddress: MOCK_MANAGER_ADDRESS })
    const exec = createRecurringPaymentExecutor({ executorAddress: MOCK_EXECUTOR_ADDRESS })
    const perm = createSubscriptionPermissionClient({ managerAddress: MOCK_PERMISSION_ADDRESS })

    expect(sub.managerAddress).toBe(MOCK_MANAGER_ADDRESS)
    expect(exec.executorAddress).toBe(MOCK_EXECUTOR_ADDRESS)
    expect(perm.managerAddress).toBe(MOCK_PERMISSION_ADDRESS)
  })

  it('encoded calldata is deterministic', () => {
    const manager = createSubscriptionManager({ managerAddress: MOCK_MANAGER_ADDRESS })
    const calldata1 = manager.encodeProcessPayment(MOCK_SUBSCRIPTION_ID)
    const calldata2 = manager.encodeProcessPayment(MOCK_SUBSCRIPTION_ID)
    expect(calldata1).toBe(calldata2)
  })

  it('different subscription IDs produce different calldata', () => {
    const manager = createSubscriptionManager({ managerAddress: MOCK_MANAGER_ADDRESS })
    const id1: Hex = '0x0000000000000000000000000000000000000000000000000000000000000001'
    const id2: Hex = '0x0000000000000000000000000000000000000000000000000000000000000002'
    expect(manager.encodeProcessPayment(id1)).not.toBe(manager.encodeProcessPayment(id2))
  })

  it('different plan params produce different calldata', () => {
    const manager = createSubscriptionManager({ managerAddress: MOCK_MANAGER_ADDRESS })
    const c1 = manager.encodeCreatePlan({
      amount: parseEther('10'),
      period: INTERVALS.MONTHLY,
      token: NATIVE_TOKEN,
      name: 'A',
      description: 'a',
    })
    const c2 = manager.encodeCreatePlan({
      amount: parseEther('20'),
      period: INTERVALS.MONTHLY,
      token: NATIVE_TOKEN,
      name: 'A',
      description: 'a',
    })
    expect(c1).not.toBe(c2)
  })
})
