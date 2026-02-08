/**
 * Audit Logger Tests (SEC-16)
 */

import {
  AuditEventType,
  AuditLogger,
  AuditSeverity,
  auditLogger,
} from '../../../src/shared/security/auditLogger'
import { mockChrome } from '../../utils/mockChrome'

describe('AuditLogger', () => {
  let logger: AuditLogger
  const STORAGE_KEY = 'test_audit_log'

  beforeEach(async () => {
    logger = new AuditLogger({
      storageKey: STORAGE_KEY,
      consoleLogging: false,
      maxEvents: 100,
    })
    await mockChrome.storage.local.clear()
    await logger.initialize()
  })

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      const newLogger = new AuditLogger({ storageKey: 'init_test' })
      await expect(newLogger.initialize()).resolves.not.toThrow()
    })

    it('should handle multiple initializations', async () => {
      await logger.initialize()
      await logger.initialize()
      // Should not throw
    })
  })

  describe('logging events', () => {
    it('should log wallet events', async () => {
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await new Promise((resolve) => setTimeout(resolve, 1500)) // Wait for flush

      const events = await logger.getEvents()
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe(AuditEventType.WALLET_UNLOCKED)
    })

    it('should log account events with address', async () => {
      const address = '0x1234567890123456789012345678901234567890'
      await logger.logAccount(AuditEventType.ACCOUNT_CREATED, address, {
        keyringType: 'hd',
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.some((e) => e.address === address)).toBe(true)
    })

    it('should log connection events with origin', async () => {
      const origin = 'https://example.com'
      await logger.logConnection(AuditEventType.DAPP_CONNECTED, origin)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.some((e) => e.origin === origin)).toBe(true)
    })

    it('should log transaction events', async () => {
      await logger.logTransaction(AuditEventType.TX_APPROVED, {
        from: '0x1234',
        to: '0x5678',
        value: '1000000000000000000',
        chainId: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.some((e) => e.type === AuditEventType.TX_APPROVED)).toBe(true)
    })

    it('should log signature events', async () => {
      await logger.logSignature(AuditEventType.SIGN_REQUESTED, {
        method: 'personal_sign',
        address: '0x1234',
        origin: 'https://app.example.com',
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.some((e) => e.type === AuditEventType.SIGN_REQUESTED)).toBe(true)
    })

    it('should log security events', async () => {
      await logger.logSecurity(
        AuditEventType.RATE_LIMITED,
        { method: 'eth_sendTransaction', count: 10 },
        'https://malicious.com'
      )
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.some((e) => e.type === AuditEventType.RATE_LIMITED)).toBe(true)
    })
  })

  describe('severity levels', () => {
    it('should assign INFO severity to unlock events', async () => {
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events[0].severity).toBe(AuditSeverity.INFO)
    })

    it('should assign WARNING severity to account creation', async () => {
      await logger.logAccount(AuditEventType.ACCOUNT_CREATED, '0x1234')
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events[0].severity).toBe(AuditSeverity.WARNING)
    })

    it('should assign CRITICAL severity to mnemonic viewing', async () => {
      await logger.logAccount(AuditEventType.MNEMONIC_VIEWED, '0x1234')
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events[0].severity).toBe(AuditSeverity.CRITICAL)
    })
  })

  describe('data sanitization', () => {
    it('should redact sensitive fields', async () => {
      await logger.log(AuditEventType.WALLET_CREATED, {
        password: 'secret123',
        mnemonic: 'abandon abandon abandon',
        normalField: 'visible',
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events[0].data.password).toBe('[REDACTED]')
      expect(events[0].data.mnemonic).toBe('[REDACTED]')
      expect(events[0].data.normalField).toBe('visible')
    })

    it('should hash sensitive data', async () => {
      await logger.log(AuditEventType.WALLET_CREATED, {
        sensitiveData: 'some-secret-value',
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events[0].dataHash).toBeDefined()
      expect(events[0].dataHash?.length).toBe(64) // SHA-256 hex
      expect(events[0].data.sensitiveData).toBeUndefined()
    })
  })

  describe('event filtering', () => {
    beforeEach(async () => {
      // Add multiple events
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await logger.logAccount(AuditEventType.ACCOUNT_CREATED, '0x1111')
      await logger.logConnection(AuditEventType.DAPP_CONNECTED, 'https://a.com')
      await logger.logConnection(AuditEventType.DAPP_CONNECTED, 'https://b.com')
      await logger.logSecurity(AuditEventType.PHISHING_BLOCKED, {}, 'https://bad.com')
      await new Promise((resolve) => setTimeout(resolve, 1500))
    })

    it('should filter by event type', async () => {
      const events = await logger.getEvents({
        type: AuditEventType.DAPP_CONNECTED,
      })
      expect(events.every((e) => e.type === AuditEventType.DAPP_CONNECTED)).toBe(true)
    })

    it('should filter by severity', async () => {
      const events = await logger.getEvents({
        severity: AuditSeverity.CRITICAL,
      })
      expect(events.every((e) => e.severity === AuditSeverity.CRITICAL)).toBe(true)
    })

    it('should filter by origin', async () => {
      const events = await logger.getEvents({
        origin: 'https://a.com',
      })
      expect(events.every((e) => e.origin === 'https://a.com')).toBe(true)
    })

    it('should filter by address', async () => {
      const events = await logger.getEvents({
        address: '0x1111',
      })
      expect(events.length).toBeGreaterThan(0)
    })

    it('should limit results', async () => {
      const events = await logger.getEvents({ limit: 2 })
      expect(events.length).toBeLessThanOrEqual(2)
    })

    it('should get critical events', async () => {
      const events = await logger.getCriticalEvents()
      expect(events.every((e) => e.severity === AuditSeverity.CRITICAL)).toBe(true)
    })
  })

  describe('event ordering', () => {
    it('should return events in descending timestamp order', async () => {
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await new Promise((resolve) => setTimeout(resolve, 100))
      await logger.logWallet(AuditEventType.WALLET_LOCKED)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      for (let i = 1; i < events.length; i++) {
        expect(events[i - 1].timestamp).toBeGreaterThanOrEqual(events[i].timestamp)
      }
    })
  })

  describe('export', () => {
    it('should export audit log as JSON', async () => {
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const exported = await logger.export()
      const parsed = JSON.parse(exported)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)
    })
  })

  describe('clear', () => {
    it('should clear all events', async () => {
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      await logger.clear()
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      // Should only have the SUSPICIOUS_ACTIVITY event from clear()
      expect(events.filter((e) => e.type !== AuditEventType.SUSPICIOUS_ACTIVITY).length).toBe(0)
    })
  })

  describe('event batching', () => {
    it('should batch multiple events', async () => {
      // Log multiple events quickly
      await logger.logWallet(AuditEventType.WALLET_UNLOCKED)
      await logger.logConnection(AuditEventType.DAPP_CONNECTED, 'https://a.com')
      await logger.logConnection(AuditEventType.DAPP_CONNECTED, 'https://b.com')

      // Wait for batch flush
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const events = await logger.getEvents()
      expect(events.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(auditLogger).toBeInstanceOf(AuditLogger)
    })
  })
})
