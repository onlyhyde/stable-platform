import type { Hex } from 'viem'
import { checkViewTag, generateStealthAddress as generateStealthAddressCrypto } from '../crypto'
import { extractViewTag } from '../crypto/viewTag'
import type { CheckAnnouncementParams, StealthAnnouncement } from '../types'

/**
 * Check if an announcement is intended for the recipient using view tag filtering.
 *
 * This performs a quick probabilistic check using the view tag. A matching view tag
 * indicates a ~99.6% probability (1/256 false positive rate) that this announcement
 * is for the recipient.
 *
 * For definitive verification, use `computeStealthKey` which requires the spending
 * private key and performs full cryptographic verification.
 *
 * @example
 * ```typescript
 * // Quick filter using view tag
 * const isProbablyForMe = checkAnnouncement({
 *   announcement,
 *   viewingPrivateKey: '0x...',
 * })
 *
 * if (isProbablyForMe) {
 *   // Verify and compute the full key
 *   const key = computeStealthKey({
 *     announcement,
 *     spendingPrivateKey: '0x...',
 *     viewingPrivateKey: '0x...',
 *   })
 *   if (key) {
 *     // Definitely for us
 *   }
 * }
 * ```
 *
 * @param params - Check parameters
 * @returns True if the view tag matches (probable recipient), false otherwise
 */
export function checkAnnouncement(params: CheckAnnouncementParams): boolean {
  const { announcement, viewingPrivateKey } = params

  if (!announcement.ephemeralPubKey || !announcement.metadata) {
    return false
  }

  try {
    const announcementViewTag = extractViewTag(announcement.metadata)
    return checkViewTag(announcement.ephemeralPubKey, viewingPrivateKey, announcementViewTag)
  } catch {
    // Invalid ephemeral public key or metadata format
    return false
  }
}

/**
 * Verify an announcement with full cryptographic verification.
 *
 * This function verifies that an announcement was created for the given
 * stealth meta-address by re-deriving the stealth address from the
 * ephemeral public key and comparing it to the announced stealth address.
 *
 * @param announcement - The announcement to verify
 * @param spendingPubKey - Recipient's spending public key
 * @param viewingPubKey - Recipient's viewing public key
 * @returns True if the announcement stealth address matches the derived one
 */
export function verifyAnnouncement(
  announcement: StealthAnnouncement,
  spendingPubKey: Hex,
  viewingPubKey: Hex
): boolean {
  if (!announcement.ephemeralPubKey || !announcement.stealthAddress) {
    return false
  }

  try {
    // Re-derive what the stealth address should be
    const derived = generateStealthAddressCrypto(
      spendingPubKey,
      viewingPubKey,
      announcement.ephemeralPubKey
    )

    // Compare with the announced stealth address
    return derived.stealthAddress.toLowerCase() === announcement.stealthAddress.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Filter announcements by view tag
 *
 * This is a quick pre-filter to reduce the number of announcements
 * that need full cryptographic verification.
 *
 * @param announcements - Array of announcements to filter
 * @param viewingPrivateKey - Viewing private key
 * @returns Announcements that pass the view tag filter
 */
export function filterByViewTag<T extends { ephemeralPubKey: string; metadata: string }>(
  announcements: T[],
  viewingPrivateKey: string
): T[] {
  return announcements.filter((announcement) => {
    try {
      const viewTag = extractViewTag(announcement.metadata as `0x${string}`)
      return checkViewTag(
        announcement.ephemeralPubKey as `0x${string}`,
        viewingPrivateKey as `0x${string}`,
        viewTag
      )
    } catch {
      return false
    }
  })
}
