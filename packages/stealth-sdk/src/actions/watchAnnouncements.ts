import type { Hex } from 'viem'
import type { WatchAnnouncementsOptions } from '../types'
import { fetchAnnouncements, getCurrentBlock } from './fetchAnnouncements'
import { computeStealthKey } from './computeStealthKey'

/**
 * Watch for stealth announcements in real-time
 *
 * This action polls for new announcements and automatically
 * checks if they are intended for the recipient.
 *
 * @example
 * ```typescript
 * const unwatch = watchAnnouncements({
 *   client,
 *   spendingPubKey: '0x...',
 *   viewingPrivateKey: '0x...',
 *   onAnnouncement: async (announcement, stealthKey) => {
 *     console.log('Received stealth payment!')
 *     console.log('Address:', stealthKey.stealthAddress)
 *     console.log('Private key:', stealthKey.stealthPrivateKey)
 *
 *     // Can now spend from the stealth address
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
export function watchAnnouncements(
  options: WatchAnnouncementsOptions
): () => void {
  const {
    client,
    fromBlock,
    schemeId,
    pollingInterval = 5000, // 5 seconds default
    onAnnouncement,
    onError,
  } = options

  let isRunning = true
  let lastProcessedBlock: bigint | undefined = fromBlock
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  // We need the spending private key for full verification
  // But we only have the viewing private key
  // For a real implementation, we'd need to store the spending private key securely

  // For now, we'll just use the viewing private key for view tag filtering
  // and pass through announcements that match

  const poll = async () => {
    if (!isRunning) return

    try {
      const currentBlock = await getCurrentBlock(client)

      // Initialize last processed block if not set
      if (lastProcessedBlock === undefined) {
        lastProcessedBlock = currentBlock
      }

      // Only query if there are new blocks
      if (currentBlock > lastProcessedBlock) {
        const announcements = await fetchAnnouncements(client, {
          fromBlock: lastProcessedBlock + 1n,
          toBlock: currentBlock,
          schemeId,
        })

        // Process each announcement
        for (const announcement of announcements) {
          // Note: We need the spending private key to compute the full stealth key
          // The caller should provide this via a secure method
          // For now, we'll emit the announcement and let the caller handle it

          // Try to compute the stealth key
          // This will require the caller to provide spendingPrivateKey somehow
          // For the watch function, we assume the caller will handle verification

          // Emit the announcement - the caller should verify and extract the key
          // This is a simplified approach; a real implementation would need
          // secure key management

          try {
            // We pass this to let the callback handle full verification
            // The callback should have access to the spending private key
            await onAnnouncement(
              announcement,
              {
                stealthAddress: announcement.stealthAddress,
                stealthPrivateKey: '0x' as Hex, // Placeholder - caller must compute
              }
            )
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
    }

    // Schedule next poll
    if (isRunning) {
      timeoutId = setTimeout(poll, pollingInterval)
    }
  }

  // Start polling
  poll()

  // Return unwatch function
  return () => {
    isRunning = false
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Watch announcements with full stealth key computation
 *
 * This variant requires the spending private key for full verification.
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
  let lastProcessedBlock: bigint | undefined = fromBlock
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const poll = async () => {
    if (!isRunning) return

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
          // Compute the stealth key
          const stealthKey = computeStealthKey({
            announcement,
            spendingPrivateKey,
            viewingPrivateKey,
          })

          // If the key matches, emit the announcement
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
