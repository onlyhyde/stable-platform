import type { UserOperation } from '@stablenet/types'
import type { Address, Hex } from 'viem'
import type { DependencyTracker, StorageAccessRecord } from '../mempool/dependencyTracker'
import type { MempoolEntry } from '../types'
import type { Logger } from '../utils/logger'
import type { TraceCall } from '../validation/opcodeValidator'
import type { IReputationManager, ISimulationValidator } from '../validation/types'
import { VALIDATION_CONSTANTS } from '../validation/types'

/**
 * Calculate the maximum gas cost in wei for a UserOperation.
 * totalGas = verificationGasLimit + callGasLimit + paymasterVerificationGasLimit
 *          + paymasterPostOpGasLimit + preVerificationGas
 * maxCost = totalGas * maxFeePerGas
 */
export function calculateMaxGasCost(userOp: UserOperation): bigint {
  const totalGas =
    userOp.verificationGasLimit +
    userOp.callGasLimit +
    (userOp.paymasterVerificationGasLimit ?? 0n) +
    (userOp.paymasterPostOpGasLimit ?? 0n) +
    userOp.preVerificationGas
  return totalGas * userOp.maxFeePerGas
}

/**
 * EIP-4337 Section 7.1: Deduplicate senders in bundle.
 * A bundle MUST NOT include multiple UserOperations from the same sender,
 * unless that sender is staked (has sufficient stake and unstake delay).
 */
export async function deduplicateSenders(
  entries: MempoolEntry[],
  simulationValidator: ISimulationValidator,
  reputationManager: IReputationManager,
  logger: Logger
): Promise<MempoolEntry[]> {
  const senderSeen = new Map<string, MempoolEntry>()
  const result: MempoolEntry[] = []

  for (const entry of entries) {
    const senderKey = entry.userOp.sender.toLowerCase()

    if (!senderSeen.has(senderKey)) {
      senderSeen.set(senderKey, entry)
      result.push(entry)
      continue
    }

    // Duplicate sender — check if staked
    try {
      const depositInfo = await simulationValidator.getDepositInfo(entry.userOp.sender)
      const isStaked = reputationManager.isStaked({
        stake: depositInfo.stake,
        unstakeDelaySec: BigInt(depositInfo.unstakeDelaySec),
      })

      if (isStaked) {
        result.push(entry)
        logger.debug(
          { sender: entry.userOp.sender, userOpHash: entry.userOpHash },
          'Allowing duplicate sender in bundle (sender is staked)'
        )
      } else {
        logger.debug(
          { sender: entry.userOp.sender, userOpHash: entry.userOpHash },
          'Skipping duplicate sender in bundle (sender is not staked)'
        )
      }
    } catch (error) {
      // On error, skip the duplicate (conservative approach)
      logger.warn(
        { sender: entry.userOp.sender, error },
        'Failed to check sender stake, skipping duplicate'
      )
    }
  }

  return result
}

/**
 * EIP-4337 Section 7.1: Validate paymaster deposits across bundle.
 * The total gas required by all UserOperations using a given paymaster
 * must not exceed that paymaster's deposit in the EntryPoint.
 */
export async function validatePaymasterDeposits(
  entries: MempoolEntry[],
  simulationValidator: ISimulationValidator,
  logger: Logger
): Promise<MempoolEntry[]> {
  // Aggregate gas requirements per paymaster
  const paymasterGas = new Map<string, { totalGas: bigint; entries: MempoolEntry[] }>()

  for (const entry of entries) {
    if (!entry.userOp.paymaster) continue

    const paymasterKey = entry.userOp.paymaster.toLowerCase()
    const existing = paymasterGas.get(paymasterKey) || { totalGas: 0n, entries: [] }

    existing.totalGas += calculateMaxGasCost(entry.userOp)
    existing.entries.push(entry)
    paymasterGas.set(paymasterKey, existing)
  }

  // Check each paymaster's deposit covers the total gas
  const excludedEntries = new Set<string>()

  for (const [paymasterKey, { totalGas, entries: paymasterEntries }] of paymasterGas) {
    try {
      const depositInfo = await simulationValidator.getDepositInfo(paymasterKey as Address)

      if (depositInfo.deposit < totalGas) {
        logger.warn(
          {
            paymaster: paymasterKey,
            deposit: depositInfo.deposit.toString(),
            requiredGas: totalGas.toString(),
            opCount: paymasterEntries.length,
          },
          'Paymaster deposit insufficient for bundle total gas, removing excess ops'
        )

        // Keep ops until deposit is exhausted, exclude the rest
        let runningCost = 0n
        for (const entry of paymasterEntries) {
          const opMaxCost = calculateMaxGasCost(entry.userOp)

          if (runningCost + opMaxCost <= depositInfo.deposit) {
            runningCost += opMaxCost
          } else {
            excludedEntries.add(entry.userOpHash)
          }
        }
      }
    } catch (error) {
      logger.warn(
        { paymaster: paymasterKey, error },
        'Failed to check paymaster deposit, excluding all ops for this paymaster'
      )
      for (const entry of paymasterEntries) {
        excludedEntries.add(entry.userOpHash)
      }
    }
  }

  return entries.filter((e) => !excludedEntries.has(e.userOpHash))
}

/**
 * EIP-4337 Section 7.3: Detect factory CREATE2 address collisions.
 * Two UserOps that would CREATE2 the same address cannot both succeed.
 * Keeps the first-seen op and excludes later duplicates.
 */
export function detectFactoryCollisions(
  entries: MempoolEntry[],
  dependencyTracker: DependencyTracker | null,
  logger: Logger
): MempoolEntry[] {
  if (!dependencyTracker || entries.length <= 1) {
    return entries
  }

  const hashes = entries.map((e) => e.userOpHash)
  const collisions = dependencyTracker.findFactoryCollisions(hashes)

  if (collisions.length === 0) {
    return entries
  }

  const excluded = new Set(collisions.map((c) => c.excluded))

  for (const collision of collisions) {
    logger.warn(
      {
        keeper: collision.keeper,
        excluded: collision.excluded,
        address: collision.address,
      },
      'Factory CREATE2 address collision detected, excluding later operation'
    )
  }

  return entries.filter((e) => !excluded.has(e.userOpHash))
}

/**
 * EIP-4337 Section 7.3: Apply storage conflict ordering using DependencyTracker.
 * Orders entries by topological sort of storage dependencies.
 * Removes entries with circular dependencies.
 */
export function applyStorageConflictOrdering(
  entries: MempoolEntry[],
  dependencyTracker: DependencyTracker | null,
  logger: Logger
): MempoolEntry[] {
  if (!dependencyTracker || entries.length <= 1) {
    return entries
  }

  const { ordered, conflicting } = dependencyTracker.orderByDependencies(entries)

  if (conflicting.length > 0) {
    logger.warn(
      { conflictCount: conflicting.length },
      'Removed operations with circular storage dependencies from bundle'
    )
  }

  return ordered
}

/**
 * EIP-4337 Section 7.3: Detect write-write storage conflicts.
 * Two ops from different senders that both SSTORE to the same slot cannot
 * safely coexist in a bundle. Excludes the later op (keeps first-seen).
 */
export function detectStorageWriteConflicts(
  entries: MempoolEntry[],
  dependencyTracker: DependencyTracker | null,
  logger: Logger
): MempoolEntry[] {
  if (!dependencyTracker || entries.length <= 1) {
    return entries
  }

  const hashes = entries.map((e) => e.userOpHash)
  const conflicts = dependencyTracker.findWriteConflicts(hashes)

  if (conflicts.length === 0) {
    return entries
  }

  const excluded = new Set(conflicts.map((c) => c.excluded))

  for (const conflict of conflicts) {
    logger.warn(
      {
        keeper: conflict.keeper,
        excluded: conflict.excluded,
        contract: conflict.contract,
        slot: conflict.slot,
      },
      'Storage write-write conflict detected, excluding later operation'
    )
  }

  return entries.filter((e) => !excluded.has(e.userOpHash))
}

/**
 * Extract storage access records and CREATE2 addresses from trace calls
 * for dependency tracking and factory collision detection
 */
export function extractStorageAccess(
  userOpHash: Hex,
  sender: Address,
  calls: TraceCall[]
): StorageAccessRecord {
  const accessedSlots = new Map<Address, Set<string>>()
  const writtenSlots = new Map<Address, Set<string>>()
  const createdAddresses = new Set<Address>()

  const collectData = (traceCalls: TraceCall[]) => {
    for (const call of traceCalls) {
      // Collect storage access
      if (call.storage) {
        // Geth callTracer constraint: opcode↔slot 1:1 mapping not available.
        // Use call-frame-level heuristic: if SSTORE appears in the frame's opcodes,
        // treat ALL storage entries in that frame as writes (conservative but correct).
        const hasStore = call.opcodes.some((op) => op.toUpperCase() === 'SSTORE')

        for (const [contractAddr, slots] of Object.entries(call.storage)) {
          const addr = contractAddr as Address
          if (!accessedSlots.has(addr)) {
            accessedSlots.set(addr, new Set())
          }
          const slotSet = accessedSlots.get(addr)!
          for (const slot of slots) {
            slotSet.add(slot)
          }

          // Record write slots when SSTORE is present in this call frame
          if (hasStore) {
            if (!writtenSlots.has(addr)) {
              writtenSlots.set(addr, new Set())
            }
            const writeSet = writtenSlots.get(addr)!
            for (const slot of slots) {
              writeSet.add(slot)
            }
          }
        }
      }

      // EIP-4337 Section 7.3: Collect CREATE2 addresses for factory collision detection
      if (call.type === 'CREATE2' && call.to) {
        createdAddresses.add(call.to)
      }

      if (call.calls) {
        collectData(call.calls)
      }
    }
  }

  collectData(calls)

  return {
    userOpHash,
    sender,
    accessedSlots,
    writtenSlots: writtenSlots.size > 0 ? writtenSlots : new Map(),
    createdAddresses: createdAddresses.size > 0 ? createdAddresses : undefined,
  }
}

/**
 * Separate entries by whether they have an aggregator
 */
export function separateByAggregator(entries: MempoolEntry[]): {
  aggregatedEntries: MempoolEntry[]
  nonAggregatedEntries: MempoolEntry[]
} {
  const aggregatedEntries: MempoolEntry[] = []
  const nonAggregatedEntries: MempoolEntry[] = []

  for (const entry of entries) {
    if (entry.aggregator && entry.aggregator !== VALIDATION_CONSTANTS.ZERO_ADDRESS) {
      aggregatedEntries.push(entry)
    } else {
      nonAggregatedEntries.push(entry)
    }
  }

  return { aggregatedEntries, nonAggregatedEntries }
}
