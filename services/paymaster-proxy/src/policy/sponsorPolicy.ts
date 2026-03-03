import type { Address } from 'viem'
import { getDefaultPolicyConfig } from '../config/constants'
import type { SpendingReservation, SponsorPolicy, SponsorTracker, UserOperationRpc } from '../types'
import { RiskScorer, type RiskAssessment, type RiskScorerConfig } from './riskScorer'

/**
 * Get default policy configuration from environment
 * Configurable via:
 * - PAYMASTER_DEFAULT_MAX_GAS_LIMIT: Max gas limit per operation (default: 5000000)
 * - PAYMASTER_DEFAULT_MAX_GAS_COST: Max gas cost in wei (default: 1 ETH)
 * - PAYMASTER_DEFAULT_DAILY_LIMIT_PER_SENDER: Daily limit per sender (default: 0.1 ETH)
 * - PAYMASTER_DEFAULT_GLOBAL_DAILY_LIMIT: Global daily limit (default: 10 ETH)
 */
function createDefaultPolicy(): SponsorPolicy {
  const policyConfig = getDefaultPolicyConfig()
  return {
    id: 'default',
    name: 'Default Policy',
    active: true,
    maxGasLimit: policyConfig.maxGasLimit,
    maxGasCost: policyConfig.maxGasCost,
    dailyLimitPerSender: policyConfig.dailyLimitPerSender,
    globalDailyLimit: policyConfig.globalDailyLimit,
  }
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
export type PolicyResult = { allowed: true } | { allowed: false; rejection: PolicyRejection }

/**
 * Sponsor Policy Manager
 */
export class SponsorPolicyManager {
  private policies: Map<string, SponsorPolicy> = new Map()
  private trackers: Map<Address, SponsorTracker> = new Map()
  private globalDailySpent = 0n
  private lastResetDate = ''
  private readonly riskScorer: RiskScorer

  constructor(policies?: SponsorPolicy[], riskScorerConfig?: Partial<RiskScorerConfig>) {
    this.riskScorer = new RiskScorer(riskScorerConfig)
    const initialPolicies = policies ?? [createDefaultPolicy()]
    for (const policy of initialPolicies) {
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
   * Delete a policy by ID
   * @returns true if the policy existed and was deleted
   */
  deletePolicy(id: string): boolean {
    return this.policies.delete(id)
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
      const inWhitelist = policy.whitelist.some((addr) => addr.toLowerCase() === senderLower)
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
      const inBlacklist = policy.blacklist.some((addr) => addr.toLowerCase() === senderLower)
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

    // Expire stale reservations before checking limits
    this.expireReservations()

    // Check daily limit per sender (confirmed + pending)
    if (policy.dailyLimitPerSender && estimatedGasCost) {
      const tracker = this.getOrCreateTracker(userOp.sender)
      const pendingAmount = tracker.pendingReservations.reduce((sum, r) => sum + r.amount, 0n)
      if (tracker.dailyGasSpent + pendingAmount + estimatedGasCost > policy.dailyLimitPerSender) {
        return {
          allowed: false,
          rejection: {
            code: -32004,
            message: 'Daily spending limit exceeded for sender',
            data: {
              spent: tracker.dailyGasSpent.toString(),
              pending: pendingAmount.toString(),
              limit: policy.dailyLimitPerSender.toString(),
            },
          },
        }
      }
    }

    // Check global daily limit (confirmed + pending)
    if (policy.globalDailyLimit && estimatedGasCost) {
      const globalPending = this.getGlobalPendingAmount()
      if (this.globalDailySpent + globalPending + estimatedGasCost > policy.globalDailyLimit) {
        return {
          allowed: false,
          rejection: {
            code: -32004,
            message: 'Global daily spending limit exceeded',
          },
        }
      }
    }

    // Risk scoring assessment
    const riskAssessment = this.riskScorer.assess(userOp)
    if (riskAssessment.shouldReject) {
      return {
        allowed: false,
        rejection: {
          code: -32001,
          message: `Operation rejected by risk assessment (score: ${riskAssessment.score.toFixed(2)}, level: ${riskAssessment.level})`,
          data: {
            riskScore: riskAssessment.score,
            riskLevel: riskAssessment.level,
            factors: riskAssessment.factors.map((f) => ({
              name: f.name,
              score: f.score,
              reason: f.reason,
            })),
          },
        },
      }
    }

    return { allowed: true }
  }

  /** Reservation TTL (5 minutes) */
  private static readonly RESERVATION_TTL_MS = 5 * 60 * 1000

  /**
   * Record gas spending for a sender (immediate confirmation, no reservation)
   */
  recordSpending(sender: Address, gasCost: bigint): void {
    this.resetDailyTrackersIfNeeded()

    const tracker = this.getOrCreateTracker(sender)
    tracker.dailyGasSpent += gasCost
    tracker.dailyOpCount += 1

    this.globalDailySpent += gasCost
  }

  /**
   * Atomically check policy and reserve spending.
   * Eliminates the TOCTOU race between checkPolicy() and reserveSpending()
   * that could allow concurrent requests to exceed spending limits.
   */
  checkAndReserve(
    userOp: UserOperationRpc,
    policyId: string,
    estimatedGasCost: bigint
  ): { allowed: true; reservationId: string } | { allowed: false; rejection: PolicyRejection } {
    const result = this.checkPolicy(userOp, policyId, estimatedGasCost)
    if (!result.allowed) {
      return result
    }
    const reservationId = this.reserveSpending(userOp.sender, estimatedGasCost)
    return { allowed: true, reservationId }
  }

  /**
   * Reserve spending (call at sign time).
   * Returns reservation ID for later settlement/cancellation.
   */
  reserveSpending(sender: Address, gasCost: bigint): string {
    this.resetDailyTrackersIfNeeded()
    const tracker = this.getOrCreateTracker(sender)
    const id = `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    tracker.pendingReservations.push({
      id,
      amount: gasCost,
      createdAt: Date.now(),
    })
    return id
  }

  /**
   * Settle a reservation (mark as confirmed spending).
   * If actualAmount is provided, uses that instead of the estimated amount.
   */
  settleReservation(sender: Address, reservationId: string, actualAmount?: bigint): boolean {
    const tracker = this.trackers.get(sender)
    if (!tracker) return false
    const idx = tracker.pendingReservations.findIndex((r) => r.id === reservationId)
    if (idx === -1) return false
    const removed = tracker.pendingReservations.splice(idx, 1)
    const reservation = removed[0]!
    const amount = actualAmount ?? reservation.amount
    tracker.dailyGasSpent += amount
    tracker.dailyOpCount += 1
    this.globalDailySpent += amount
    return true
  }

  /**
   * Cancel a reservation (remove from pending without confirming spending).
   * Used when a UserOperation fails or is dropped.
   */
  cancelReservation(sender: Address, reservationId: string): boolean {
    const tracker = this.trackers.get(sender)
    if (!tracker) return false
    const idx = tracker.pendingReservations.findIndex((r) => r.id === reservationId)
    if (idx === -1) return false
    tracker.pendingReservations.splice(idx, 1)
    return true
  }

  /**
   * Expire old reservations that exceeded TTL
   */
  expireReservations(): number {
    const now = Date.now()
    let expired = 0
    for (const tracker of this.trackers.values()) {
      const before = tracker.pendingReservations.length
      tracker.pendingReservations = tracker.pendingReservations.filter(
        (r) => now - r.createdAt < SponsorPolicyManager.RESERVATION_TTL_MS
      )
      expired += before - tracker.pendingReservations.length
    }
    return expired
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
        pendingReservations: [],
      }
      this.trackers.set(sender, tracker)
    }
    return tracker
  }

  /**
   * Sum all pending reservation amounts across all trackers
   */
  private getGlobalPendingAmount(): bigint {
    let total = 0n
    for (const tracker of this.trackers.values()) {
      for (const r of tracker.pendingReservations) {
        total += r.amount
      }
    }
    return total
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
        tracker.pendingReservations = []
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
   * Assess risk for a UserOperation without applying policy checks
   */
  assessRisk(userOp: UserOperationRpc): RiskAssessment {
    return this.riskScorer.assess(userOp)
  }

  /**
   * Record operation outcome for sender reputation tracking
   */
  recordRiskOutcome(sender: Address, success: boolean): void {
    this.riskScorer.recordOutcome(sender, success)
  }

  /**
   * Get risk scorer for advanced operations
   */
  getRiskScorer(): RiskScorer {
    return this.riskScorer
  }

  /**
   * Clear all trackers (for testing)
   */
  clearTrackers(): void {
    this.trackers.clear()
    this.globalDailySpent = 0n
    this.lastResetDate = ''
    this.riskScorer.clearHistory()
  }
}
