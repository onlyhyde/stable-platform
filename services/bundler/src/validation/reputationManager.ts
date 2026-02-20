import type { Address } from 'viem'
import type { Logger } from '../utils/logger'
import type {
  EntityType,
  IReputationManager,
  ReputationCheckResult,
  ReputationConfig,
  ReputationEntry,
  ReputationStatus,
  StakeInfo,
} from './types'
import { DEFAULT_REPUTATION_CONFIG } from './types'

/**
 * In-memory reputation manager for tracking entity behavior
 * Implements ban/throttle system per ERC-4337 specification
 */
export class ReputationManager implements IReputationManager {
  private entries: Map<Address, ReputationEntry> = new Map()
  private config: ReputationConfig
  private logger: Logger
  private autoDecayTimer: ReturnType<typeof setInterval> | null = null

  constructor(logger: Logger, config?: Partial<ReputationConfig>) {
    this.logger = logger.child({ module: 'reputation' })
    this.config = { ...DEFAULT_REPUTATION_CONFIG, ...config }
  }

  /**
   * Check reputation status of an address
   */
  checkReputation(address: Address): ReputationStatus {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.entries.get(normalizedAddress)
    if (!entry) return 'ok'

    // Apply decay before checking (if enabled)
    this.applyDecayToEntry(entry)

    // If explicitly banned, return banned (no auto-release for bans)
    if (entry.status === 'banned') return 'banned'

    // Check throttle auto-release
    if (entry.status === 'throttled') {
      if (this.shouldAutoReleaseThrottle(entry)) {
        entry.status = 'ok'
        this.logger.info(
          { address: normalizedAddress },
          'Address auto-released from throttle after duration expired'
        )
      } else {
        return 'throttled'
      }
    }

    // Calculate dynamic status based on ops ratio
    return this.calculateStatus(entry)
  }

  /**
   * Check if throttle should be auto-released based on time
   */
  private shouldAutoReleaseThrottle(entry: ReputationEntry): boolean {
    const { throttleAutoReleaseDurationMs } = this.config
    if (throttleAutoReleaseDurationMs <= 0) return false

    const now = Date.now()
    const elapsed = now - entry.lastUpdated
    return elapsed >= throttleAutoReleaseDurationMs
  }

  /**
   * Apply decay to a single entry based on time elapsed since lastUpdated
   */
  private applyDecayToEntry(entry: ReputationEntry): void {
    const { decayIntervalMs, decayAmount } = this.config
    if (decayIntervalMs <= 0 || decayAmount <= 0) return

    const now = Date.now()
    const elapsed = now - entry.lastUpdated
    const intervals = Math.floor(elapsed / decayIntervalMs)

    if (intervals > 0) {
      const totalDecay = intervals * decayAmount
      entry.opsSeen = Math.max(0, entry.opsSeen - totalDecay)
      // Update lastUpdated to account for applied decay intervals
      entry.lastUpdated = entry.lastUpdated + intervals * decayIntervalMs

      this.logger.debug(
        { address: entry.address, decay: totalDecay, newOpsSeen: entry.opsSeen },
        'Applied opsSeen decay'
      )
    }
  }

  /**
   * Apply decay to all entries
   */
  applyDecay(): void {
    const { decayIntervalMs, decayAmount } = this.config
    if (decayIntervalMs <= 0 || decayAmount <= 0) return

    for (const entry of this.entries.values()) {
      this.applyDecayToEntry(entry)
    }
  }

  /**
   * Check reputation with stake info
   * Staked entities have more lenient treatment
   */
  checkReputationWithStake(
    address: Address,
    stakeInfo: StakeInfo,
    entityType: EntityType
  ): ReputationCheckResult {
    const status = this.checkReputation(address)
    const isStaked = this.isStaked(stakeInfo)

    // Staked entities can bypass throttling
    if (status === 'throttled' && isStaked) {
      return {
        status: 'ok',
        isStaked,
        reason: `${entityType} is staked, bypassing throttle`,
      }
    }

    // Banned entities cannot bypass even if staked
    if (status === 'banned') {
      return {
        status: 'banned',
        isStaked,
        reason: `${entityType} is banned`,
      }
    }

    return { status, isStaked }
  }

  /**
   * Check if entity meets minimum stake requirements
   */
  isStaked(stakeInfo: StakeInfo): boolean {
    return (
      stakeInfo.stake >= this.config.minStake &&
      stakeInfo.unstakeDelaySec >= BigInt(this.config.minUnstakeDelay)
    )
  }

  /**
   * Update seen counter for an address
   * Called when UserOperation is received
   */
  updateSeen(address: Address): void {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.getOrCreate(normalizedAddress)
    entry.opsSeen++
    entry.lastUpdated = Date.now()

    this.logger.debug({ address: normalizedAddress, opsSeen: entry.opsSeen }, 'Updated opsSeen')
  }

  /**
   * Update included counter for an address
   * Called when UserOperation is successfully included in a bundle
   */
  updateIncluded(address: Address): void {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.getOrCreate(normalizedAddress)
    entry.opsIncluded++
    entry.lastUpdated = Date.now()

    // Check if status should be improved
    const newStatus = this.calculateStatus(entry)
    if (entry.status === 'throttled' && newStatus === 'ok') {
      entry.status = 'ok'
      this.logger.info(
        { address: normalizedAddress },
        'Address un-throttled due to improved behavior'
      )
    }

    this.logger.debug(
      { address: normalizedAddress, opsIncluded: entry.opsIncluded },
      'Updated opsIncluded'
    )
  }

  /**
   * Manually ban an address
   */
  ban(address: Address, reason: string): void {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.getOrCreate(normalizedAddress)
    entry.status = 'banned'
    entry.lastUpdated = Date.now()

    this.logger.warn({ address: normalizedAddress, reason }, 'Address banned')
  }

  /**
   * Manually throttle an address
   */
  throttle(address: Address, reason: string): void {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.getOrCreate(normalizedAddress)
    entry.status = 'throttled'
    entry.lastUpdated = Date.now()

    this.logger.warn({ address: normalizedAddress, reason }, 'Address throttled')
  }

  /**
   * Clear reputation for an address
   */
  clearReputation(address: Address): void {
    const normalizedAddress = address.toLowerCase() as Address
    this.entries.delete(normalizedAddress)

    this.logger.debug({ address: normalizedAddress }, 'Cleared reputation')
  }

  /**
   * Clear all reputation data
   */
  clearAll(): void {
    this.entries.clear()
    this.logger.info('Cleared all reputation data')
  }

  /**
   * Get reputation entry for an address
   */
  getEntry(address: Address): ReputationEntry | undefined {
    return this.entries.get(address.toLowerCase() as Address)
  }

  /**
   * Get all reputation entries
   */
  getAllEntries(): ReputationEntry[] {
    return Array.from(this.entries.values())
  }

  /**
   * Get all banned addresses
   */
  getBannedAddresses(): Address[] {
    return this.getAllEntries()
      .filter((e) => e.status === 'banned')
      .map((e) => e.address)
  }

  /**
   * Get all throttled addresses
   */
  getThrottledAddresses(): Address[] {
    return this.getAllEntries()
      .filter((e) => e.status === 'throttled')
      .map((e) => e.address)
  }

  /**
   * Set stake information for whitelist/greylist/blacklist management
   * This can be used to preload reputation data
   */
  setReputation(
    address: Address,
    opsSeen: number,
    opsIncluded: number,
    status?: ReputationStatus
  ): void {
    const normalizedAddress = address.toLowerCase() as Address
    const entry = this.getOrCreate(normalizedAddress)
    entry.opsSeen = opsSeen
    entry.opsIncluded = opsIncluded
    if (status) {
      entry.status = status
    }
    entry.lastUpdated = Date.now()
  }

  /**
   * Dump reputation data for debugging
   */
  dump(): ReputationEntry[] {
    return this.getAllEntries()
  }

  /**
   * Calculate status based on ops ratio
   */
  private calculateStatus(entry: ReputationEntry): ReputationStatus {
    const { opsSeen, opsIncluded } = entry
    const { minInclusionDenominator, throttlingSlack, banSlack } = this.config

    // Calculate max allowed opsSeen before throttling
    const maxSeen = opsIncluded * minInclusionDenominator + throttlingSlack

    // Check for ban threshold
    if (opsSeen > maxSeen + banSlack) {
      return 'banned'
    }

    // Check for throttle threshold
    if (opsSeen > maxSeen) {
      return 'throttled'
    }

    return 'ok'
  }

  /**
   * Get or create reputation entry for an address
   */
  private getOrCreate(address: Address): ReputationEntry {
    let entry = this.entries.get(address)
    if (!entry) {
      entry = {
        address,
        opsSeen: 0,
        opsIncluded: 0,
        status: 'ok',
        lastUpdated: Date.now(),
      }
      this.entries.set(address, entry)
    }
    return entry
  }

  /**
   * Get current configuration
   */
  getConfig(): ReputationConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReputationConfig>): void {
    this.config = { ...this.config, ...config }
    this.logger.info({ config: this.config }, 'Updated reputation config')
  }

  /**
   * Get stats about reputation system
   */
  getStats(): {
    total: number
    ok: number
    throttled: number
    banned: number
  } {
    let ok = 0
    let throttled = 0
    let banned = 0

    for (const entry of this.entries.values()) {
      const status = entry.status === 'ok' ? this.calculateStatus(entry) : entry.status
      switch (status) {
        case 'ok':
          ok++
          break
        case 'throttled':
          throttled++
          break
        case 'banned':
          banned++
          break
      }
    }

    return {
      total: this.entries.size,
      ok,
      throttled,
      banned,
    }
  }

  /**
   * Start automatic decay timer
   * Decay will be applied at each interval automatically
   */
  startAutoDecay(): void {
    const { decayIntervalMs } = this.config
    if (decayIntervalMs <= 0) {
      this.logger.warn('Cannot start auto decay: decayIntervalMs is not configured')
      return
    }

    if (this.autoDecayTimer) {
      this.logger.warn('Auto decay timer already running')
      return
    }

    this.autoDecayTimer = setInterval(() => {
      this.applyDecay()
    }, decayIntervalMs)

    this.logger.info({ intervalMs: decayIntervalMs }, 'Started auto decay timer')
  }

  /**
   * Stop automatic decay timer
   */
  stopAutoDecay(): void {
    if (this.autoDecayTimer) {
      clearInterval(this.autoDecayTimer)
      this.autoDecayTimer = null
      this.logger.info('Stopped auto decay timer')
    }
  }
}
