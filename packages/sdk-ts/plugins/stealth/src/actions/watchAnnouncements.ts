import type { Hex } from 'viem'
import type { SchemeId, StealthAnnouncement, WatchAnnouncementsOptions } from '../types'
import { filterByViewTag } from './checkAnnouncement'
import { computeStealthKey } from './computeStealthKey'
import { fetchAnnouncements, getCurrentBlock } from './fetchAnnouncements'

/**
 * Options for watching announcements without key computation
 */
export interface WatchAnnouncementsSimpleOptions {
  client: WatchAnnouncementsOptions['client']
  viewingPrivateKey: Hex
  fromBlock?: bigint
  schemeId?: SchemeId
  pollingInterval?: number
  /**
   * Called for each announcement that passes the view tag filter.
   * Note: This callback receives only the announcement without the private key.
   * Use `watchAnnouncementsWithKey` if you need the stealth private key.
   */
  onAnnouncement: (announcement: StealthAnnouncement) => void | Promise<void>
  onError?: (error: Error) => void
}

/**
 * Watch for stealth announcements with view tag filtering only.
 *
 * This function polls for new announcements and filters them using view tags.
 * It does NOT compute the stealth private key - use `watchAnnouncementsWithKey`
 * if you need the private key for spending.
 *
 * This is useful for:
 * - Notification systems that don't need spending capability
 * - Display-only wallets
 * - Pre-filtering before secure key computation
 *
 * @example
 * ```typescript
 * const unwatch = watchAnnouncements({
 *   client,
 *   viewingPrivateKey: '0x...',
 *   onAnnouncement: (announcement) => {
 *     console.log('Potential payment detected at:', announcement.stealthAddress)
 *     // Notify user, then compute key securely when needed
 *   },
 *   onError: (error) => {
 *     console.error('Watch error:', error)
 *   },
 * })
 *
 * // Later, to stop watching:
 * unwatch()
 * ```
 *
 * @param options - Watch options
 * @returns Unwatch function to stop watching
 */
export function watchAnnouncements(options: WatchAnnouncementsSimpleOptions): () => void {
  const {
    client,
    viewingPrivateKey,
    fromBlock,
    schemeId,
    pollingInterval = 5000,
    onAnnouncement,
    onError,
  } = options

  let isRunning = true
  let isPolling = false // Mutex to prevent concurrent polling
  let lastProcessedBlock: bigint | undefined = fromBlock
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const poll = async () => {
    // Prevent concurrent polling
    if (!isRunning || isPolling) return
    isPolling = true

    try {
      const currentBlock = await getCurrentBlock(client)

      if (lastProcessedBlock === undefined) {
        lastProcessedBlock = currentBlock
      }

      if (currentBlock > lastProcessedBlock) {
        const announcements = await fetchAnnouncements(client, {
          fromBlock: lastProcessedBlock + 1n,
          toBlock: currentBlock,
          schemeId,
        })

        // Filter by view tag
        const matchingAnnouncements = filterByViewTag(announcements, viewingPrivateKey)

        // Process matching announcements
        for (const announcement of matchingAnnouncements) {
          try {
            await onAnnouncement(announcement)
          } catch (error) {
            if (onError) {
              onError(error instanceof Error ? error : new Error(String(error)))
            }
          }
        }

        lastProcessedBlock = currentBlock
      }
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      isPolling = false
    }

    // Schedule next poll
    if (isRunning) {
      timeoutId = setTimeout(poll, pollingInterval)
    }
  }

  // Start polling
  poll()

  return () => {
    isRunning = false
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Watch announcements with full stealth key computation.
 *
 * This function polls for new announcements, verifies them cryptographically,
 * and computes the stealth private key for matching announcements.
 *
 * Use this when you need the stealth private key for spending from stealth addresses.
 *
 * @example
 * ```typescript
 * const unwatch = watchAnnouncementsWithKey({
 *   client,
 *   spendingPrivateKey: '0x...',
 *   viewingPrivateKey: '0x...',
 *   onAnnouncement: async (announcement, stealthKey) => {
 *     console.log('Received stealth payment!')
 *     console.log('Address:', stealthKey.stealthAddress)
 *     console.log('Private key:', stealthKey.stealthPrivateKey)
 *     // Can now spend from the stealth address
 *   },
 *   onError: (error) => console.error('Watch error:', error),
 * })
 *
 * // Later, to stop watching:
 * unwatch()
 * ```
 *
 * @param options - Watch options including spending private key
 * @returns Unwatch function
 */
export function watchAnnouncementsWithKey(
  options: WatchAnnouncementsOptions & { spendingPrivateKey: Hex }
): () => void {
  const {
    client,
    spendingPrivateKey,
    viewingPrivateKey,
    fromBlock,
    schemeId,
    pollingInterval = 5000,
    onAnnouncement,
    onError,
  } = options

  let isRunning = true
  let isPolling = false // Mutex to prevent concurrent polling
  let lastProcessedBlock: bigint | undefined = fromBlock
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const poll = async () => {
    // Prevent concurrent polling
    if (!isRunning || isPolling) return
    isPolling = true

    try {
      const currentBlock = await getCurrentBlock(client)

      if (lastProcessedBlock === undefined) {
        lastProcessedBlock = currentBlock
      }

      if (currentBlock > lastProcessedBlock) {
        const announcements = await fetchAnnouncements(client, {
          fromBlock: lastProcessedBlock + 1n,
          toBlock: currentBlock,
          schemeId,
        })

        for (const announcement of announcements) {
          // Compute the stealth key with full cryptographic verification
          const stealthKey = computeStealthKey({
            announcement,
            spendingPrivateKey,
            viewingPrivateKey,
          })

          // If the key matches, emit the announcement with the computed key
          if (stealthKey) {
            try {
              await onAnnouncement(announcement, stealthKey)
            } catch (error) {
              if (onError) {
                onError(error instanceof Error ? error : new Error(String(error)))
              }
            }
          }
        }

        lastProcessedBlock = currentBlock
      }
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      isPolling = false
    }

    if (isRunning) {
      timeoutId = setTimeout(poll, pollingInterval)
    }
  }

  poll()

  return () => {
    isRunning = false
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
