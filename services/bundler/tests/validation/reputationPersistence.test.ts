import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Address } from 'viem'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReputationPersistenceConfig } from '../../src/config/constants'
import { ReputationManager } from '../../src/validation/reputationManager'
import { ReputationPersistence } from '../../src/validation/reputationPersistence'
import { createLogger } from '../../src/utils/logger'

const mockLogger = createLogger('error', false)

const TEST_ADDR_1 = '0xaaaa111111111111111111111111111111111111' as Address
const TEST_ADDR_2 = '0xbbbb222222222222222222222222222222222222' as Address
const TEST_ADDR_3 = '0xcccc333333333333333333333333333333333333' as Address

describe('ReputationPersistence', () => {
  let testDir: string
  let filePath: string
  let config: ReputationPersistenceConfig

  beforeEach(() => {
    testDir = join(tmpdir(), `bundler-rep-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    filePath = join(testDir, 'reputation.json')
    config = {
      enabled: true,
      filePath,
      saveIntervalMs: 60_000,
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('save/load round-trip', () => {
    it('should save and load reputation entries', () => {
      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 10, 8, 'ok')
      manager.setReputation(TEST_ADDR_2, 100, 5, 'throttled')
      manager.setReputation(TEST_ADDR_3, 200, 2, 'banned')

      const persistence = new ReputationPersistence(config, mockLogger)

      // Save
      persistence.save(manager)

      // Verify file exists
      expect(existsSync(filePath)).toBe(true)

      // Load into a fresh manager
      const freshManager = new ReputationManager(mockLogger)
      persistence.load(freshManager)

      const entries = freshManager.dump()
      expect(entries).toHaveLength(3)

      const addr1Entry = entries.find((e) => e.address === TEST_ADDR_1.toLowerCase())
      expect(addr1Entry?.opsSeen).toBe(10)
      expect(addr1Entry?.opsIncluded).toBe(8)

      const addr2Entry = entries.find((e) => e.address === TEST_ADDR_2.toLowerCase())
      expect(addr2Entry?.opsSeen).toBe(100)
      expect(addr2Entry?.opsIncluded).toBe(5)
      expect(addr2Entry?.status).toBe('throttled')

      const addr3Entry = entries.find((e) => e.address === TEST_ADDR_3.toLowerCase())
      expect(addr3Entry?.opsSeen).toBe(200)
      expect(addr3Entry?.opsIncluded).toBe(2)
      expect(addr3Entry?.status).toBe('banned')
    })

    it('should create directory if it does not exist', () => {
      const nestedPath = join(testDir, 'nested', 'deep', 'reputation.json')
      const nestedConfig = { ...config, filePath: nestedPath }

      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 5, 3, 'ok')

      const persistence = new ReputationPersistence(nestedConfig, mockLogger)
      persistence.save(manager)

      expect(existsSync(nestedPath)).toBe(true)
    })

    it('should handle empty reputation data', () => {
      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(config, mockLogger)

      persistence.save(manager)

      const freshManager = new ReputationManager(mockLogger)
      persistence.load(freshManager)

      expect(freshManager.dump()).toHaveLength(0)
    })
  })

  describe('atomic write', () => {
    it('should not leave temp file after successful save', () => {
      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 10, 8, 'ok')

      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.save(manager)

      // Temp file should not exist
      expect(existsSync(`${filePath}.tmp`)).toBe(false)
      // Real file should exist
      expect(existsSync(filePath)).toBe(true)
    })

    it('should write valid JSON', () => {
      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 42, 40, 'ok')

      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.save(manager)

      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw)

      expect(data.version).toBe(1)
      expect(data.persistedAt).toBeGreaterThan(0)
      expect(data.entries).toHaveLength(1)
      expect(data.entries[0].opsSeen).toBe(42)
      expect(data.entries[0].opsIncluded).toBe(40)
    })
  })

  describe('decay compensation on load', () => {
    it('should apply decay compensation for elapsed time', () => {
      // Save data with old lastUpdated timestamp
      mkdirSync(testDir, { recursive: true })
      const oneHourAgo = Date.now() - 3_600_000
      const data = {
        version: 1,
        persistedAt: oneHourAgo,
        entries: [
          {
            address: TEST_ADDR_1,
            opsSeen: 100,
            opsIncluded: 50,
            status: 'ok' as const,
            lastUpdated: oneHourAgo,
          },
        ],
      }
      writeFileSync(filePath, JSON.stringify(data), 'utf-8')

      // Load into manager with decay configured (1 decay per 10 minutes)
      const decayManager = new ReputationManager(mockLogger, {
        decayIntervalMs: 600_000, // 10 min
        decayAmount: 5,
      })

      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.load(decayManager)

      const entry = decayManager.getEntry(TEST_ADDR_1)
      // 1 hour / 10 min = 6 intervals, 6 * 5 = 30 decay
      // 100 - 30 = 70
      expect(entry?.opsSeen).toBe(70)
      expect(entry?.opsIncluded).toBe(50)
    })

    it('should not apply decay when decay is disabled', () => {
      mkdirSync(testDir, { recursive: true })
      const oneHourAgo = Date.now() - 3_600_000
      const data = {
        version: 1,
        persistedAt: oneHourAgo,
        entries: [
          {
            address: TEST_ADDR_1,
            opsSeen: 100,
            opsIncluded: 50,
            status: 'ok' as const,
            lastUpdated: oneHourAgo,
          },
        ],
      }
      writeFileSync(filePath, JSON.stringify(data), 'utf-8')

      // Default manager has decay disabled (decayIntervalMs=0)
      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.load(manager)

      const entry = manager.getEntry(TEST_ADDR_1)
      expect(entry?.opsSeen).toBe(100) // No decay applied
    })

    it('should clamp opsSeen to 0 on heavy decay', () => {
      mkdirSync(testDir, { recursive: true })
      const tenHoursAgo = Date.now() - 36_000_000
      const data = {
        version: 1,
        persistedAt: tenHoursAgo,
        entries: [
          {
            address: TEST_ADDR_1,
            opsSeen: 10,
            opsIncluded: 5,
            status: 'ok' as const,
            lastUpdated: tenHoursAgo,
          },
        ],
      }
      writeFileSync(filePath, JSON.stringify(data), 'utf-8')

      const decayManager = new ReputationManager(mockLogger, {
        decayIntervalMs: 600_000,
        decayAmount: 5,
      })

      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.load(decayManager)

      const entry = decayManager.getEntry(TEST_ADDR_1)
      // 10 hours / 10 min = 60 intervals, 60 * 5 = 300 decay
      // max(0, 10 - 300) = 0
      expect(entry?.opsSeen).toBe(0)
    })
  })

  describe('graceful fallback on invalid data', () => {
    it('should handle invalid JSON', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(filePath, 'not valid json{{{', 'utf-8')

      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(config, mockLogger)

      // Should not throw
      persistence.load(manager)

      // Manager should be empty (fresh start)
      expect(manager.dump()).toHaveLength(0)
    })

    it('should handle unknown version', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(filePath, JSON.stringify({ version: 99, entries: [] }), 'utf-8')

      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(config, mockLogger)

      persistence.load(manager)
      expect(manager.dump()).toHaveLength(0)
    })

    it('should handle missing file gracefully', () => {
      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(config, mockLogger)

      // Should not throw
      persistence.load(manager)
      expect(manager.dump()).toHaveLength(0)
    })
  })

  describe('disabled mode', () => {
    it('should not save when disabled', () => {
      const disabledConfig = { ...config, enabled: false }
      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 10, 8, 'ok')

      const persistence = new ReputationPersistence(disabledConfig, mockLogger)
      persistence.save(manager)

      expect(existsSync(filePath)).toBe(false)
    })

    it('should not load when disabled', () => {
      // Create a file manually
      mkdirSync(testDir, { recursive: true })
      writeFileSync(
        filePath,
        JSON.stringify({
          version: 1,
          persistedAt: Date.now(),
          entries: [{ address: TEST_ADDR_1, opsSeen: 10, opsIncluded: 8, status: 'ok', lastUpdated: Date.now() }],
        }),
        'utf-8'
      )

      const disabledConfig = { ...config, enabled: false }
      const manager = new ReputationManager(mockLogger)
      const persistence = new ReputationPersistence(disabledConfig, mockLogger)
      persistence.load(manager)

      // Should NOT have loaded
      expect(manager.dump()).toHaveLength(0)
    })
  })

  describe('periodic save and stop', () => {
    it('should perform final flush on stop', () => {
      const manager = new ReputationManager(mockLogger)
      manager.setReputation(TEST_ADDR_1, 10, 8, 'ok')

      const persistence = new ReputationPersistence(config, mockLogger)
      persistence.stop(manager)

      // File should be written by final flush
      expect(existsSync(filePath)).toBe(true)

      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw)
      expect(data.entries).toHaveLength(1)
    })
  })
})
