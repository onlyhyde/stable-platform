import type { Address, Hex, PublicClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { NATIVE_TOKEN } from './constants'
import type {
  CreatePlanParams,
  Plan,
  SubscribeParams,
  Subscription,
  SubscriptionManagerConfig,
} from './types'
import { SUBSCRIPTION_MANAGER_ABI } from './types'

/**
 * SubscriptionManager client
 *
 * Provides methods to interact with the SubscriptionManager contract
 * for creating plans, subscribing, processing payments, and querying state.
 */
export interface SubscriptionManagerClient {
  /** The SubscriptionManager contract address */
  readonly managerAddress: Address

  // ---- Write encoders (return calldata for UserOp) ----

  /** Encode calldata to create a new subscription plan */
  encodeCreatePlan: (params: CreatePlanParams) => Hex
  /** Encode calldata to update an existing plan */
  encodeUpdatePlan: (planId: bigint, amount: bigint, period: bigint, active: boolean) => Hex
  /** Encode calldata to subscribe to a plan */
  encodeSubscribe: (params: SubscribeParams) => Hex
  /** Encode calldata to cancel a subscription */
  encodeCancelSubscription: (subscriptionId: Hex) => Hex
  /** Encode calldata to process a single payment */
  encodeProcessPayment: (subscriptionId: Hex) => Hex
  /** Encode calldata to batch process payments */
  encodeBatchProcessPayments: (subscriptionIds: readonly Hex[]) => Hex
  /** Encode calldata to add an authorized processor */
  encodeAddProcessor: (processor: Address) => Hex
  /** Encode calldata to remove an authorized processor */
  encodeRemoveProcessor: (processor: Address) => Hex

  // ---- Read functions (require PublicClient) ----

  /** Get plan details */
  getPlan: (client: PublicClient, planId: bigint) => Promise<Plan>
  /** Get subscription details */
  getSubscription: (client: PublicClient, subscriptionId: Hex) => Promise<Subscription>
  /** Get all subscription IDs for a subscriber */
  getSubscriberSubscriptions: (client: PublicClient, subscriber: Address) => Promise<Hex[]>
  /** Get all plan IDs for a merchant */
  getMerchantPlans: (client: PublicClient, merchant: Address) => Promise<bigint[]>
  /** Check if a subscription payment is due */
  isPaymentDue: (client: PublicClient, subscriptionId: Hex) => Promise<boolean>
  /** Filter subscription IDs that are due for payment */
  getDueSubscriptions: (client: PublicClient, subscriptionIds: readonly Hex[]) => Promise<Hex[]>
  /** Get days until next payment (negative if overdue) */
  getDaysUntilNextPayment: (client: PublicClient, subscriptionId: Hex) => Promise<bigint>
  /** Get total plan count */
  getPlanCount: (client: PublicClient) => Promise<bigint>
  /** Get current protocol fee in basis points */
  getProtocolFeeBps: (client: PublicClient) => Promise<bigint>
  /** Check if an address is an authorized processor */
  isAuthorizedProcessor: (client: PublicClient, processor: Address) => Promise<boolean>
}

/**
 * Create a SubscriptionManager client
 *
 * @example
 * ```ts
 * import { createSubscriptionManager } from '@stablenet/plugin-subscription'
 *
 * const manager = createSubscriptionManager({
 *   managerAddress: '0x...',
 * })
 *
 * // Encode a plan creation transaction
 * const calldata = manager.encodeCreatePlan({
 *   amount: parseEther('10'),
 *   period: 2592000n, // 30 days
 *   token: '0x0000000000000000000000000000000000000000',
 *   name: 'Pro Plan',
 *   description: 'Monthly pro subscription',
 * })
 *
 * // Read plan details
 * const plan = await manager.getPlan(publicClient, 1n)
 * ```
 */
export function createSubscriptionManager(
  config: SubscriptionManagerConfig
): SubscriptionManagerClient {
  const { managerAddress } = config

  return {
    managerAddress,

    // ---- Write encoders ----

    encodeCreatePlan(params: CreatePlanParams): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'createPlan',
        args: [
          params.amount,
          params.period,
          params.token ?? NATIVE_TOKEN,
          params.trialPeriod ?? 0n,
          params.gracePeriod ?? 0n,
          params.minSubscriptionTime ?? 0n,
          params.name,
          params.description,
        ],
      })
    },

    encodeUpdatePlan(planId: bigint, amount: bigint, period: bigint, active: boolean): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'updatePlan',
        args: [planId, amount, period, active],
      })
    },

    encodeSubscribe(params: SubscribeParams): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'subscribe',
        args: [params.planId, params.permissionId],
      })
    },

    encodeCancelSubscription(subscriptionId: Hex): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'cancelSubscription',
        args: [subscriptionId],
      })
    },

    encodeProcessPayment(subscriptionId: Hex): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'processPayment',
        args: [subscriptionId],
      })
    },

    encodeBatchProcessPayments(subscriptionIds: readonly Hex[]): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'batchProcessPayments',
        args: [subscriptionIds],
      })
    },

    encodeAddProcessor(processor: Address): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'addProcessor',
        args: [processor],
      })
    },

    encodeRemoveProcessor(processor: Address): Hex {
      return encodeFunctionData({
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'removeProcessor',
        args: [processor],
      })
    },

    // ---- Read functions ----

    async getPlan(client: PublicClient, planId: bigint): Promise<Plan> {
      const result = (await client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan',
        args: [planId],
      })) as {
        merchant: Address
        amount: bigint
        period: bigint
        token: Address
        trialPeriod: bigint
        gracePeriod: bigint
        minSubscriptionTime: bigint
        name: string
        description: string
        active: boolean
        subscriberCount: bigint
      }

      return {
        merchant: result.merchant,
        amount: result.amount,
        period: result.period,
        token: result.token,
        trialPeriod: result.trialPeriod,
        gracePeriod: result.gracePeriod,
        minSubscriptionTime: result.minSubscriptionTime,
        name: result.name,
        description: result.description,
        active: result.active,
        subscriberCount: result.subscriberCount,
      }
    },

    async getSubscription(client: PublicClient, subscriptionId: Hex): Promise<Subscription> {
      const result = (await client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscription',
        args: [subscriptionId],
      })) as {
        planId: bigint
        subscriber: Address
        permissionId: Hex
        startTime: bigint
        lastPayment: bigint
        nextPayment: bigint
        paymentCount: bigint
        totalPaid: bigint
        active: boolean
        inGracePeriod: boolean
      }

      return {
        planId: result.planId,
        subscriber: result.subscriber,
        permissionId: result.permissionId,
        startTime: result.startTime,
        lastPayment: result.lastPayment,
        nextPayment: result.nextPayment,
        paymentCount: result.paymentCount,
        totalPaid: result.totalPaid,
        active: result.active,
        inGracePeriod: result.inGracePeriod,
      }
    },

    async getSubscriberSubscriptions(client: PublicClient, subscriber: Address): Promise<Hex[]> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscriberSubscriptions',
        args: [subscriber],
      }) as Promise<Hex[]>
    },

    async getMerchantPlans(client: PublicClient, merchant: Address): Promise<bigint[]> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getMerchantPlans',
        args: [merchant],
      }) as Promise<bigint[]>
    },

    async isPaymentDue(client: PublicClient, subscriptionId: Hex): Promise<boolean> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'isPaymentDue',
        args: [subscriptionId],
      }) as Promise<boolean>
    },

    async getDueSubscriptions(
      client: PublicClient,
      subscriptionIds: readonly Hex[]
    ): Promise<Hex[]> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getDueSubscriptions',
        args: [subscriptionIds],
      }) as Promise<Hex[]>
    },

    async getDaysUntilNextPayment(client: PublicClient, subscriptionId: Hex): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'daysUntilNextPayment',
        args: [subscriptionId],
      }) as Promise<bigint>
    },

    async getPlanCount(client: PublicClient): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'planCount',
      }) as Promise<bigint>
    },

    async getProtocolFeeBps(client: PublicClient): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'protocolFeeBps',
      }) as Promise<bigint>
    },

    async isAuthorizedProcessor(client: PublicClient, processor: Address): Promise<boolean> {
      return client.readContract({
        address: managerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'authorizedProcessors',
        args: [processor],
      }) as Promise<boolean>
    },
  }
}
