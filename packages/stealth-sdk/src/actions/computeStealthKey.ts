import type { ComputedStealthKey, ComputeStealthKeyParams } from '../types'
import { computeStealthPrivateKey, checkViewTag } from '../crypto'
import { extractViewTag } from '../crypto/viewTag'

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
export function computeStealthKey(
  params: ComputeStealthKeyParams
): ComputedStealthKey | null {
  const { announcement, spendingPrivateKey, viewingPrivateKey } = params

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
  }

  // Compute the full stealth private key
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
}
