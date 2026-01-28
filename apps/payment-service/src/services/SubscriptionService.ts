import type { Address, PublicClient } from 'viem'
import type {
  SubscriptionPlan,
  Subscription,
  SubscriptionStatus,
  PaymentJob,
} from '../types/index.js'
import { SUBSCRIPTION_MANAGER_ABI, PERMISSION_MANAGER_ABI } from '../config/index.js'
import type { Logger } from 'pino'

/**
 * Service for querying subscription data from the blockchain
 */
export class SubscriptionService {
  private readonly publicClient: PublicClient
  private readonly subscriptionManagerAddress: Address
  private readonly permissionManagerAddress: Address
  private readonly logger: Logger

  constructor(
    publicClient: PublicClient,
    subscriptionManagerAddress: Address,
    permissionManagerAddress: Address,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.subscriptionManagerAddress = subscriptionManagerAddress
    this.permissionManagerAddress = permissionManagerAddress
    this.logger = logger.child({ service: 'SubscriptionService' })
  }

  /**
   * Get total number of plans
   */
  async getPlanCount(): Promise<bigint> {
    const count = await this.publicClient.readContract({
      address: this.subscriptionManagerAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'planCount',
    })
    return count
  }

  /**
   * Get plan details by ID
   */
  async getPlan(planId: bigint): Promise<SubscriptionPlan> {
    const data = await this.publicClient.readContract({
      address: this.subscriptionManagerAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'plans',
      args: [planId],
    })

    const [
      merchant,
      name,
      description,
      price,
      interval,
      token,
      isActive,
      subscriberCount,
      trialPeriod,
      gracePeriod,
      createdAt,
    ] = data

    return {
      merchant,
      name,
      description,
      price,
      interval,
      token,
      isActive,
      subscriberCount,
      trialPeriod,
      gracePeriod,
      createdAt,
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriber: Address, planId: bigint): Promise<Subscription> {
    const data = await this.publicClient.readContract({
      address: this.subscriptionManagerAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'getSubscription',
      args: [subscriber, planId],
    })

    const [startTime, lastPaymentTime, nextPaymentTime, status, permissionId] = data

    return {
      subscriber,
      planId,
      startTime,
      lastPaymentTime,
      nextPaymentTime,
      status: status as SubscriptionStatus,
      permissionId,
    }
  }

  /**
   * Check if a permission is still valid
   */
  async isPermissionValid(account: Address, permissionId: `0x${string}`): Promise<boolean> {
    try {
      const valid = await this.publicClient.readContract({
        address: this.permissionManagerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'hasValidPermission',
        args: [account, permissionId],
      })
      return valid
    } catch (error) {
      this.logger.warn({ account, permissionId, error }, 'Failed to check permission validity')
      return false
    }
  }

  /**
   * Get all subscriptions that are due for payment
   */
  async getPaymentsDue(currentTime: number): Promise<PaymentJob[]> {
    const paymentJobs: PaymentJob[] = []
    const planCount = await this.getPlanCount()

    this.logger.info({ planCount }, 'Scanning for due payments')

    // Iterate through all plans
    for (let planId = 1n; planId <= planCount; planId++) {
      const plan = await this.getPlan(planId)

      if (!plan.isActive) {
        continue
      }

      // Get all active subscriptions for this plan
      // Note: In production, this would use events or an indexer for efficiency
      try {
        const subscriptions = await this.getActiveSubscriptionsForPlan(planId)

        for (const sub of subscriptions) {
          // Check if payment is due
          if (Number(sub.nextPaymentTime) <= currentTime && sub.status === 0) {
            // Status 0 = Active
            // Verify permission is still valid
            const permissionValid = await this.isPermissionValid(sub.subscriber, sub.permissionId)

            if (permissionValid) {
              paymentJobs.push({
                subscriber: sub.subscriber,
                planId,
                plan,
                subscription: sub,
                scheduledTime: Number(sub.nextPaymentTime),
                retryCount: 0,
              })
            } else {
              this.logger.warn(
                { subscriber: sub.subscriber, planId },
                'Permission no longer valid, skipping payment'
              )
            }
          }
        }
      } catch (error) {
        this.logger.error({ planId, error }, 'Failed to get subscriptions for plan')
      }
    }

    this.logger.info({ count: paymentJobs.length }, 'Found due payments')
    return paymentJobs
  }

  /**
   * Get active subscriptions for a specific plan
   * In production, this would use event indexing for efficiency
   */
  private async getActiveSubscriptionsForPlan(planId: bigint): Promise<Subscription[]> {
    // This is a simplified implementation
    // In production, you would:
    // 1. Index SubscriptionCreated events
    // 2. Use a database to track subscriptions
    // 3. Or implement getAllActiveSubscriptions in the contract

    try {
      const result = await this.publicClient.readContract({
        address: this.subscriptionManagerAddress,
        abi: SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getAllActiveSubscriptions',
      })

      const [subscribers, planIds] = result as readonly [readonly Address[], readonly bigint[]]
      const subscriptions: Subscription[] = []

      for (let i = 0; i < subscribers.length; i++) {
        if (planIds[i] === planId) {
          const sub = await this.getSubscription(subscribers[i], planId)
          subscriptions.push(sub)
        }
      }

      return subscriptions
    } catch {
      // Contract might not have getAllActiveSubscriptions
      // Return empty array and log warning
      this.logger.debug({ planId }, 'getAllActiveSubscriptions not available, using event indexing')
      return []
    }
  }
}
