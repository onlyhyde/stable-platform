import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { concat, decodeEventLog, encodeFunctionData, pad, toHex } from 'viem'
import { ENTRY_POINT_ABI, EVENT_SIGNATURES, HANDLE_AGGREGATED_OPS_ABI } from '../abi'
import {
  extractErrorData,
  matchesErrorSelector,
  decodeFailedOp,
  decodeFailedOpWithRevert,
  parseSimulationError,
  formatRevertReason,
  isSignatureFailure,
  parseValidationData,
} from '../validation/errors'
import type {
  DependencyTracker,
  StorageAccessRecord,
} from '../mempool/dependencyTracker'
import type { Mempool } from '../mempool/mempool'
import type { MempoolEntry, UserOperation } from '../types'
import type { Logger } from '../utils/logger'
import type { AggregatorValidator, OpcodeValidator, UserOperationValidator } from '../validation'
import type { TraceCall } from '../validation/opcodeValidator'
import type { UserOperationEventData, UserOpsPerAggregator } from '../validation/types'
import { VALIDATION_CONSTANTS } from '../validation/types'

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
    const dedupedEntries = await this.deduplicateSenders(validEntries)

    if (dedupedEntries.length === 0) {
      this.logger.debug('No valid operations after sender deduplication')
      return null
    }

    // EIP-4337 Section 7.3: Detect factory CREATE2 address collisions
    const collisionFreeEntries = this.detectFactoryCollisions(dedupedEntries)

    if (collisionFreeEntries.length === 0) {
      this.logger.debug('No valid operations after factory collision detection')
      return null
    }

    // EIP-4337 Section 7.3: Detect and exclude write-write storage conflicts
    const writeConflictFreeEntries = this.detectStorageWriteConflicts(collisionFreeEntries)

    if (writeConflictFreeEntries.length === 0) {
      this.logger.debug('No valid operations after storage write conflict detection')
      return null
    }

    // EIP-4337 Section 7.3: Order by storage dependencies to prevent conflicts
    const orderedEntries = this.applyStorageConflictOrdering(writeConflictFreeEntries)

    if (orderedEntries.length === 0) {
      this.logger.debug('No valid operations after storage conflict resolution')
      return null
    }

    // EIP-4337 Section 7.1: Validate paymaster deposits cover total gas in bundle
    const depositValidEntries = await this.validatePaymasterDeposits(orderedEntries)

    if (depositValidEntries.length === 0) {
      this.logger.debug('No valid operations after paymaster deposit validation')
      return null
    }

    return this.submitBundle(depositValidEntries)
  }

  /**
   * Pre-flight validation before bundling
   * Re-validates operations to ensure they're still valid
   */
  private async preflightValidation(entries: MempoolEntry[]): Promise<MempoolEntry[]> {
    const valid: MempoolEntry[] = []
    const simulationValidator = this.validator.getSimulationValidator()
    const opcodeValidator = this.validator.getOpcodeValidator() as OpcodeValidator | undefined

    for (const entry of entries) {
      try {
        // Re-simulate before bundling
        await simulationValidator.simulate(entry.userOp)

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
            const accessRecord = this.extractStorageAccess(
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
   * EIP-4337 Section 7.1: Deduplicate senders in bundle
   * A bundle MUST NOT include multiple UserOperations from the same sender,
   * unless that sender is staked (has sufficient stake and unstake delay).
   */
  private async deduplicateSenders(entries: MempoolEntry[]): Promise<MempoolEntry[]> {
    const simulationValidator = this.validator.getSimulationValidator()
    const reputationManager = this.validator.getReputationManager()
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
          this.logger.debug(
            { sender: entry.userOp.sender, userOpHash: entry.userOpHash },
            'Allowing duplicate sender in bundle (sender is staked)'
          )
        } else {
          this.logger.debug(
            { sender: entry.userOp.sender, userOpHash: entry.userOpHash },
            'Skipping duplicate sender in bundle (sender is not staked)'
          )
        }
      } catch (error) {
        // On error, skip the duplicate (conservative approach)
        this.logger.warn(
          { sender: entry.userOp.sender, error },
          'Failed to check sender stake, skipping duplicate'
        )
      }
    }

    return result
  }

  /**
   * EIP-4337 Section 7.1: Validate paymaster deposits across bundle
   * The total gas required by all UserOperations using a given paymaster
   * must not exceed that paymaster's deposit in the EntryPoint.
   */
  private async validatePaymasterDeposits(entries: MempoolEntry[]): Promise<MempoolEntry[]> {
    const simulationValidator = this.validator.getSimulationValidator()

    // Aggregate gas requirements per paymaster
    const paymasterGas = new Map<string, { totalGas: bigint; entries: MempoolEntry[] }>()

    for (const entry of entries) {
      if (!entry.userOp.paymaster) continue

      const paymasterKey = entry.userOp.paymaster.toLowerCase()
      const existing = paymasterGas.get(paymasterKey) || { totalGas: 0n, entries: [] }

      // Calculate max gas cost for this UserOp:
      // verificationGasLimit + callGasLimit + paymasterVerificationGasLimit + paymasterPostOpGasLimit + preVerificationGas
      const opMaxGas =
        entry.userOp.verificationGasLimit +
        entry.userOp.callGasLimit +
        (entry.userOp.paymasterVerificationGasLimit ?? 0n) +
        (entry.userOp.paymasterPostOpGasLimit ?? 0n) +
        entry.userOp.preVerificationGas

      // Gas cost in wei = opMaxGas * maxFeePerGas
      const opMaxCost = opMaxGas * entry.userOp.maxFeePerGas

      existing.totalGas += opMaxCost
      existing.entries.push(entry)
      paymasterGas.set(paymasterKey, existing)
    }

    // Check each paymaster's deposit covers the total gas
    const excludedEntries = new Set<string>()

    for (const [paymasterKey, { totalGas, entries: paymasterEntries }] of paymasterGas) {
      try {
        const depositInfo = await simulationValidator.getDepositInfo(paymasterKey as Address)

        if (depositInfo.deposit < totalGas) {
          this.logger.warn(
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
            const opMaxGas =
              entry.userOp.verificationGasLimit +
              entry.userOp.callGasLimit +
              (entry.userOp.paymasterVerificationGasLimit ?? 0n) +
              (entry.userOp.paymasterPostOpGasLimit ?? 0n) +
              entry.userOp.preVerificationGas
            const opMaxCost = opMaxGas * entry.userOp.maxFeePerGas

            if (runningCost + opMaxCost <= depositInfo.deposit) {
              runningCost += opMaxCost
            } else {
              excludedEntries.add(entry.userOpHash)
            }
          }
        }
      } catch (error) {
        this.logger.warn(
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
   * Submit a bundle of UserOperations
   */
  async submitBundle(entries: MempoolEntry[]): Promise<Hex> {
    // Separate aggregated and non-aggregated operations
    const { aggregatedEntries, nonAggregatedEntries } = this.separateByAggregator(entries)

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
      const packedOps = userOps.map((op) => this.packUserOp(op))

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
      const failureReason = await this.diagnoseBundleFailure(error, data, entries)

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
      const reasonStr = failureReason.decodedReason ?? (error instanceof Error ? error.message : 'Unknown error')
      for (const entry of entries) {
        this.mempool.updateStatus(
          entry.userOpHash,
          'failed',
          undefined,
          undefined,
          reasonStr
        )
      }

      throw error
    }
  }

  /**
   * Diagnose why a bundle submission failed.
   * Extracts structured revert data from the error and optionally
   * re-runs handleOps via eth_call to get detailed revert info.
   */
  private async diagnoseBundleFailure(
    error: unknown,
    handleOpsData: Hex,
    entries: MempoolEntry[]
  ): Promise<{
    decodedReason?: string
    failedOpIndex?: number
    failedOpReason?: string
    innerRevertData?: string
    errorSelector?: string
    rawErrorData?: string
    userOpDetails?: Record<string, unknown>[]
  }> {
    const result: {
      decodedReason?: string
      failedOpIndex?: number
      failedOpReason?: string
      innerRevertData?: string
      errorSelector?: string
      rawErrorData?: string
      userOpDetails?: Record<string, unknown>[]
    } = {}

    // Step 1: Extract error data from the caught exception
    const errorData = extractErrorData(error)

    if (errorData) {
      result.rawErrorData = errorData
      result.errorSelector = errorData.length >= 10 ? errorData.slice(0, 10) : undefined

      // Decode FailedOp(uint256 opIndex, string reason)
      if (matchesErrorSelector(errorData, 'FailedOp')) {
        try {
          const { opIndex, reason } = decodeFailedOp(errorData)
          result.failedOpIndex = Number(opIndex)
          result.failedOpReason = reason
          result.decodedReason = `FailedOp[${opIndex}]: ${formatRevertReason(reason)}`
          this.logger.error(
            { opIndex: Number(opIndex), reason, userOpHash: entries[Number(opIndex)]?.userOpHash },
            `handleOps FailedOp at index ${opIndex}: ${reason}`
          )
        } catch (decodeErr) {
          this.logger.warn({ err: decodeErr }, 'Failed to decode FailedOp data')
        }
      }

      // Decode FailedOpWithRevert(uint256 opIndex, string reason, bytes inner)
      else if (matchesErrorSelector(errorData, 'FailedOpWithRevert')) {
        try {
          const { opIndex, reason, inner } = decodeFailedOpWithRevert(errorData)
          result.failedOpIndex = Number(opIndex)
          result.failedOpReason = reason
          result.innerRevertData = inner
          result.decodedReason = `FailedOpWithRevert[${opIndex}]: ${formatRevertReason(reason)} | inner=${inner}`
          this.logger.error(
            {
              opIndex: Number(opIndex),
              reason,
              inner,
              innerLength: inner.length,
              userOpHash: entries[Number(opIndex)]?.userOpHash,
            },
            `handleOps FailedOpWithRevert at index ${opIndex}: ${reason}`
          )
        } catch (decodeErr) {
          this.logger.warn({ err: decodeErr }, 'Failed to decode FailedOpWithRevert data')
        }
      }

      // Decode SignatureValidationFailed
      else if (matchesErrorSelector(errorData, 'SignatureValidationFailed')) {
        result.decodedReason = 'SignatureValidationFailed: on-chain signature check failed'
        this.logger.error('handleOps SignatureValidationFailed: ECDSA signature validation failed on-chain')
      }

      // Unknown selector — log raw data for analysis
      else {
        result.decodedReason = `Unknown revert (selector=${result.errorSelector}): ${errorData.slice(0, 66)}...`
      }
    }

    // Step 2: If no structured data was extracted, try eth_call to get revert reason
    if (!result.decodedReason) {
      try {
        await this.publicClient.call({
          account: this.walletClient.account!,
          to: this.config.entryPoint,
          data: handleOpsData,
        })
        // If eth_call succeeds, the revert was transient (state changed between attempts)
        result.decodedReason = 'Transient failure: eth_call succeeded on retry (state may have changed)'
      } catch (callError) {
        const callErrorData = extractErrorData(callError)
        if (callErrorData) {
          result.rawErrorData = callErrorData

          const parsed = parseSimulationError(callError)
          if (parsed.failedOp) {
            result.failedOpIndex = Number(parsed.failedOp.opIndex)
            result.failedOpReason = parsed.failedOp.reason
            result.innerRevertData = parsed.failedOp.inner
            result.decodedReason = `FailedOp[${parsed.failedOp.opIndex}]: ${formatRevertReason(parsed.failedOp.reason)}${parsed.failedOp.inner ? ` | inner=${parsed.failedOp.inner}` : ''}`
          } else if (parsed.rawError) {
            result.decodedReason = `eth_call revert: ${parsed.rawError}`
          }

          this.logger.error(
            { callErrorData: callErrorData.slice(0, 200), parsed },
            'handleOps eth_call diagnostic result'
          )
        } else {
          result.decodedReason = `eth_call also reverted: ${callError instanceof Error ? callError.message : String(callError)}`
        }
      }
    }

    // Step 3: Log UserOp details for the failed operation(s)
    const failedEntry = result.failedOpIndex !== undefined ? entries[result.failedOpIndex] : undefined
    const opsToLog = failedEntry ? [failedEntry] : entries

    result.userOpDetails = opsToLog.map((e) => ({
      userOpHash: e.userOpHash,
      sender: e.userOp.sender,
      nonce: e.userOp.nonce.toString(),
      hasFactory: !!(e.userOp.factory && e.userOp.factory !== '0x'),
      factory: e.userOp.factory || 'none',
      hasPaymaster: !!(e.userOp.paymaster && e.userOp.paymaster !== '0x'),
      signatureLength: e.userOp.signature?.length ?? 0,
      callDataSelector: e.userOp.callData?.slice(0, 10) ?? 'none',
      verificationGasLimit: e.userOp.verificationGasLimit.toString(),
      callGasLimit: e.userOp.callGasLimit.toString(),
      preVerificationGas: e.userOp.preVerificationGas.toString(),
      maxFeePerGas: e.userOp.maxFeePerGas.toString(),
      maxPriorityFeePerGas: e.userOp.maxPriorityFeePerGas.toString(),
    }))

    for (const detail of result.userOpDetails) {
      this.logger.error(detail, 'Failed UserOp details')
    }

    return result
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
      const userOpEvents = this.parseUserOperationEvents(receipt.logs)

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
   * Parse UserOperationEvent logs from transaction receipt
   */
  private parseUserOperationEvents(
    logs: Array<{
      address: Address
      topics: Hex[]
      data: Hex
    }>
  ): UserOperationEventData[] {
    const events: UserOperationEventData[] = []

    for (const log of logs) {
      // Check if this is a UserOperationEvent
      if (
        log.address.toLowerCase() === this.config.entryPoint.toLowerCase() &&
        log.topics[0]?.toLowerCase() === EVENT_SIGNATURES.UserOperationEvent.toLowerCase()
      ) {
        try {
          // Type cast required for decodeEventLog topics parameter
          const topics = log.topics as [Hex, ...Hex[]]
          const decoded = decodeEventLog({
            abi: ENTRY_POINT_ABI,
            data: log.data,
            topics,
          })

          if (decoded.eventName === 'UserOperationEvent') {
            const args = decoded.args as {
              userOpHash: Hex
              sender: Address
              paymaster: Address
              nonce: bigint
              success: boolean
              actualGasCost: bigint
              actualGasUsed: bigint
            }

            events.push({
              userOpHash: args.userOpHash,
              sender: args.sender,
              paymaster: args.paymaster,
              nonce: args.nonce,
              success: args.success,
              actualGasCost: args.actualGasCost,
              actualGasUsed: args.actualGasUsed,
            })
          }
        } catch (error) {
          this.logger.warn({ error, log }, 'Failed to decode UserOperationEvent')
        }
      }
    }

    return events
  }

  /**
   * EIP-4337 Section 7.3: Detect factory CREATE2 address collisions.
   * Two UserOps that would CREATE2 the same address cannot both succeed.
   * Keeps the first-seen op and excludes later duplicates.
   */
  private detectFactoryCollisions(entries: MempoolEntry[]): MempoolEntry[] {
    if (!this.dependencyTracker || entries.length <= 1) {
      return entries
    }

    const hashes = entries.map((e) => e.userOpHash)
    const collisions = this.dependencyTracker.findFactoryCollisions(hashes)

    if (collisions.length === 0) {
      return entries
    }

    const excluded = new Set(collisions.map((c) => c.excluded))

    for (const collision of collisions) {
      this.logger.warn(
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
  private applyStorageConflictOrdering(entries: MempoolEntry[]): MempoolEntry[] {
    if (!this.dependencyTracker || entries.length <= 1) {
      return entries
    }

    const { ordered, conflicting } = this.dependencyTracker.orderByDependencies(entries)

    if (conflicting.length > 0) {
      this.logger.warn(
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
  private detectStorageWriteConflicts(entries: MempoolEntry[]): MempoolEntry[] {
    if (!this.dependencyTracker || entries.length <= 1) {
      return entries
    }

    const hashes = entries.map((e) => e.userOpHash)
    const conflicts = this.dependencyTracker.findWriteConflicts(hashes)

    if (conflicts.length === 0) {
      return entries
    }

    const excluded = new Set(conflicts.map((c) => c.excluded))

    for (const conflict of conflicts) {
      this.logger.warn(
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
  private extractStorageAccess(
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
   * Pack a UserOperation for EntryPoint v0.7
   */
  private packUserOp(userOp: UserOperation): {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    accountGasLimits: Hex
    preVerificationGas: bigint
    gasFees: Hex
    paymasterAndData: Hex
    signature: Hex
  } {
    // Build initCode
    const initCode =
      userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

    // Build accountGasLimits (verificationGasLimit + callGasLimit)
    const accountGasLimits = concat([
      pad(toHex(userOp.verificationGasLimit), { size: 16 }),
      pad(toHex(userOp.callGasLimit), { size: 16 }),
    ]) as Hex

    // Build gasFees (maxPriorityFeePerGas + maxFeePerGas)
    const gasFees = concat([
      pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
      pad(toHex(userOp.maxFeePerGas), { size: 16 }),
    ]) as Hex

    // Build paymasterAndData
    let paymasterAndData: Hex = '0x'
    if (userOp.paymaster) {
      paymasterAndData = concat([
        userOp.paymaster,
        pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
        pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
        userOp.paymasterData ?? '0x',
      ]) as Hex
    }

    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode,
      callData: userOp.callData,
      accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: userOp.signature,
    }
  }

  /**
   * Separate entries by whether they have an aggregator
   */
  private separateByAggregator(entries: MempoolEntry[]): {
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
      const packedOps = groupEntries.map((e) => this.packUserOp(e.userOp))

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
