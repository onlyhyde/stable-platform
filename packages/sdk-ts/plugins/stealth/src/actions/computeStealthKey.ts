import { checkViewTag, computeStealthPrivateKey } from '../crypto'
import { extractViewTag } from '../crypto/viewTag'
import type { ComputedStealthKey, ComputeStealthKeyParams } from '../types'

/**
 * Error thrown when stealth key computation fails due to invalid inputs
 */
export class StealthKeyComputationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'StealthKeyComputationError'
  }
}

/**
 * Result of computeStealthKey operation
 */
export type ComputeStealthKeyResult =
  | { success: true; key: ComputedStealthKey }
  | {
      success: false
      reason: 'view_tag_mismatch' | 'address_mismatch' | 'invalid_input' | 'computation_error'
      error?: Error
    }

/**
 * Compute the stealth private key from an announcement
 *
 * This action is used by the recipient to derive the private key
 * for a stealth address that was created for them.
 *
 * @example
 * ```typescript
 * const result = computeStealthKey({
 *   announcement,
 *   spendingPrivateKey: '0x...',
 *   viewingPrivateKey: '0x...',
 * })
 *
 * if (result) {
 *   // result.stealthPrivateKey can be used to spend from result.stealthAddress
 * }
 * ```
 *
 * @param params - Computation parameters
 * @returns The stealth key if the announcement is for the recipient, null otherwise
 */
export function computeStealthKey(params: ComputeStealthKeyParams): ComputedStealthKey | null {
  const { announcement, spendingPrivateKey, viewingPrivateKey } = params

  // Validate inputs
  if (!announcement?.ephemeralPubKey || !announcement?.metadata || !announcement?.stealthAddress) {
    return null
  }

  if (!spendingPrivateKey || !viewingPrivateKey) {
    return null
  }

  // First, check the view tag for quick filtering
  try {
    const announcementViewTag = extractViewTag(announcement.metadata)
    const viewTagMatches = checkViewTag(
      announcement.ephemeralPubKey,
      viewingPrivateKey,
      announcementViewTag
    )

    if (!viewTagMatches) {
      // View tag doesn't match - this announcement is not for us
      return null
    }
  } catch {
    // If we can't extract or check view tag, try full computation
    // This handles cases where metadata format is different
  }

  // Compute the full stealth private key
  try {
    const result = computeStealthPrivateKey(
      announcement.ephemeralPubKey,
      spendingPrivateKey,
      viewingPrivateKey
    )

    // Verify the computed address matches the announcement
    if (result.stealthAddress.toLowerCase() !== announcement.stealthAddress.toLowerCase()) {
      // Address doesn't match - this announcement is not for us
      return null
    }

    return result
  } catch {
    // Computation failed (invalid keys, etc.)
    return null
  }
}

/**
 * Compute stealth key with detailed result information
 *
 * Unlike computeStealthKey which returns null for any failure,
 * this function provides detailed information about why the
 * computation failed.
 *
 * @param params - Computation parameters
 * @returns Detailed result with success/failure information
 */
export function computeStealthKeyWithResult(
  params: ComputeStealthKeyParams
): ComputeStealthKeyResult {
  const { announcement, spendingPrivateKey, viewingPrivateKey } = params

  // Validate inputs
  if (!announcement?.ephemeralPubKey || !announcement?.metadata || !announcement?.stealthAddress) {
    return {
      success: false,
      reason: 'invalid_input',
      error: new Error('Missing required announcement fields'),
    }
  }

  if (!spendingPrivateKey || !viewingPrivateKey) {
    return {
      success: false,
      reason: 'invalid_input',
      error: new Error('Missing private keys'),
    }
  }

  // Check view tag
  try {
    const announcementViewTag = extractViewTag(announcement.metadata)
    const viewTagMatches = checkViewTag(
      announcement.ephemeralPubKey,
      viewingPrivateKey,
      announcementViewTag
    )

    if (!viewTagMatches) {
      return { success: false, reason: 'view_tag_mismatch' }
    }
  } catch {
    // View tag check failed, but we'll try full computation anyway
  }

  // Compute stealth key
  try {
    const result = computeStealthPrivateKey(
      announcement.ephemeralPubKey,
      spendingPrivateKey,
      viewingPrivateKey
    )

    if (result.stealthAddress.toLowerCase() !== announcement.stealthAddress.toLowerCase()) {
      return { success: false, reason: 'address_mismatch' }
    }

    return { success: true, key: result }
  } catch (error) {
    return {
      success: false,
      reason: 'computation_error',
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
