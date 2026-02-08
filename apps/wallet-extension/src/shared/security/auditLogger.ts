/**
 * Audit Logger (SEC-16)
 *
 * Logs security-sensitive operations for compliance and forensics.
 * Stores audit events in chrome.storage.local with rotation.
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('AuditLogger')

/**
 * Audit event types
 */
export const AuditEventType = {
  // Wallet lifecycle
  WALLET_CREATED: 'wallet.created',
  WALLET_UNLOCKED: 'wallet.unlocked',
  WALLET_LOCKED: 'wallet.locked',
  WALLET_CLEARED: 'wallet.cleared',
  PASSWORD_CHANGED: 'wallet.password_changed',

  // Account management
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_IMPORTED: 'account.imported',
  ACCOUNT_REMOVED: 'account.removed',
  MNEMONIC_VIEWED: 'account.mnemonic_viewed',
  PRIVATE_KEY_EXPORTED: 'account.private_key_exported',

  // Connection events
  DAPP_CONNECTED: 'connection.dapp_connected',
  DAPP_DISCONNECTED: 'connection.dapp_disconnected',
  PERMISSION_GRANTED: 'connection.permission_granted',
  PERMISSION_REVOKED: 'connection.permission_revoked',

  // Transaction events
  TX_REQUESTED: 'transaction.requested',
  TX_APPROVED: 'transaction.approved',
  TX_REJECTED: 'transaction.rejected',
  TX_SIGNED: 'transaction.signed',
  TX_SENT: 'transaction.sent',
  TX_FAILED: 'transaction.failed',

  // Signature events
  SIGN_REQUESTED: 'signature.requested',
  SIGN_APPROVED: 'signature.approved',
  SIGN_REJECTED: 'signature.rejected',

  // Network events
  NETWORK_SWITCHED: 'network.switched',
  NETWORK_ADDED: 'network.added',
  NETWORK_REMOVED: 'network.removed',

  // Security events
  RATE_LIMITED: 'security.rate_limited',
  PHISHING_BLOCKED: 'security.phishing_blocked',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  SESSION_RESTORED: 'security.session_restored',
  SESSION_EXPIRED: 'security.session_expired',
  REAUTHENTICATION_REQUIRED: 'security.reauth_required',
  REAUTHENTICATION_SUCCESS: 'security.reauth_success',
  REAUTHENTICATION_FAILED: 'security.reauth_failed',
} as const

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType]

/**
 * Audit event severity levels
 */
export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const

export type AuditSeverityValue = (typeof AuditSeverity)[keyof typeof AuditSeverity]

/**
 * Audit event structure
 */
export interface AuditEvent {
  id: string
  timestamp: number
  type: AuditEventTypeValue
  severity: AuditSeverityValue
  origin?: string
  address?: string
  chainId?: number
  data: Record<string, unknown>
  /** Hash of sensitive data (not the actual data) */
  dataHash?: string
}

/**
 * Audit log configuration
 */
interface AuditConfig {
  /** Maximum number of events to store */
  maxEvents: number
  /** Events older than this (ms) will be purged */
  maxAge: number
  /** Storage key for audit log */
  storageKey: string
  /** Enable console logging */
  consoleLogging: boolean
}

const DEFAULT_CONFIG: AuditConfig = {
  maxEvents: 1000,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  storageKey: 'audit_log',
  consoleLogging: process.env.NODE_ENV !== 'production',
}

/**
 * Event type to severity mapping
 */
const SEVERITY_MAP: Record<AuditEventTypeValue, AuditSeverityValue> = {
  // Info events
  [AuditEventType.WALLET_UNLOCKED]: AuditSeverity.INFO,
  [AuditEventType.WALLET_LOCKED]: AuditSeverity.INFO,
  [AuditEventType.DAPP_CONNECTED]: AuditSeverity.INFO,
  [AuditEventType.DAPP_DISCONNECTED]: AuditSeverity.INFO,
  [AuditEventType.TX_REQUESTED]: AuditSeverity.INFO,
  [AuditEventType.TX_APPROVED]: AuditSeverity.INFO,
  [AuditEventType.TX_REJECTED]: AuditSeverity.INFO,
  [AuditEventType.SIGN_REQUESTED]: AuditSeverity.INFO,
  [AuditEventType.SIGN_APPROVED]: AuditSeverity.INFO,
  [AuditEventType.SIGN_REJECTED]: AuditSeverity.INFO,
  [AuditEventType.NETWORK_SWITCHED]: AuditSeverity.INFO,
  [AuditEventType.SESSION_RESTORED]: AuditSeverity.INFO,

  // Warning events
  [AuditEventType.WALLET_CREATED]: AuditSeverity.WARNING,
  [AuditEventType.ACCOUNT_CREATED]: AuditSeverity.WARNING,
  [AuditEventType.ACCOUNT_IMPORTED]: AuditSeverity.WARNING,
  [AuditEventType.ACCOUNT_REMOVED]: AuditSeverity.WARNING,
  [AuditEventType.PERMISSION_GRANTED]: AuditSeverity.WARNING,
  [AuditEventType.PERMISSION_REVOKED]: AuditSeverity.WARNING,
  [AuditEventType.TX_SIGNED]: AuditSeverity.WARNING,
  [AuditEventType.TX_SENT]: AuditSeverity.WARNING,
  [AuditEventType.NETWORK_ADDED]: AuditSeverity.WARNING,
  [AuditEventType.NETWORK_REMOVED]: AuditSeverity.WARNING,
  [AuditEventType.RATE_LIMITED]: AuditSeverity.WARNING,
  [AuditEventType.SESSION_EXPIRED]: AuditSeverity.WARNING,
  [AuditEventType.REAUTHENTICATION_REQUIRED]: AuditSeverity.WARNING,
  [AuditEventType.REAUTHENTICATION_SUCCESS]: AuditSeverity.WARNING,

  // Critical events
  [AuditEventType.WALLET_CLEARED]: AuditSeverity.CRITICAL,
  [AuditEventType.PASSWORD_CHANGED]: AuditSeverity.CRITICAL,
  [AuditEventType.MNEMONIC_VIEWED]: AuditSeverity.CRITICAL,
  [AuditEventType.PRIVATE_KEY_EXPORTED]: AuditSeverity.CRITICAL,
  [AuditEventType.TX_FAILED]: AuditSeverity.CRITICAL,
  [AuditEventType.PHISHING_BLOCKED]: AuditSeverity.CRITICAL,
  [AuditEventType.SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
  [AuditEventType.REAUTHENTICATION_FAILED]: AuditSeverity.CRITICAL,
}

/**
 * Audit Logger class
 */
export class AuditLogger {
  private config: AuditConfig
  private eventQueue: AuditEvent[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private isInitialized = false

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize the audit logger
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Perform initial cleanup
    await this.cleanup()
    this.isInitialized = true
  }

  /**
   * Log an audit event
   */
  async log(
    type: AuditEventTypeValue,
    data: Record<string, unknown> = {},
    options: {
      origin?: string
      address?: string
      chainId?: number
    } = {}
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      severity: SEVERITY_MAP[type] || AuditSeverity.INFO,
      data: this.sanitizeData(data),
      ...options,
    }

    // Hash sensitive data if present
    if (data.sensitiveData) {
      event.dataHash = await this.hashData(String(data.sensitiveData))
      event.data.sensitiveData = undefined
    }

    // Console logging for development
    if (this.config.consoleLogging) {
      this.logToConsole(event)
    }

    // Add to queue
    this.eventQueue.push(event)

    // Schedule flush
    this.scheduleFlush()
  }

  /**
   * Log a wallet lifecycle event
   */
  async logWallet(
    type:
      | typeof AuditEventType.WALLET_CREATED
      | typeof AuditEventType.WALLET_UNLOCKED
      | typeof AuditEventType.WALLET_LOCKED
      | typeof AuditEventType.WALLET_CLEARED
      | typeof AuditEventType.PASSWORD_CHANGED,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log(type, data)
  }

  /**
   * Log an account event
   */
  async logAccount(
    type:
      | typeof AuditEventType.ACCOUNT_CREATED
      | typeof AuditEventType.ACCOUNT_IMPORTED
      | typeof AuditEventType.ACCOUNT_REMOVED
      | typeof AuditEventType.MNEMONIC_VIEWED
      | typeof AuditEventType.PRIVATE_KEY_EXPORTED,
    address: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log(type, data, { address })
  }

  /**
   * Log a connection event
   */
  async logConnection(
    type:
      | typeof AuditEventType.DAPP_CONNECTED
      | typeof AuditEventType.DAPP_DISCONNECTED
      | typeof AuditEventType.PERMISSION_GRANTED
      | typeof AuditEventType.PERMISSION_REVOKED,
    origin: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log(type, data, { origin })
  }

  /**
   * Log a transaction event
   */
  async logTransaction(
    type:
      | typeof AuditEventType.TX_REQUESTED
      | typeof AuditEventType.TX_APPROVED
      | typeof AuditEventType.TX_REJECTED
      | typeof AuditEventType.TX_SIGNED
      | typeof AuditEventType.TX_SENT
      | typeof AuditEventType.TX_FAILED,
    data: {
      from?: string
      to?: string
      value?: string
      chainId?: number
      txHash?: string
      error?: string
    }
  ): Promise<void> {
    await this.log(type, data, {
      address: data.from,
      chainId: data.chainId,
    })
  }

  /**
   * Log a signature event
   */
  async logSignature(
    type:
      | typeof AuditEventType.SIGN_REQUESTED
      | typeof AuditEventType.SIGN_APPROVED
      | typeof AuditEventType.SIGN_REJECTED,
    data: {
      method: string
      address?: string
      origin?: string
      riskLevel?: string
    }
  ): Promise<void> {
    await this.log(type, data, {
      origin: data.origin,
      address: data.address,
    })
  }

  /**
   * Log a security event
   */
  async logSecurity(
    type:
      | typeof AuditEventType.RATE_LIMITED
      | typeof AuditEventType.PHISHING_BLOCKED
      | typeof AuditEventType.SUSPICIOUS_ACTIVITY
      | typeof AuditEventType.SESSION_RESTORED
      | typeof AuditEventType.SESSION_EXPIRED
      | typeof AuditEventType.REAUTHENTICATION_REQUIRED
      | typeof AuditEventType.REAUTHENTICATION_SUCCESS
      | typeof AuditEventType.REAUTHENTICATION_FAILED,
    data: Record<string, unknown> = {},
    origin?: string
  ): Promise<void> {
    await this.log(type, data, { origin })
  }

  /**
   * Get audit events with optional filters
   */
  async getEvents(
    options: {
      type?: AuditEventTypeValue
      severity?: AuditSeverityValue
      origin?: string
      address?: string
      fromTimestamp?: number
      toTimestamp?: number
      limit?: number
    } = {}
  ): Promise<AuditEvent[]> {
    // Flush pending events first
    await this.flush()

    const stored = await this.loadEvents()
    let events = stored

    // Apply filters
    if (options.type) {
      events = events.filter((e) => e.type === options.type)
    }
    if (options.severity) {
      events = events.filter((e) => e.severity === options.severity)
    }
    if (options.origin) {
      events = events.filter((e) => e.origin === options.origin)
    }
    if (options.address) {
      events = events.filter((e) => e.address?.toLowerCase() === options.address?.toLowerCase())
    }
    if (options.fromTimestamp) {
      events = events.filter((e) => e.timestamp >= options.fromTimestamp!)
    }
    if (options.toTimestamp) {
      events = events.filter((e) => e.timestamp <= options.toTimestamp!)
    }

    // Sort by timestamp descending (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp)

    // Apply limit
    if (options.limit) {
      events = events.slice(0, options.limit)
    }

    return events
  }

  /**
   * Get critical events (for security dashboard)
   */
  async getCriticalEvents(limit = 50): Promise<AuditEvent[]> {
    return this.getEvents({
      severity: AuditSeverity.CRITICAL,
      limit,
    })
  }

  /**
   * Export audit log
   */
  async export(): Promise<string> {
    const events = await this.getEvents()
    return JSON.stringify(events, null, 2)
  }

  /**
   * Clear all audit events
   */
  async clear(): Promise<void> {
    await this.log(AuditEventType.SUSPICIOUS_ACTIVITY, {
      action: 'audit_log_cleared',
    })
    await this.flush()

    try {
      await chrome.storage.local.remove(this.config.storageKey)
    } catch (error) {
      logger.error('Failed to clear audit log', error)
    }
  }

  /**
   * Flush pending events to storage
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const eventsToFlush = [...this.eventQueue]
    this.eventQueue = []

    try {
      const stored = await this.loadEvents()
      const combined = [...stored, ...eventsToFlush]

      // Trim to max events
      const trimmed = combined.slice(-this.config.maxEvents)

      await chrome.storage.local.set({
        [this.config.storageKey]: trimmed,
      })
    } catch (error) {
      logger.error('Failed to flush audit events', error)
      // Re-queue events on failure
      this.eventQueue = [...eventsToFlush, ...this.eventQueue]
    }
  }

  /**
   * Schedule a flush operation
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null
      await this.flush()
    }, 1000) // Batch writes every second
  }

  /**
   * Load events from storage
   */
  private async loadEvents(): Promise<AuditEvent[]> {
    try {
      const stored = await chrome.storage.local.get(this.config.storageKey)
      return (stored[this.config.storageKey] as AuditEvent[]) || []
    } catch {
      return []
    }
  }

  /**
   * Cleanup old events
   */
  private async cleanup(): Promise<void> {
    try {
      const events = await this.loadEvents()
      const cutoff = Date.now() - this.config.maxAge
      const filtered = events.filter((e) => e.timestamp > cutoff)

      if (filtered.length < events.length) {
        await chrome.storage.local.set({
          [this.config.storageKey]: filtered,
        })
        logger.info(`Cleaned up ${events.length - filtered.length} old audit events`)
      }
    } catch (error) {
      logger.error('Failed to cleanup audit events', error)
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}`
  }

  /**
   * Sanitize data for logging (remove sensitive values)
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    const sensitiveKeys = ['password', 'mnemonic', 'privateKey', 'seed', 'secret']

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Hash sensitive data
   */
  private async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    const hashArray = Array.from(new Uint8Array(buffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Log to console for development
   */
  private logToConsole(event: AuditEvent): void {
    const severityColors: Record<AuditSeverityValue, string> = {
      [AuditSeverity.INFO]: '\x1b[36m', // Cyan
      [AuditSeverity.WARNING]: '\x1b[33m', // Yellow
      [AuditSeverity.CRITICAL]: '\x1b[31m', // Red
    }
    const reset = '\x1b[0m'
    const color = severityColors[event.severity]

    logger.info(`${color}[AUDIT:${event.severity.toUpperCase()}]${reset} ${event.type}`, event.data)
  }
}

// Singleton instance
export const auditLogger = new AuditLogger()
