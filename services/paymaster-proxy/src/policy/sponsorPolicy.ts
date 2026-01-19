import type { Address, } from 'viem'
import type { SponsorPolicy, SponsorTracker, UserOperationRpc } from '../types'

/**
 * Default policy configuration
 */
const DEFAULT_POLICY: SponsorPolicy = {
  id: 'default',
  name: 'Default Policy',
  active: true,
  maxGasLimit: 5000000n,
  maxGasCost: 10n ** 18n, // 1 ETH
  dailyLimitPerSender: 10n ** 17n, // 0.1 ETH
  globalDailyLimit: 10n ** 19n, // 10 ETH
}

/**
 * Policy rejection reason
 */
export interface PolicyRejection {
  code: number
  message: string
  data?: unknown
}

/**
 * Policy check result
 */
export type PolicyResult =
  | { allowed: true }
  | { allowed: false; rejection: PolicyRejection }

/**
 * Sponsor Policy Manager
 */
export class SponsorPolicyManager {
  private policies: Map<string, SponsorPolicy> = new Map()
  private trackers: Map<Address, SponsorTracker> = new Map()
  private globalDailySpent = 0n
  private lastResetDate = ''

  constructor(policies: SponsorPolicy[] = [DEFAULT_POLICY]) {
    for (const policy of policies) {
      this.policies.set(policy.id, policy)
    }
  }

  /**
   * Add or update a policy
   */
  setPolicy(policy: SponsorPolicy): void {
    this.policies.set(policy.id, policy)
  }

  /**
   * Get a policy by ID
   */
  getPolicy(id: string): SponsorPolicy | undefined {
    return this.policies.get(id)
  }

  /**
   * Get all policies
   */
  getAllPolicies(): SponsorPolicy[] {
    return Array.from(this.policies.values())
  }

  /**
   * Check if a UserOperation is allowed by policy
   */
  checkPolicy(
    userOp: UserOperationRpc,
    policyId = 'default',
    estimatedGasCost?: bigint
  ): PolicyResult {
    const policy = this.policies.get(policyId)

    if (!policy) {
      return {
        allowed: false,
        rejection: {
          code: -32001,
          message: `Policy ${policyId} not found`,
        },
      }
    }

    if (!policy.active) {
      return {
        allowed: false,
        rejection: {
          code: -32001,
          message: 'Policy is not active',
        },
      }
    }

    // Check time window
    const now = Math.floor(Date.now() / 1000)
    if (policy.startTime && now < policy.startTime) {
      return {
        allowed: false,
        rejection: {
          code: -32001,
          message: 'Policy not yet active',
        },
      }
    }

    if (policy.endTime && now > policy.endTime) {
      return {
        allowed: false,
        rejection: {
          code: -32001,
          message: 'Policy has expired',
        },
      }
    }

    // Check whitelist
    if (policy.whitelist && policy.whitelist.length > 0) {
      const senderLower = userOp.sender.toLowerCase()
      const inWhitelist = policy.whitelist.some(
        (addr) => addr.toLowerCase() === senderLower
      )
      if (!inWhitelist) {
        return {
          allowed: false,
          rejection: {
            code: -32001,
            message: 'Sender not in whitelist',
          },
        }
      }
    }

    // Check blacklist
    if (policy.blacklist && policy.blacklist.length > 0) {
      const senderLower = userOp.sender.toLowerCase()
      const inBlacklist = policy.blacklist.some(
        (addr) => addr.toLowerCase() === senderLower
      )
      if (inBlacklist) {
        return {
          allowed: false,
          rejection: {
            code: -32001,
            message: 'Sender is blacklisted',
          },
        }
      }
    }

    // Check gas limit
    if (policy.maxGasLimit) {
      const totalGas =
        BigInt(userOp.callGasLimit) +
        BigInt(userOp.verificationGasLimit) +
        BigInt(userOp.preVerificationGas)

      if (totalGas > policy.maxGasLimit) {
        return {
          allowed: false,
          rejection: {
            code: -32001,
            message: `Gas limit exceeds maximum: ${totalGas} > ${policy.maxGasLimit}`,
          },
        }
      }
    }

    // Check gas cost
    if (policy.maxGasCost && estimatedGasCost) {
      if (estimatedGasCost > policy.maxGasCost) {
        return {
          allowed: false,
          rejection: {
            code: -32001,
            message: `Gas cost exceeds maximum: ${estimatedGasCost} > ${policy.maxGasCost}`,
          },
        }
      }
    }

    // Reset daily trackers if needed
    this.resetDailyTrackersIfNeeded()

    // Check daily limit per sender
    if (policy.dailyLimitPerSender && estimatedGasCost) {
      const tracker = this.getOrCreateTracker(userOp.sender)
      if (tracker.dailyGasSpent + estimatedGasCost > policy.dailyLimitPerSender) {
        return {
          allowed: false,
          rejection: {
            code: -32004,
            message: 'Daily spending limit exceeded for sender',
            data: {
              spent: tracker.dailyGasSpent.toString(),
              limit: policy.dailyLimitPerSender.toString(),
            },
          },
        }
      }
    }

    // Check global daily limit
    if (policy.globalDailyLimit && estimatedGasCost) {
      if (this.globalDailySpent + estimatedGasCost > policy.globalDailyLimit) {
        return {
          allowed: false,
          rejection: {
            code: -32004,
            message: 'Global daily spending limit exceeded',
          },
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Record gas spending for a sender
   */
  recordSpending(sender: Address, gasCost: bigint): void {
    this.resetDailyTrackersIfNeeded()

    const tracker = this.getOrCreateTracker(sender)
    tracker.dailyGasSpent += gasCost
    tracker.dailyOpCount += 1

    this.globalDailySpent += gasCost
  }

  /**
   * Get tracker for a sender
   */
  getTracker(sender: Address): SponsorTracker | undefined {
    return this.trackers.get(sender)
  }

  /**
   * Get or create tracker for a sender
   */
  private getOrCreateTracker(sender: Address): SponsorTracker {
    let tracker = this.trackers.get(sender)
    if (!tracker) {
      tracker = {
        sender,
        dailyGasSpent: 0n,
        dailyOpCount: 0,
        lastResetDate: this.getTodayDate(),
      }
      this.trackers.set(sender, tracker)
    }
    return tracker
  }

  /**
   * Reset daily trackers if a new day has started
   */
  private resetDailyTrackersIfNeeded(): void {
    const today = this.getTodayDate()
    if (today !== this.lastResetDate) {
      for (const tracker of this.trackers.values()) {
        tracker.dailyGasSpent = 0n
        tracker.dailyOpCount = 0
        tracker.lastResetDate = today
      }
      this.globalDailySpent = 0n
      this.lastResetDate = today
    }
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0]!
  }

  /**
   * Clear all trackers (for testing)
   */
  clearTrackers(): void {
    this.trackers.clear()
    this.globalDailySpent = 0n
    this.lastResetDate = ''
  }
}
