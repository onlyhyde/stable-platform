import type { Address, Hex } from 'viem'
import type { StealthClient, StealthAnnouncement, AnnouncementFilterOptions, SchemeId } from '../types'

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
 * Fetch announcements in batches for large block ranges
 *
 * This is useful for initial sync when scanning many blocks.
 *
 * @param client - Stealth client instance
 * @param fromBlock - Starting block
 * @param toBlock - Ending block
 * @param batchSize - Number of blocks per batch (default: 10000)
 * @param options - Additional filter options
 * @param onBatch - Callback after each batch
 * @returns All announcements
 */
export async function fetchAnnouncementsBatched(
  client: StealthClient,
  fromBlock: bigint,
  toBlock: bigint,
  batchSize = 10000n,
  options: Omit<AnnouncementFilterOptions, 'fromBlock' | 'toBlock'> = {},
  onBatch?: (batch: StealthAnnouncement[], progress: { current: bigint; total: bigint }) => void
): Promise<StealthAnnouncement[]> {
  const allAnnouncements: StealthAnnouncement[] = []
  let currentBlock = fromBlock

  while (currentBlock <= toBlock) {
    const batchEnd = currentBlock + batchSize - 1n > toBlock
      ? toBlock
      : currentBlock + batchSize - 1n

    const batch = await fetchAnnouncements(client, {
      ...options,
      fromBlock: currentBlock,
      toBlock: batchEnd,
    })

    allAnnouncements.push(...batch)

    if (onBatch) {
      onBatch(batch, {
        current: batchEnd - fromBlock,
        total: toBlock - fromBlock,
      })
    }

    currentBlock = batchEnd + 1n
  }

  return allAnnouncements
}
