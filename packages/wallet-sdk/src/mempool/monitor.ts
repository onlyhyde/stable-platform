/**
 * UserOperation Mempool Monitor
 *
 * Tracks pending ERC-4337 UserOperations and provides
 * event-based status change notifications via polling
 * the bundler's eth_getUserOperationReceipt RPC method.
 */

import type { Address, Hex } from 'viem'
import type { UserOperationReceipt } from '../rpc'

// ============================================================================
// Types
// ============================================================================

export type UserOpStatus =
  | 'pending'
  | 'submitted'
  | 'included'
  | 'failed'
  | 'dropped'

export interface MonitorConfig {
  /** Bundler JSON-RPC endpoint URL */
  bundlerUrl: string
  /** EntryPoint contract address */
  entryPoint: Address
  /** Chain ID */
  chainId: number
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number
  /** Time to keep completed/failed ops before cleanup in ms (default: 60000) */
  completedTTL?: number
}

export interface TrackedUserOp {
  hash: Hex
  status: UserOpStatus
  trackedAt: number
  updatedAt: number
  receipt?: UserOperationReceipt
}

export type StatusChangeCallback = (
  hash: Hex,
  oldStatus: UserOpStatus,
  newStatus: UserOpStatus
) => void

// ============================================================================
// RPC Helper
// ============================================================================

interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: { code: number; message: string }
}

let rpcId = 0

async function bundlerRpc<T>(
  url: string,
  method: string,
  params: unknown[]
): Promise<T | null> {
  rpcId += 1
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: rpcId,
      method,
      params,
    }),
  })

  if (!response.ok) {
    return null
  }

  const json = (await response.json()) as JsonRpcResponse<T>
  if (json.error) {
    return null
  }

  return json.result ?? null
}

// ============================================================================
// UserOpMonitor
// ============================================================================

const TERMINAL_STATUSES: ReadonlySet<UserOpStatus> = new Set([
  'included',
  'failed',
  'dropped',
])

/**
 * Monitors pending ERC-4337 UserOperations by polling the bundler.
 *
 * @example
 * ```ts
 * const monitor = new UserOpMonitor({
 *   bundlerUrl: 'http://localhost:4337',
 *   entryPoint: '0x...',
 *   chainId: 8283,
 * })
 *
 * monitor.onStatusChange((hash, oldStatus, newStatus) => {
 *   console.log(`${hash}: ${oldStatus} -> ${newStatus}`)
 * })
 *
 * monitor.track('0xabc...')
 * ```
 */
export class UserOpMonitor {
  private readonly config: Required<MonitorConfig>
  private readonly tracked: Map<Hex, TrackedUserOp> = new Map()
  private readonly callbacks: Set<StatusChangeCallback> = new Set()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(config: MonitorConfig) {
    this.config = {
      pollingInterval: 3000,
      completedTTL: 60_000,
      ...config,
    }
    this.startPolling()
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Start tracking a UserOperation by its hash.
   * Initial status is 'pending'.
   */
  track(userOpHash: Hex): void {
    if (this.destroyed) return

    if (this.tracked.has(userOpHash)) return

    const now = Date.now()
    this.tracked.set(userOpHash, {
      hash: userOpHash,
      status: 'pending',
      trackedAt: now,
      updatedAt: now,
    })
  }

  /**
   * Stop tracking a UserOperation.
   */
  untrack(userOpHash: Hex): void {
    this.tracked.delete(userOpHash)
  }

  /**
   * Get the current status of a tracked UserOperation.
   * Returns undefined if not tracked.
   */
  getStatus(userOpHash: Hex): UserOpStatus | undefined {
    return this.tracked.get(userOpHash)?.status
  }

  /**
   * Get all tracked UserOperations with their current statuses.
   */
  getAll(): TrackedUserOp[] {
    return Array.from(this.tracked.values())
  }

  /**
   * Register a callback for status change events.
   * Returns an unsubscribe function.
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Cleanup all intervals and tracked state.
   * The monitor cannot be used after calling destroy().
   */
  destroy(): void {
    this.destroyed = true
    this.stopPolling()
    this.tracked.clear()
    this.callbacks.clear()
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private startPolling(): void {
    if (this.pollTimer) return

    this.pollTimer = setInterval(() => {
      void this.poll()
    }, this.config.pollingInterval)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async poll(): Promise<void> {
    if (this.destroyed) return

    const entries = Array.from(this.tracked.entries())

    // Poll non-terminal entries for receipt
    const pending = entries.filter(
      ([, op]) => !TERMINAL_STATUSES.has(op.status)
    )
    await Promise.all(
      pending.map(([hash]) => this.pollUserOp(hash))
    )

    // Cleanup completed ops past TTL
    const now = Date.now()
    for (const [hash, op] of entries) {
      if (
        TERMINAL_STATUSES.has(op.status) &&
        now - op.updatedAt > this.config.completedTTL
      ) {
        this.tracked.delete(hash)
      }
    }
  }

  private async pollUserOp(hash: Hex): Promise<void> {
    const receipt = await bundlerRpc<UserOperationReceipt>(
      this.config.bundlerUrl,
      'eth_getUserOperationReceipt',
      [hash]
    )

    const op = this.tracked.get(hash)
    if (!op) return

    if (receipt) {
      const newStatus: UserOpStatus = receipt.success ? 'included' : 'failed'
      if (op.status !== newStatus) {
        const oldStatus = op.status
        op.status = newStatus
        op.updatedAt = Date.now()
        op.receipt = receipt
        this.notifyStatusChange(hash, oldStatus, newStatus)
      }
    }
  }

  private notifyStatusChange(
    hash: Hex,
    oldStatus: UserOpStatus,
    newStatus: UserOpStatus
  ): void {
    for (const callback of this.callbacks) {
      try {
        callback(hash, oldStatus, newStatus)
      } catch {
        // Swallow callback errors to avoid breaking the poll loop
      }
    }
  }
}
