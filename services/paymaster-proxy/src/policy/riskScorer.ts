import type { Address, Hex } from 'viem'
import { slice as sliceHex } from 'viem'
import type { UserOperationRpc } from '../types'

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  /** Overall risk score (0.0 = safe, 1.0 = highest risk) */
  score: number
  /** Risk level classification */
  level: 'low' | 'medium' | 'high' | 'critical'
  /** Individual risk factor scores */
  factors: RiskFactor[]
  /** Whether the operation should be rejected based on threshold */
  shouldReject: boolean
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  name: string
  score: number
  weight: number
  reason: string
}

/**
 * Risk scorer configuration
 */
export interface RiskScorerConfig {
  /** Score threshold for rejection (default: 0.8) */
  rejectThreshold: number
  /** Score threshold for additional review (default: 0.5) */
  reviewThreshold: number
  /** Known safe contract addresses (lower risk for calls to these) */
  trustedTargets: Address[]
  /** Known risky function selectors (e.g., approve to unknown, delegatecall) */
  riskySelectors: Hex[]
  /** Enable sender history tracking */
  trackSenderHistory: boolean
}

const DEFAULT_CONFIG: RiskScorerConfig = {
  rejectThreshold: 0.8,
  reviewThreshold: 0.5,
  trustedTargets: [],
  riskySelectors: [
    '0x095ea7b3', // approve(address,uint256)
    '0xa22cb465', // setApprovalForAll(address,bool)
    '0x42842e0e', // safeTransferFrom (NFT)
    '0xf242432a', // safeTransferFrom (ERC-1155)
    // Kernel v0.3.3 module management operations
    '0x856b02ec', // forceUninstallModule — HIGH: can bypass security modules
    '0x19a6f00a', // setDelegatecallWhitelist — HIGH: can expose account to delegatecall
    '0xdb01ebce', // setEnforceDelegatecallWhitelist — HIGH: disabling removes delegatecall restriction
    '0x166add9c', // replaceModule — MEDIUM: swaps module atomically
    '0xb5c13e39', // setHookGasLimit — LOW: DoS risk minimal
  ],
  trackSenderHistory: true,
}

/**
 * Sender operation history for risk tracking
 */
interface SenderHistory {
  opCount: number
  firstSeenAt: number
  lastSeenAt: number
  uniqueTargets: Set<string>
  rejectionCount: number
  successCount: number
}

/**
 * Risk scorer for UserOperations
 *
 * Evaluates risk based on:
 * - callData pattern analysis (function selector, target contract)
 * - Sender reputation/history
 * - Gas parameter anomalies
 * - Factory/paymaster patterns
 */
export class RiskScorer {
  private readonly config: RiskScorerConfig
  private readonly senderHistory: Map<string, SenderHistory> = new Map()

  constructor(config?: Partial<RiskScorerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Assess risk for a UserOperation
   */
  assess(userOp: UserOperationRpc): RiskAssessment {
    const factors: RiskFactor[] = [
      this.assessCallDataPattern(userOp),
      this.assessGasParameters(userOp),
      this.assessSenderReputation(userOp.sender),
      this.assessFactoryUsage(userOp),
    ]

    // Weighted average score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
    const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0)
    const score = totalWeight > 0 ? weightedScore / totalWeight : 0

    const level = this.classifyLevel(score)
    const shouldReject = score >= this.config.rejectThreshold

    // Track sender history
    if (this.config.trackSenderHistory) {
      this.recordSenderActivity(userOp.sender, userOp)
    }

    return { score, level, factors, shouldReject }
  }

  /**
   * Record operation outcome for sender reputation
   */
  recordOutcome(sender: Address, success: boolean): void {
    const key = sender.toLowerCase()
    const history = this.senderHistory.get(key)
    if (history) {
      if (success) {
        history.successCount++
      } else {
        history.rejectionCount++
      }
    }
  }

  /**
   * Get risk stats for monitoring
   */
  getStats(): {
    trackedSenders: number
    avgRiskByLevel: Record<string, number>
  } {
    return {
      trackedSenders: this.senderHistory.size,
      avgRiskByLevel: { low: 0, medium: 0, high: 0, critical: 0 },
    }
  }

  /**
   * Assess callData patterns for risky operations
   */
  private assessCallDataPattern(userOp: UserOperationRpc): RiskFactor {
    const callData = userOp.callData
    let score = 0
    let reason = 'Normal callData pattern'

    // Empty callData is unusual for sponsored operations
    if (!callData || callData === '0x' || callData.length <= 2) {
      score = 0.6
      reason = 'Empty callData — unusual for sponsored operation'
      return { name: 'calldata_pattern', score, weight: 0.35, reason }
    }

    // Check function selector against risky selectors
    if (callData.length >= 10) {
      const selector = sliceHex(callData as Hex, 0, 4)
      if (this.config.riskySelectors.includes(selector)) {
        // Tiered scoring for module management operations
        const highRiskSelectors = [
          '0x856b02ec', // forceUninstallModule
          '0x19a6f00a', // setDelegatecallWhitelist
          '0xdb01ebce', // setEnforceDelegatecallWhitelist
        ]
        const lowRiskSelectors = [
          '0xb5c13e39', // setHookGasLimit
        ]
        if (highRiskSelectors.includes(selector)) {
          score = 0.85
          reason = `High-risk module management operation: ${selector}`
        } else if (lowRiskSelectors.includes(selector)) {
          score = 0.4
          reason = `Low-risk module management operation: ${selector}`
        } else {
          score = 0.7
          reason = `Risky function selector detected: ${selector}`
        }
      }
    }

    // Very large callData may indicate complex/unusual operations
    if (callData.length > 10000) {
      score = Math.max(score, 0.5)
      reason = `Large callData (${callData.length} chars) — increased complexity`
    }

    return { name: 'calldata_pattern', score, weight: 0.35, reason }
  }

  /**
   * Assess gas parameters for anomalies
   */
  private assessGasParameters(userOp: UserOperationRpc): RiskFactor {
    let score = 0
    let reason = 'Normal gas parameters'

    const callGas = BigInt(userOp.callGasLimit)
    const verificationGas = BigInt(userOp.verificationGasLimit)
    const maxFee = BigInt(userOp.maxFeePerGas)

    // Extremely high gas limits may indicate gas griefing
    if (callGas > 10_000_000n) {
      score = 0.6
      reason = `High callGasLimit: ${callGas}`
    }

    // Very high maxFeePerGas (>500 gwei) is unusual
    if (maxFee > 500_000_000_000n) {
      score = Math.max(score, 0.5)
      reason = `Unusually high maxFeePerGas: ${maxFee}`
    }

    // Verification gas much higher than call gas is suspicious
    if (verificationGas > callGas * 3n && callGas > 0n) {
      score = Math.max(score, 0.4)
      reason = `Verification gas disproportionate to call gas`
    }

    return { name: 'gas_parameters', score, weight: 0.25, reason }
  }

  /**
   * Assess sender reputation based on history
   */
  private assessSenderReputation(sender: Address): RiskFactor {
    const key = sender.toLowerCase()
    const history = this.senderHistory.get(key)

    if (!history) {
      // New sender — moderate baseline risk
      return {
        name: 'sender_reputation',
        score: 0.3,
        weight: 0.25,
        reason: 'New sender — no history available',
      }
    }

    let score = 0
    let reason = 'Known sender with good history'

    // High rejection rate is a red flag
    const totalOps = history.successCount + history.rejectionCount
    if (totalOps > 0) {
      const rejectionRate = history.rejectionCount / totalOps
      if (rejectionRate > 0.5) {
        score = 0.8
        reason = `High rejection rate: ${(rejectionRate * 100).toFixed(0)}%`
      } else if (rejectionRate > 0.2) {
        score = 0.5
        reason = `Moderate rejection rate: ${(rejectionRate * 100).toFixed(0)}%`
      }
    }

    // Long-active sender with many successful ops is lower risk
    if (history.successCount > 10 && history.rejectionCount === 0) {
      score = 0.1
      reason = `Established sender: ${history.successCount} successful ops`
    }

    return { name: 'sender_reputation', score, weight: 0.25, reason }
  }

  /**
   * Assess factory usage patterns
   */
  private assessFactoryUsage(userOp: UserOperationRpc): RiskFactor {
    let score = 0
    let reason = 'No factory usage'

    if (userOp.factory) {
      // Account creation via factory — slightly elevated risk
      score = 0.3
      reason = 'New account deployment via factory'

      // Factory with very large factoryData
      if (userOp.factoryData && userOp.factoryData.length > 1000) {
        score = 0.5
        reason = 'Factory deployment with large init data'
      }
    }

    return { name: 'factory_usage', score, weight: 0.15, reason }
  }

  /**
   * Classify risk level from score
   */
  private classifyLevel(score: number): RiskAssessment['level'] {
    if (score >= 0.8) return 'critical'
    if (score >= 0.5) return 'high'
    if (score >= 0.3) return 'medium'
    return 'low'
  }

  /**
   * Record sender activity for history tracking
   */
  private recordSenderActivity(sender: Address, userOp: UserOperationRpc): void {
    const key = sender.toLowerCase()
    const now = Date.now()
    const existing = this.senderHistory.get(key)

    if (existing) {
      existing.opCount++
      existing.lastSeenAt = now
    } else {
      this.senderHistory.set(key, {
        opCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        uniqueTargets: new Set(),
        rejectionCount: 0,
        successCount: 0,
      })
    }
  }

  /**
   * Clear all sender history (for testing)
   */
  clearHistory(): void {
    this.senderHistory.clear()
  }
}
