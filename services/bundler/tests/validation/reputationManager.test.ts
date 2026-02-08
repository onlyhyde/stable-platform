import type { Address } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../../src/utils/logger'
import { ReputationManager } from '../../src/validation/reputationManager'

describe('ReputationManager', () => {
  const logger = createLogger('error', false)
  let manager: ReputationManager

  const testAddress = '0x1234567890123456789012345678901234567890' as Address
  const testAddress2 = '0x0987654321098765432109876543210987654321' as Address

  beforeEach(() => {
    manager = new ReputationManager(logger)
  })

  describe('checkReputation', () => {
    it('should return ok for unknown address', () => {
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('ok')
    })

    it('should return ok for address with good history', () => {
      manager.updateSeen(testAddress)
      manager.updateIncluded(testAddress)
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('ok')
    })

    it('should return throttled for address exceeding threshold', () => {
      // Default config: minInclusionDenominator=10, throttlingSlack=10
      // With 0 included, max seen before throttle = 0 * 10 + 10 = 10
      for (let i = 0; i < 11; i++) {
        manager.updateSeen(testAddress)
      }
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('throttled')
    })

    it('should return banned for address far exceeding threshold', () => {
      // Default config: banSlack=50
      // With 0 included, max seen before ban = 0 * 10 + 10 + 50 = 60
      for (let i = 0; i < 61; i++) {
        manager.updateSeen(testAddress)
      }
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('banned')
    })
  })

  describe('updateSeen', () => {
    it('should increment opsSeen counter', () => {
      manager.updateSeen(testAddress)
      manager.updateSeen(testAddress)
      const entry = manager.getEntry(testAddress)
      expect(entry?.opsSeen).toBe(2)
    })

    it('should create entry if not exists', () => {
      manager.updateSeen(testAddress)
      const entry = manager.getEntry(testAddress)
      expect(entry).toBeDefined()
      expect(entry?.opsSeen).toBe(1)
      expect(entry?.opsIncluded).toBe(0)
    })
  })

  describe('updateIncluded', () => {
    it('should increment opsIncluded counter', () => {
      manager.updateIncluded(testAddress)
      manager.updateIncluded(testAddress)
      const entry = manager.getEntry(testAddress)
      expect(entry?.opsIncluded).toBe(2)
    })

    it('should un-throttle address with improved behavior', () => {
      // First throttle the address
      for (let i = 0; i < 15; i++) {
        manager.updateSeen(testAddress)
      }
      expect(manager.checkReputation(testAddress)).toBe('throttled')

      // Then include many operations to improve ratio
      for (let i = 0; i < 10; i++) {
        manager.updateIncluded(testAddress)
      }
      // Now max seen = 10 * 10 + 10 = 110, we only have 15 seen
      expect(manager.checkReputation(testAddress)).toBe('ok')
    })
  })

  describe('ban', () => {
    it('should set status to banned', () => {
      manager.ban(testAddress, 'test reason')
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('banned')
    })

    it('should override dynamic calculation', () => {
      // Even with good history, manual ban takes precedence
      manager.updateIncluded(testAddress)
      manager.ban(testAddress, 'manual ban')
      expect(manager.checkReputation(testAddress)).toBe('banned')
    })
  })

  describe('throttle', () => {
    it('should set status to throttled', () => {
      manager.throttle(testAddress, 'test reason')
      const status = manager.checkReputation(testAddress)
      expect(status).toBe('throttled')
    })
  })

  describe('clearReputation', () => {
    it('should remove reputation entry', () => {
      manager.updateSeen(testAddress)
      manager.clearReputation(testAddress)
      const entry = manager.getEntry(testAddress)
      expect(entry).toBeUndefined()
    })
  })

  describe('clearAll', () => {
    it('should remove all reputation entries', () => {
      manager.updateSeen(testAddress)
      manager.updateSeen(testAddress2)
      manager.clearAll()
      expect(manager.getAllEntries()).toHaveLength(0)
    })
  })

  describe('setReputation', () => {
    it('should set reputation values', () => {
      manager.setReputation(testAddress, 5, 3)
      const entry = manager.getEntry(testAddress)
      expect(entry?.opsSeen).toBe(5)
      expect(entry?.opsIncluded).toBe(3)
    })

    it('should set explicit status', () => {
      manager.setReputation(testAddress, 0, 0, 'banned')
      expect(manager.checkReputation(testAddress)).toBe('banned')
    })
  })

  describe('checkReputationWithStake', () => {
    it('should bypass throttling for staked entity', () => {
      // Throttle the address
      for (let i = 0; i < 15; i++) {
        manager.updateSeen(testAddress)
      }
      expect(manager.checkReputation(testAddress)).toBe('throttled')

      // Check with sufficient stake
      const stakeInfo = {
        stake: 200000000000000000n, // 0.2 ETH
        unstakeDelaySec: 86400n, // 1 day
      }
      const result = manager.checkReputationWithStake(testAddress, stakeInfo, 'paymaster')
      expect(result.status).toBe('ok')
      expect(result.isStaked).toBe(true)
    })

    it('should not bypass ban even for staked entity', () => {
      manager.ban(testAddress, 'bad actor')

      const stakeInfo = {
        stake: 200000000000000000n, // 0.2 ETH
        unstakeDelaySec: 86400n,
      }
      const result = manager.checkReputationWithStake(testAddress, stakeInfo, 'paymaster')
      expect(result.status).toBe('banned')
      expect(result.isStaked).toBe(true)
    })

    it('should not consider entity staked with insufficient stake', () => {
      // Throttle the address
      for (let i = 0; i < 15; i++) {
        manager.updateSeen(testAddress)
      }

      const stakeInfo = {
        stake: 50000000000000000n, // 0.05 ETH (below 0.1 ETH minimum)
        unstakeDelaySec: 86400n,
      }
      const result = manager.checkReputationWithStake(testAddress, stakeInfo, 'paymaster')
      expect(result.status).toBe('throttled')
      expect(result.isStaked).toBe(false)
    })

    it('should not consider entity staked with short unstake delay', () => {
      // Throttle the address
      for (let i = 0; i < 15; i++) {
        manager.updateSeen(testAddress)
      }

      const stakeInfo = {
        stake: 200000000000000000n, // 0.2 ETH
        unstakeDelaySec: 3600n, // 1 hour (below 1 day minimum)
      }
      const result = manager.checkReputationWithStake(testAddress, stakeInfo, 'paymaster')
      expect(result.status).toBe('throttled')
      expect(result.isStaked).toBe(false)
    })
  })

  describe('isStaked', () => {
    it('should return true for entity meeting stake requirements', () => {
      const stakeInfo = {
        stake: 200000000000000000n, // 0.2 ETH
        unstakeDelaySec: 86400n, // 1 day
      }
      expect(manager.isStaked(stakeInfo)).toBe(true)
    })

    it('should return false for insufficient stake', () => {
      const stakeInfo = {
        stake: 50000000000000000n, // 0.05 ETH
        unstakeDelaySec: 86400n,
      }
      expect(manager.isStaked(stakeInfo)).toBe(false)
    })
  })

  describe('getBannedAddresses', () => {
    it('should return all banned addresses', () => {
      manager.ban(testAddress, 'reason 1')
      manager.ban(testAddress2, 'reason 2')
      manager.updateSeen('0xabcdef1234567890abcdef1234567890abcdef12' as Address)

      const banned = manager.getBannedAddresses()
      expect(banned).toHaveLength(2)
      expect(banned).toContain(testAddress.toLowerCase())
      expect(banned).toContain(testAddress2.toLowerCase())
    })
  })

  describe('getThrottledAddresses', () => {
    it('should return all throttled addresses', () => {
      manager.throttle(testAddress, 'reason 1')
      manager.throttle(testAddress2, 'reason 2')

      const throttled = manager.getThrottledAddresses()
      expect(throttled).toHaveLength(2)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.updateSeen(testAddress)
      manager.ban(testAddress2, 'bad')
      manager.throttle('0xabcdef1234567890abcdef1234567890abcdef12' as Address, 'test')

      const stats = manager.getStats()
      expect(stats.total).toBe(3)
      expect(stats.ok).toBe(1)
      expect(stats.banned).toBe(1)
      expect(stats.throttled).toBe(1)
    })
  })

  describe('address normalization', () => {
    it('should normalize addresses to lowercase', () => {
      const upperCase = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' as Address
      const lowerCase = '0xabcdef1234567890abcdef1234567890abcdef12' as Address

      manager.updateSeen(upperCase)
      manager.updateIncluded(lowerCase)

      const entry = manager.getEntry(upperCase)
      expect(entry?.opsSeen).toBe(1)
      expect(entry?.opsIncluded).toBe(1)
    })
  })

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customManager = new ReputationManager(logger, {
        minInclusionDenominator: 5,
        throttlingSlack: 5,
        banSlack: 10,
      })

      // With custom config: max seen before throttle = 0 * 5 + 5 = 5
      for (let i = 0; i < 6; i++) {
        customManager.updateSeen(testAddress)
      }
      expect(customManager.checkReputation(testAddress)).toBe('throttled')
    })

    it('should allow updating configuration', () => {
      manager.updateConfig({ throttlingSlack: 5 })
      const config = manager.getConfig()
      expect(config.throttlingSlack).toBe(5)
    })
  })

  // ============================================================================
  // Task 2.4: Reputation 시간 감쇠 (Time Decay)
  // ============================================================================

  describe('time decay', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    // Task 2.4.1: 시간 기반 opsSeen 감쇠
    describe('opsSeen decay', () => {
      it('should decay opsSeen over time', () => {
        // Configure decay: 1 opsSeen per hour
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000, // 1 hour
          decayAmount: 1,
        })

        // Set initial opsSeen
        for (let i = 0; i < 10; i++) {
          decayManager.updateSeen(testAddress)
        }
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(10)

        // Advance time by 3 hours
        vi.advanceTimersByTime(3 * 3600000)

        // Apply decay (called on checkReputation or explicitly)
        decayManager.applyDecay()

        // opsSeen should be reduced by 3 (1 per hour)
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(7)
      })

      it('should not decay opsSeen below zero', () => {
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000,
          decayAmount: 5,
        })

        decayManager.updateSeen(testAddress)
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(1)

        // Advance time by 2 hours (would decay by 10)
        vi.advanceTimersByTime(2 * 3600000)
        decayManager.applyDecay()

        // Should be 0, not negative
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(0)
      })

      it('should apply decay when checking reputation', () => {
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000,
          decayAmount: 2,
          throttlingSlack: 5,
        })

        // Set 8 opsSeen (would be throttled: > 5)
        for (let i = 0; i < 8; i++) {
          decayManager.updateSeen(testAddress)
        }
        expect(decayManager.checkReputation(testAddress)).toBe('throttled')

        // Advance time by 2 hours (decay by 4)
        vi.advanceTimersByTime(2 * 3600000)

        // After decay: 8 - 4 = 4, which is <= 5 (throttlingSlack)
        expect(decayManager.checkReputation(testAddress)).toBe('ok')
      })

      it('should decay each address independently based on lastUpdated', () => {
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000,
          decayAmount: 1,
        })

        // Set testAddress at time 0
        decayManager.updateSeen(testAddress)
        decayManager.updateSeen(testAddress)
        decayManager.updateSeen(testAddress)

        // Advance 1 hour
        vi.advanceTimersByTime(3600000)

        // Set testAddress2 at time +1h
        decayManager.updateSeen(testAddress2)
        decayManager.updateSeen(testAddress2)

        // Advance another 2 hours (total 3h for testAddress, 2h for testAddress2)
        vi.advanceTimersByTime(2 * 3600000)
        decayManager.applyDecay()

        // testAddress: 3 - 3 = 0
        // testAddress2: 2 - 2 = 0
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(0)
        expect(decayManager.getEntry(testAddress2)?.opsSeen).toBe(0)
      })
    })

    // Task 2.4.2: Throttle 자동 해제 조건
    describe('throttle auto-release', () => {
      it('should auto-release throttle after configured duration', () => {
        const decayManager = new ReputationManager(logger, {
          throttleAutoReleaseDurationMs: 24 * 3600000, // 24 hours
        })

        // Manually throttle the address
        decayManager.throttle(testAddress, 'test throttle')
        expect(decayManager.checkReputation(testAddress)).toBe('throttled')

        // Advance time by 24 hours
        vi.advanceTimersByTime(24 * 3600000)

        // Should be auto-released
        expect(decayManager.checkReputation(testAddress)).toBe('ok')
      })

      it('should not auto-release throttle before duration', () => {
        const decayManager = new ReputationManager(logger, {
          throttleAutoReleaseDurationMs: 24 * 3600000,
        })

        decayManager.throttle(testAddress, 'test throttle')
        expect(decayManager.checkReputation(testAddress)).toBe('throttled')

        // Advance time by only 12 hours
        vi.advanceTimersByTime(12 * 3600000)

        // Should still be throttled (less than 24 hours)
        expect(decayManager.checkReputation(testAddress)).toBe('throttled')
      })

      it('should reset throttle timer on new violation', () => {
        const decayManager = new ReputationManager(logger, {
          throttleAutoReleaseDurationMs: 24 * 3600000,
        })

        decayManager.throttle(testAddress, 'first throttle')

        // Advance 20 hours
        vi.advanceTimersByTime(20 * 3600000)

        // New violation resets timer
        decayManager.throttle(testAddress, 'new violation')

        // Advance another 20 hours (total 40h since first, 20h since new)
        vi.advanceTimersByTime(20 * 3600000)

        // Should still be throttled (only 20h since new throttle)
        expect(decayManager.checkReputation(testAddress)).toBe('throttled')

        // Advance another 5 hours (total 25h since new throttle)
        vi.advanceTimersByTime(5 * 3600000)

        // Now should be released
        expect(decayManager.checkReputation(testAddress)).toBe('ok')
      })

      it('should NOT auto-release banned addresses', () => {
        const decayManager = new ReputationManager(logger, {
          throttleAutoReleaseDurationMs: 24 * 3600000,
        })

        // Ban the address
        decayManager.ban(testAddress, 'bad actor')
        expect(decayManager.checkReputation(testAddress)).toBe('banned')

        // Advance time by 48 hours
        vi.advanceTimersByTime(48 * 3600000)

        // Should still be banned
        expect(decayManager.checkReputation(testAddress)).toBe('banned')
      })
    })

    // Task 2.4.3: 감쇠 주기 설정
    describe('decay interval configuration', () => {
      it('should use default decay settings when not configured', () => {
        const defaultManager = new ReputationManager(logger)
        const config = defaultManager.getConfig()

        // Default should be decay disabled (0 or undefined)
        expect(config.decayIntervalMs).toBe(0)
        expect(config.decayAmount).toBe(0)
        expect(config.throttleAutoReleaseDurationMs).toBe(0)
      })

      it('should allow configuring decay interval', () => {
        const customManager = new ReputationManager(logger, {
          decayIntervalMs: 1800000, // 30 minutes
        })
        expect(customManager.getConfig().decayIntervalMs).toBe(1800000)
      })

      it('should allow configuring decay amount', () => {
        const customManager = new ReputationManager(logger, {
          decayAmount: 2,
        })
        expect(customManager.getConfig().decayAmount).toBe(2)
      })

      it('should allow configuring throttle auto-release duration', () => {
        const customManager = new ReputationManager(logger, {
          throttleAutoReleaseDurationMs: 12 * 3600000, // 12 hours
        })
        expect(customManager.getConfig().throttleAutoReleaseDurationMs).toBe(12 * 3600000)
      })

      it('should allow updating decay config at runtime', () => {
        manager.updateConfig({
          decayIntervalMs: 3600000,
          decayAmount: 1,
          throttleAutoReleaseDurationMs: 24 * 3600000,
        })

        const config = manager.getConfig()
        expect(config.decayIntervalMs).toBe(3600000)
        expect(config.decayAmount).toBe(1)
        expect(config.throttleAutoReleaseDurationMs).toBe(24 * 3600000)
      })

      it('should start auto decay timer when startAutoDecay is called', () => {
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000,
          decayAmount: 1,
        })

        for (let i = 0; i < 5; i++) {
          decayManager.updateSeen(testAddress)
        }

        // Start auto decay
        decayManager.startAutoDecay()

        // Advance time by 2 hours
        vi.advanceTimersByTime(2 * 3600000)

        // Decay should have been applied automatically
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(3)

        // Stop auto decay
        decayManager.stopAutoDecay()
      })

      it('should stop auto decay timer when stopAutoDecay is called', () => {
        const decayManager = new ReputationManager(logger, {
          decayIntervalMs: 3600000,
          decayAmount: 1,
        })

        for (let i = 0; i < 5; i++) {
          decayManager.updateSeen(testAddress)
        }

        // Start and then stop auto decay
        decayManager.startAutoDecay()
        decayManager.stopAutoDecay()

        // Advance time
        vi.advanceTimersByTime(3 * 3600000)

        // Decay should NOT have been applied
        expect(decayManager.getEntry(testAddress)?.opsSeen).toBe(5)
      })
    })
  })
})
