import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { ENTRY_POINT_ABI, HANDLE_AGGREGATED_OPS_ABI } from '../abi'
import type { DependencyTracker } from '../mempool/dependencyTracker'
import type { Mempool } from '../mempool/mempool'
import { packForContract } from '../shared/packUserOp'
import type { MempoolEntry } from '../types'
import type { Logger } from '../utils/logger'
import type { AggregatorValidator, OpcodeValidator, UserOperationValidator } from '../validation'
import type { UserOperationEventData, UserOpsPerAggregator } from '../validation/types'
import { VALIDATION_CONSTANTS } from '../validation/types'
import {
  applyStorageConflictOrdering,
  deduplicateSenders,
  detectFactoryCollisions,
  detectStorageWriteConflicts,
  extractStorageAccess,
  separateByAggregator,
  validatePaymasterDeposits,
} from './bundleBuilder'
import { diagnoseBundleFailure, parseUserOperationEvents } from './bundleDiagnostics'

/**
 * Bundle executor configuration
 */
export interface BundleExecutorConfig {
  entryPoint: Address
  beneficiary: Address
  maxBundleSize: number
  bundleInterval: number
}

/**
 * Bundle executor for submitting UserOperations to EntryPoint
 */
export class BundleExecutor {
  private publicClient: PublicClient
  private walletClient: WalletClient
  private mempool: Mempool
  private validator: UserOperationValidator
  private aggregatorValidator: AggregatorValidator | null = null
  private dependencyTracker: DependencyTracker | null = null
  private config: BundleExecutorConfig
  private logger: Logger
  private bundleTimer: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    mempool: Mempool,
    validator: UserOperationValidator,
    config: BundleExecutorConfig,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.mempool = mempool
    this.validator = validator
    this.config = config
    this.logger = logger.child({ module: 'executor' })
  }

  /**
   * Start the bundle executor
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.bundleTimer = setInterval(() => {
      this.tryBundle().catch((err) => {
        this.logger.error({ err }, 'Bundle execution failed')
      })
    }, this.config.bundleInterval)

    this.logger.info({ interval: this.config.bundleInterval }, 'Bundle executor started')
  }

  /**
   * Stop the bundle executor
   */
  stop(): void {
    if (this.bundleTimer) {
      clearInterval(this.bundleTimer)
      this.bundleTimer = null
    }
    this.isRunning = false
    this.logger.info('Bundle executor stopped')
  }

  /**
   * Set the aggregator validator for handling aggregated operations
   */
  setAggregatorValidator(validator: AggregatorValidator): void {
    this.aggregatorValidator = validator
    this.logger.info('Aggregator validator configured')
  }

  /**
   * Set the dependency tracker for storage conflict detection
   */
  setDependencyTracker(tracker: DependencyTracker): void {
    this.dependencyTracker = tracker
    this.logger.info('Dependency tracker configured for storage conflict detection')
  }

  /**
   * Try to create and submit a bundle
   */
  async tryBundle(): Promise<Hex | null> {
    const pending = this.mempool.getPending(this.config.entryPoint, this.config.maxBundleSize)

    if (pending.length === 0) {
      return null
    }

    this.logger.debug({ count: pending.length }, 'Creating bundle from pending operations')

    // Pre-flight validation
    const validEntries = await this.preflightValidation(pending)

    if (validEntries.length === 0) {
      this.logger.debug('No valid operations after pre-flight validation')
      return null
    }

    // EIP-4337 Section 7.1: Deduplicate senders (unstaked senders get max 1 op per bundle)
    const simulationValidator = this.validator.getSimulationValidator()
    const reputationManager = this.validator.getReputationManager()
    const dedupedEntries = await deduplicateSenders(
      validEntries,
      simulationValidator,
      reputationManager,
      this.logger
    )

    if (dedupedEntries.length === 0) {
      this.logger.debug('No valid operations after sender deduplication')
      return null
    }

    // EIP-4337 Section 7.3: Detect factory CREATE2 address collisions
    const collisionFreeEntries = detectFactoryCollisions(
      dedupedEntries,
      this.dependencyTracker,
      this.logger
    )

    if (collisionFreeEntries.length === 0) {
      this.logger.debug('No valid operations after factory collision detection')
      return null
    }

    // EIP-4337 Section 7.3: Detect and exclude write-write storage conflicts
    const writeConflictFreeEntries = detectStorageWriteConflicts(
      collisionFreeEntries,
      this.dependencyTracker,
      this.logger
    )

    if (writeConflictFreeEntries.length === 0) {
      this.logger.debug('No valid operations after storage write conflict detection')
      return null
    }

    // EIP-4337 Section 7.3: Order by storage dependencies to prevent conflicts
    const orderedEntries = applyStorageConflictOrdering(
      writeConflictFreeEntries,
      this.dependencyTracker,
      this.logger
    )

    if (orderedEntries.length === 0) {
      this.logger.debug('No valid operations after storage conflict resolution')
      return null
    }

    // EIP-4337 Section 7.1: Validate paymaster deposits cover total gas in bundle
    const depositValidEntries = await validatePaymasterDeposits(
      orderedEntries,
      simulationValidator,
      this.logger
    )

    if (depositValidEntries.length === 0) {
      this.logger.debug('No valid operations after paymaster deposit validation')
      return null
    }

    return this.submitBundle(depositValidEntries)
  }

  /**
   * Pre-flight validation before bundling.
   * Re-validates operations to ensure they're still valid.
   */
  private async preflightValidation(entries: MempoolEntry[]): Promise<MempoolEntry[]> {
    const valid: MempoolEntry[] = []
    const opcodeValidator = this.validator.getOpcodeValidator() as OpcodeValidator | undefined

    // Pre-flight uses handleOps eth_call against the real EntryPoint (no stateOverride).
    // This is more reliable than simulateValidation which requires EntryPointSimulations
    // bytecode injection via stateOverride (unsupported on some chains like StableNet).
    for (const entry of entries) {
      try {
        await this.preflightHandleOpsCheck(entry)

        // Re-validate opcodes and storage access (ERC-7562) before inclusion
        if (opcodeValidator) {
          await opcodeValidator.validate(
            entry.userOp.sender,
            entry.userOp.factory,
            entry.userOp.paymaster
          )
        }

        valid.push(entry)

        // Capture trace results for dependency tracking
        if (this.dependencyTracker && opcodeValidator) {
          const traceResult = opcodeValidator.getLastTraceResult()
          if (traceResult) {
            const accessRecord = extractStorageAccess(
              entry.userOpHash,
              entry.userOp.sender,
              traceResult.calls
            )
            if (accessRecord.accessedSlots.size > 0) {
              this.dependencyTracker.recordAccess(accessRecord)
            }
          }
        }
      } catch (error) {
        // Remove invalid operation from mempool
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.mempool.updateStatus(entry.userOpHash, 'dropped', undefined, undefined, errorMessage)

        this.logger.warn(
          { userOpHash: entry.userOpHash, error: errorMessage },
          'Operation failed pre-flight validation, dropped from mempool'
        )
      }
    }

    return valid
  }

  /**
   * Pre-flight check using handleOps eth_call against the real EntryPoint.
   * Unlike simulateValidation (which requires EntryPointSimulations stateOverride),
   * this works on all chains by calling the actual deployed EntryPoint contract.
   */
  private async preflightHandleOpsCheck(entry: MempoolEntry): Promise<void> {
    const packedOp = packForContract(entry.userOp)
    const data = encodeFunctionData({
      abi: ENTRY_POINT_ABI,
      functionName: 'handleOps',
      args: [[packedOp], this.config.beneficiary],
    })

    await this.publicClient.call({
      account: this.walletClient.account!,
      to: this.config.entryPoint,
      data,
    })
  }

  /**
   * Submit a bundle of UserOperations
   */
  async submitBundle(entries: MempoolEntry[]): Promise<Hex> {
    const { aggregatedEntries, nonAggregatedEntries } = separateByAggregator(entries)

    let data: Hex

    // If all operations use aggregators and we have aggregator validator
    if (
      aggregatedEntries.length > 0 &&
      nonAggregatedEntries.length === 0 &&
      this.aggregatorValidator
    ) {
      data = await this.encodeHandleAggregatedOps(aggregatedEntries)
    } else if (
      aggregatedEntries.length > 0 &&
      nonAggregatedEntries.length > 0 &&
      this.aggregatorValidator
    ) {
      // Mixed bundle - encode handleAggregatedOps including non-aggregated as zero-address group
      data = await this.encodeHandleAggregatedOps(entries)
    } else {
      // All non-aggregated - use handleOps
      const userOps = entries.map((e) => e.userOp)
      const packedOps = userOps.map((op) => packForContract(op))

      data = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: 'handleOps',
        args: [packedOps, this.config.beneficiary],
      })
    }

    // Mark operations as submitted
    for (const entry of entries) {
      this.mempool.updateStatus(entry.userOpHash, 'submitted')
    }

    try {
      // Estimate gas for the bundle
      const gasEstimate = await this.publicClient.estimateGas({
        account: this.walletClient.account!,
        to: this.config.entryPoint,
        data,
      })

      // Add 20% buffer
      const gasLimit = (gasEstimate * 120n) / 100n

      // Submit transaction
      const hash = await this.walletClient.sendTransaction({
        account: this.walletClient.account!,
        chain: this.walletClient.chain,
        to: this.config.entryPoint,
        data,
        gas: gasLimit,
      })

      this.logger.info({ hash, opCount: entries.length }, 'Bundle submitted successfully')

      // Update transaction hash for all operations
      for (const entry of entries) {
        this.mempool.updateStatus(entry.userOpHash, 'submitted', hash)
      }

      // Wait for receipt and update status
      this.waitForReceipt(hash, entries).catch((err) => {
        this.logger.error({ err, hash }, 'Failed to get bundle receipt')
      })

      return hash
    } catch (error) {
      // ── Detailed revert reason analysis ───────────────────────────────
      const failureReason = await diagnoseBundleFailure(
        error,
        data,
        entries,
        this.publicClient,
        this.walletClient,
        this.config.entryPoint,
        this.logger
      )

      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          ...failureReason,
          opCount: entries.length,
          entryPoint: this.config.entryPoint,
          beneficiary: this.config.beneficiary,
        },
        'Bundle submission failed — see details above'
      )

      // Mark operations as failed with detailed reason
      const reasonStr =
        failureReason.decodedReason ?? (error instanceof Error ? error.message : 'Unknown error')
      for (const entry of entries) {
        this.mempool.updateStatus(entry.userOpHash, 'failed', undefined, undefined, reasonStr)
      }

      throw error
    }
  }

  /**
   * Wait for bundle transaction receipt and update statuses
   */
  private async waitForReceipt(hash: Hex, entries: MempoolEntry[]): Promise<void> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60000,
      })

      const blockNumber = receipt.blockNumber

      // Parse UserOperationEvent logs
      const userOpEvents = parseUserOperationEvents(
        receipt.logs,
        this.config.entryPoint,
        this.logger
      )

      // Create a map of userOpHash to event data
      const eventMap = new Map<Hex, UserOperationEventData>()
      for (const event of userOpEvents) {
        eventMap.set(event.userOpHash, event)
      }

      // Update status for each entry based on events
      for (const entry of entries) {
        const event = eventMap.get(entry.userOpHash)

        if (event) {
          const status = event.success ? 'included' : 'failed'
          this.mempool.updateStatus(
            entry.userOpHash,
            status,
            hash,
            blockNumber,
            event.success ? undefined : 'UserOperation execution failed'
          )

          // Update reputation for included operations
          if (event.success) {
            this.validator.updateReputationIncluded(entry.userOp)
          }
        } else {
          // No event found - might have been dropped
          const status = receipt.status === 'success' ? 'included' : 'failed'
          this.mempool.updateStatus(
            entry.userOpHash,
            status,
            hash,
            blockNumber,
            status === 'failed' ? 'Transaction reverted' : undefined
          )

          if (status === 'included') {
            this.validator.updateReputationIncluded(entry.userOp)
          }
        }
      }

      this.logger.info(
        {
          hash,
          status: receipt.status,
          blockNumber: blockNumber.toString(),
          eventsFound: userOpEvents.length,
        },
        'Bundle confirmed'
      )
    } catch (error) {
      this.logger.error({ error, hash }, 'Failed to get transaction receipt')
    }
  }

  /**
   * Encode handleAggregatedOps call for aggregated operations
   */
  private async encodeHandleAggregatedOps(entries: MempoolEntry[]): Promise<Hex> {
    if (!this.aggregatorValidator) {
      throw new Error('Aggregator validator not configured')
    }

    // Group entries by aggregator
    const groupedByAggregator = new Map<Address, MempoolEntry[]>()

    for (const entry of entries) {
      const aggregator = entry.aggregator || VALIDATION_CONSTANTS.ZERO_ADDRESS
      const existing = groupedByAggregator.get(aggregator) || []
      existing.push(entry)
      groupedByAggregator.set(aggregator, existing)
    }

    // Build opsPerAggregator array
    const opsPerAggregator: UserOpsPerAggregator[] = []

    for (const [aggregator, groupEntries] of groupedByAggregator) {
      const packedOps = groupEntries.map((e) => packForContract(e.userOp))

      let aggregatedSignature: Hex

      if (aggregator === VALIDATION_CONSTANTS.ZERO_ADDRESS) {
        // No aggregator - use empty signature for this group
        aggregatedSignature = '0x' as Hex
      } else {
        // Aggregate signatures through the aggregator contract
        aggregatedSignature = await this.aggregatorValidator.aggregateSignatures(
          aggregator,
          packedOps.map((op) => ({
            ...op,
            accountGasLimits: op.accountGasLimits,
          }))
        )

        // Validate the aggregated signature
        await this.aggregatorValidator.validateSignatures(
          aggregator,
          packedOps.map((op) => ({
            ...op,
            accountGasLimits: op.accountGasLimits,
          })),
          aggregatedSignature
        )
      }

      opsPerAggregator.push({
        userOps: packedOps.map((op) => ({
          ...op,
          accountGasLimits: op.accountGasLimits,
        })),
        aggregator,
        signature: aggregatedSignature,
      })
    }

    // Encode the handleAggregatedOps call
    return encodeFunctionData({
      abi: HANDLE_AGGREGATED_OPS_ABI,
      functionName: 'handleAggregatedOps',
      args: [opsPerAggregator, this.config.beneficiary],
    })
  }
}
