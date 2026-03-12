/**
 * Session persistence for instant reconnection.
 *
 * Saves accounts/chainId to localStorage so a page reload
 * can restore the last connected state without a full eth_requestAccounts.
 */
import type { Address } from 'viem'
import { createLogger } from './logger'

const log = createLogger('Session')

export interface SessionData {
  accounts: Address[]
  chainId: string
  connectedAt: number
}

export interface SessionManagerConfig {
  /** localStorage key (default: 'stablenet:session') */
  storageKey?: string
  /** Max session age in ms (default: 24 hours) */
  maxAge?: number
  /** Custom storage backend (default: localStorage) */
  storage?: Storage
}

const DEFAULT_STORAGE_KEY = 'stablenet:session'
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

export class SessionManager {
  private readonly storageKey: string
  private readonly maxAge: number
  private readonly storage: Storage | null

  constructor(config: SessionManagerConfig = {}) {
    this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY
    this.maxAge = config.maxAge ?? DEFAULT_MAX_AGE
    this.storage = typeof window !== 'undefined'
      ? (config.storage ?? window.localStorage)
      : null
  }

  save(data: SessionData): void {
    if (!this.storage) return
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data))
      log.debug('Session saved', { accounts: data.accounts.length, chainId: data.chainId })
    } catch {
      log.warn('Failed to save session')
    }
  }

  load(): SessionData | null {
    if (!this.storage) return null
    try {
      const raw = this.storage.getItem(this.storageKey)
      if (!raw) return null

      const data = JSON.parse(raw) as SessionData
      if (!data.accounts || !data.chainId || !data.connectedAt) return null

      // Check staleness
      if (Date.now() - data.connectedAt > this.maxAge) {
        log.debug('Session expired, clearing')
        this.clear()
        return null
      }

      return data
    } catch {
      log.warn('Failed to load session')
      return null
    }
  }

  clear(): void {
    if (!this.storage) return
    try {
      this.storage.removeItem(this.storageKey)
    } catch {
      // Ignore storage errors
    }
  }
}
