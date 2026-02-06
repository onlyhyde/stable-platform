import type { Address, Hex } from 'viem'
import type {
  AnnouncementFilterOptions,
  SchemeId,
  StealthAnnouncement,
  StealthClient,
} from '../types'

/**
 * Fetch stealth announcements from the blockchain
 *
 * This action queries the EIP-5564 Announcer contract for
 * Announcement events and returns parsed announcements.
 *
 * @example
 * ```typescript
 * const announcements = await fetchAnnouncements(client, {
 *   fromBlock: 1000000n,
 *   toBlock: 'latest',
 *   schemeId: 1,
 * })
 *
 * for (const announcement of announcements) {
 *   const key = computeStealthKey({
 *     announcement,
 *     spendingPrivateKey: '0x...',
 *     viewingPrivateKey: '0x...',
 *   })
 *   if (key) {
 *     console.log('Found stealth payment at:', key.stealthAddress)
 *   }
 * }
 * ```
 *
 * @param client - Stealth client instance
 * @param options - Filter options
 * @returns Array of stealth announcements
 */
export async function fetchAnnouncements(
  client: StealthClient,
  options: AnnouncementFilterOptions = {}
): Promise<StealthAnnouncement[]> {
  const { fromBlock, toBlock = 'latest', schemeId, caller } = options

  // Build filter args
  const args: {
    schemeId?: bigint
    stealthAddress?: undefined
    caller?: Address
  } = {}

  if (schemeId !== undefined) {
    args.schemeId = BigInt(schemeId)
  }
  if (caller) {
    args.caller = caller
  }

  // Fetch logs
  const logs = await client.publicClient.getLogs({
    address: client.announcerAddress,
    event: {
      type: 'event',
      name: 'Announcement',
      inputs: [
        { name: 'schemeId', type: 'uint256', indexed: true },
        { name: 'stealthAddress', type: 'address', indexed: true },
        { name: 'caller', type: 'address', indexed: true },
        { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
        { name: 'metadata', type: 'bytes', indexed: false },
      ],
    },
    args,
    fromBlock,
    toBlock,
  })

  // Parse logs into announcements
  return logs.map((log) => ({
    schemeId: Number(log.args.schemeId) as SchemeId,
    stealthAddress: log.args.stealthAddress as Address,
    caller: log.args.caller as Address,
    ephemeralPubKey: log.args.ephemeralPubKey as Hex,
    metadata: log.args.metadata as Hex,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash as Hex,
    logIndex: log.logIndex,
  }))
}

/**
 * Get the current block number
 *
 * @param client - Stealth client instance
 * @returns Current block number
 */
export async function getCurrentBlock(client: StealthClient): Promise<bigint> {
  return client.publicClient.getBlockNumber()
}

/**
 * Options for batched fetching
 */
export interface FetchAnnouncementsBatchedOptions {
  /** Number of blocks per batch (default: 10000) */
  batchSize?: bigint
  /** Number of concurrent batch requests (default: 3, max: 10) */
  concurrency?: number
  /** Additional filter options */
  filterOptions?: Omit<AnnouncementFilterOptions, 'fromBlock' | 'toBlock'>
  /** Callback after each batch completes */
  onBatch?: (
    batch: StealthAnnouncement[],
    progress: { current: bigint; total: bigint; batchesCompleted: number; totalBatches: number }
  ) => void
  /** Callback on batch error (return true to continue, false to abort) */
  onError?: (error: Error, batchStart: bigint, batchEnd: bigint) => boolean
}

/**
 * Fetch announcements in batches for large block ranges with parallel processing
 *
 * This is useful for initial sync when scanning many blocks. Uses concurrent
 * requests for faster syncing while respecting RPC rate limits.
 *
 * @param client - Stealth client instance
 * @param fromBlock - Starting block
 * @param toBlock - Ending block
 * @param options - Batch fetching options
 * @returns All announcements sorted by block number
 */
export async function fetchAnnouncementsBatched(
  client: StealthClient,
  fromBlock: bigint,
  toBlock: bigint,
  options: FetchAnnouncementsBatchedOptions = {}
): Promise<StealthAnnouncement[]> {
  const { batchSize = 10000n, concurrency = 3, filterOptions = {}, onBatch, onError } = options

  // Validate inputs
  if (fromBlock > toBlock) {
    return []
  }

  // Limit concurrency to prevent RPC abuse
  const safeConcurrency = Math.min(Math.max(1, concurrency), 10)

  // Calculate all batch ranges
  const batches: Array<{ start: bigint; end: bigint }> = []
  let currentBlock = fromBlock

  while (currentBlock <= toBlock) {
    const batchEnd =
      currentBlock + batchSize - 1n > toBlock ? toBlock : currentBlock + batchSize - 1n
    batches.push({ start: currentBlock, end: batchEnd })
    currentBlock = batchEnd + 1n
  }

  const totalBatches = batches.length
  const totalBlocks = toBlock - fromBlock + 1n
  const allAnnouncements: StealthAnnouncement[] = []
  let batchesCompleted = 0

  // Process batches in parallel chunks
  for (let i = 0; i < batches.length; i += safeConcurrency) {
    const chunk = batches.slice(i, i + safeConcurrency)

    const results = await Promise.allSettled(
      chunk.map(async ({ start, end }) => {
        return fetchAnnouncements(client, {
          ...filterOptions,
          fromBlock: start,
          toBlock: end,
        })
      })
    )

    // Process results
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const batchInfo = chunk[j]

      // Safety check - should never happen but satisfies TypeScript
      if (!result || !batchInfo) continue

      const { start, end } = batchInfo

      if (result.status === 'fulfilled') {
        allAnnouncements.push(...result.value)
        batchesCompleted++

        if (onBatch) {
          onBatch(result.value, {
            current: end - fromBlock + 1n,
            total: totalBlocks,
            batchesCompleted,
            totalBatches,
          })
        }
      } else {
        // result.status === 'rejected'
        const error =
          result.reason instanceof Error ? result.reason : new Error(String(result.reason))

        if (onError) {
          const shouldContinue = onError(error, start, end)
          if (!shouldContinue) {
            throw error
          }
        } else {
          // Default: throw on error
          throw error
        }
      }
    }
  }

  // Sort by block number for consistent ordering
  return allAnnouncements.sort((a, b) => {
    if (a.blockNumber === undefined || b.blockNumber === undefined) return 0
    return Number(a.blockNumber - b.blockNumber)
  })
}
