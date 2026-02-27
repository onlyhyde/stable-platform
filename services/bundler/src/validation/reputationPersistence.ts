import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Address } from 'viem'
import type { ReputationPersistenceConfig } from '../config/constants'
import type { Logger } from '../utils/logger'
import type { IReputationManager } from './types'
import type { ReputationStatus } from './types'

/**
 * Serialized reputation entry for JSON persistence
 */
interface PersistedEntry {
  address: Address
  opsSeen: number
  opsIncluded: number
  status: ReputationStatus
  lastUpdated: number
}

/**
 * Serialized reputation file format
 */
interface PersistedReputationData {
  version: 1
  persistedAt: number
  entries: PersistedEntry[]
}

/**
 * Persists ReputationManager state to a JSON file.
 * Uses atomic writes (temp file + rename) to prevent data corruption.
 * Applies time-based decay compensation on load.
 */
export class ReputationPersistence {
  private readonly config: ReputationPersistenceConfig
  private readonly logger: Logger
  private saveTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: ReputationPersistenceConfig, logger: Logger) {
    this.config = config
    this.logger = logger.child({ module: 'reputationPersistence' })
  }

  /**
   * Save current reputation state to file.
   * Uses atomic write: write to temp file then rename.
   */
  save(reputationManager: IReputationManager): void {
    if (!this.config.enabled) return

    const filePath = resolve(this.config.filePath)
    const tmpPath = `${filePath}.tmp`

    const entries = reputationManager.dump()
    const data: PersistedReputationData = {
      version: 1,
      persistedAt: Date.now(),
      entries: entries.map((e) => ({
        address: e.address,
        opsSeen: e.opsSeen,
        opsIncluded: e.opsIncluded,
        status: e.status,
        lastUpdated: e.lastUpdated,
      })),
    }

    try {
      // Ensure directory exists
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      // Atomic write: temp file → rename
      writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
      renameSync(tmpPath, filePath)

      this.logger.debug(
        { entryCount: entries.length, path: filePath },
        'Saved reputation data'
      )
    } catch (error) {
      this.logger.error({ error, path: filePath }, 'Failed to save reputation data')
    }
  }

  /**
   * Load reputation state from file and apply to manager.
   * Applies decay compensation for time elapsed since last save.
   */
  load(reputationManager: IReputationManager): void {
    if (!this.config.enabled) return

    const filePath = resolve(this.config.filePath)

    if (!existsSync(filePath)) {
      this.logger.info({ path: filePath }, 'No reputation persistence file found, starting fresh')
      return
    }

    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as PersistedReputationData

      if (data.version !== 1) {
        this.logger.warn(
          { version: data.version },
          'Unknown reputation persistence version, skipping load'
        )
        return
      }

      const now = Date.now()
      const { decayIntervalMs, decayAmount } = reputationManager.getConfig()

      for (const entry of data.entries) {
        // Apply decay compensation: estimate missed decay intervals
        let adjustedOpsSeen = entry.opsSeen
        if (decayIntervalMs > 0 && decayAmount > 0) {
          const elapsed = now - entry.lastUpdated
          const missedIntervals = Math.floor(elapsed / decayIntervalMs)
          const totalDecay = missedIntervals * decayAmount
          adjustedOpsSeen = Math.max(0, entry.opsSeen - totalDecay)
        }

        reputationManager.setReputation(
          entry.address,
          adjustedOpsSeen,
          entry.opsIncluded,
          entry.status
        )
      }

      this.logger.info(
        { entryCount: data.entries.length, persistedAt: data.persistedAt },
        'Loaded reputation data from file'
      )
    } catch (error) {
      this.logger.warn(
        { error, path: filePath },
        'Failed to load reputation persistence file, starting fresh'
      )
    }
  }

  /**
   * Start periodic save timer
   */
  startPeriodicSave(reputationManager: IReputationManager): void {
    if (!this.config.enabled) return
    if (this.saveTimer) return

    this.saveTimer = setInterval(() => {
      this.save(reputationManager)
    }, this.config.saveIntervalMs)

    this.logger.info(
      { intervalMs: this.config.saveIntervalMs },
      'Started periodic reputation persistence'
    )
  }

  /**
   * Stop periodic save timer and perform final flush
   */
  stop(reputationManager: IReputationManager): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }

    // Final flush
    this.save(reputationManager)
    this.logger.info('Stopped reputation persistence (final save completed)')
  }
}
