import type { Address } from 'viem'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { SponsorPolicyResponse } from '../types'

export interface GetSponsorPolicyConfig {
  policyManager: SponsorPolicyManager
  supportedChainIds: number[]
}

export type GetSponsorPolicyResult =
  | { success: true; data: SponsorPolicyResponse }
  | { success: false; error: { code: number; message: string; data?: unknown } }

/**
 * Handle pm_getSponsorPolicy request
 *
 * Checks whether a given sender address is eligible for gas sponsorship
 * based on the configured policies.
 */
export function handleGetSponsorPolicy(
  senderAddress: Address,
  chainId: string,
  config: GetSponsorPolicyConfig
): GetSponsorPolicyResult {
  const chainIdNum = Number(chainId)
  if (!config.supportedChainIds.includes(chainIdNum)) {
    return {
      success: false,
      error: {
        code: -32002,
        message: `Chain ${chainIdNum} not supported`,
        data: { supportedChainIds: config.supportedChainIds },
      },
    }
  }

  const policy = config.policyManager.getPolicy('default')
  if (!policy || !policy.active) {
    return {
      success: true,
      data: {
        isAvailable: false,
        reason: 'No active sponsor policy',
      },
    }
  }

  // Check whitelist
  if (policy.whitelist && policy.whitelist.length > 0) {
    const senderLower = senderAddress.toLowerCase()
    const inWhitelist = policy.whitelist.some((addr) => addr.toLowerCase() === senderLower)
    if (!inWhitelist) {
      return {
        success: true,
        data: {
          isAvailable: false,
          reason: 'Sender not in whitelist',
        },
      }
    }
  }

  // Check blacklist
  if (policy.blacklist && policy.blacklist.length > 0) {
    const senderLower = senderAddress.toLowerCase()
    const inBlacklist = policy.blacklist.some((addr) => addr.toLowerCase() === senderLower)
    if (inBlacklist) {
      return {
        success: true,
        data: {
          isAvailable: false,
          reason: 'Sender is blacklisted',
        },
      }
    }
  }

  // Calculate remaining daily limit
  const tracker = config.policyManager.getTracker(senderAddress)
  const dailySpent = tracker?.dailyGasSpent ?? 0n
  const dailyLimit = policy.dailyLimitPerSender ?? 0n
  const dailyRemaining = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0n

  return {
    success: true,
    data: {
      isAvailable: true,
      dailyLimitRemaining: dailyRemaining.toString(),
      perTxLimit: policy.maxGasCost?.toString(),
    },
  }
}
