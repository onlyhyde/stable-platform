/**
 * React hook for tracking UserOperation receipt with polling.
 *
 * Wraps waitForUserOperationReceipt with React state management.
 * Supports pending operations tracking via localStorage.
 */

import { useCallback, useEffect, useState } from 'react'
import type { BundlerClient, UserOperationReceipt } from '@stablenet/sdk-types'
import type { Hex } from 'viem'

export interface PendingUserOp {
  hash: Hex
  timestamp: number
  description?: string
}

export interface UseUserOpReceiptConfig {
  bundlerClient: BundlerClient | null
  hash?: Hex | null
  autoWatch?: boolean
  timeout?: number
  storageKey?: string
}

export interface UseUserOpReceiptResult {
  receipt: UserOperationReceipt | null
  isWaiting: boolean
  error: Error | null
  waitForReceipt: (hash: Hex) => Promise<UserOperationReceipt>
  pendingOps: PendingUserOp[]
  addPendingOp: (hash: Hex, description?: string) => void
  removePendingOp: (hash: Hex) => void
}

const STORAGE_KEY_DEFAULT = 'stablenet:pending-user-ops'

/**
 * React hook for waiting on UserOperation receipts.
 *
 * @example
 * ```tsx
 * const { waitForReceipt, receipt, isWaiting, pendingOps } = useUserOpReceipt({
 *   bundlerClient,
 * })
 *
 * const receipt = await waitForReceipt(userOpHash)
 * ```
 */
export function useUserOpReceipt(config: UseUserOpReceiptConfig): UseUserOpReceiptResult {
  const { bundlerClient, hash, autoWatch = true, timeout = 60000, storageKey = STORAGE_KEY_DEFAULT } = config
  const [receipt, setReceipt] = useState<UserOperationReceipt | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pendingOps, setPendingOps] = useState<PendingUserOp[]>(() => loadPendingOps(storageKey))

  const savePendingOps = useCallback((ops: PendingUserOp[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(ops))
    } catch {
      // localStorage may not be available
    }
  }, [storageKey])

  const addPendingOp = useCallback((hash: Hex, description?: string) => {
    setPendingOps(prev => {
      const updated = [...prev, { hash, timestamp: Date.now(), description }]
      savePendingOps(updated)
      return updated
    })
  }, [savePendingOps])

  const removePendingOp = useCallback((hash: Hex) => {
    setPendingOps(prev => {
      const updated = prev.filter(op => op.hash !== hash)
      savePendingOps(updated)
      return updated
    })
  }, [savePendingOps])

  const waitForReceipt = useCallback(async (opHash: Hex): Promise<UserOperationReceipt> => {
    if (!bundlerClient) {
      throw new Error('Bundler client not configured')
    }

    setIsWaiting(true)
    setError(null)
    try {
      const result = await bundlerClient.waitForUserOperationReceipt(opHash, { timeout })
      setReceipt(result)
      removePendingOp(opHash)
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed waiting for receipt')
      setError(e)
      throw e
    } finally {
      setIsWaiting(false)
    }
  }, [bundlerClient, timeout, removePendingOp])

  // Auto-watch if hash is provided
  useEffect(() => {
    if (!autoWatch || !hash || !bundlerClient) return

    let cancelled = false

    const watch = async () => {
      setIsWaiting(true)
      try {
        const result = await bundlerClient.waitForUserOperationReceipt(hash, { timeout })
        if (!cancelled) {
          setReceipt(result)
          removePendingOp(hash)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed waiting for receipt'))
        }
      } finally {
        if (!cancelled) setIsWaiting(false)
      }
    }

    watch()
    return () => { cancelled = true }
  }, [autoWatch, hash, bundlerClient, timeout, removePendingOp])

  return { receipt, isWaiting, error, waitForReceipt, pendingOps, addPendingOp, removePendingOp }
}

function loadPendingOps(storageKey: string): PendingUserOp[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return []
    const ops = JSON.parse(stored) as PendingUserOp[]
    // Filter out stale ops (older than 24h)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return ops.filter(op => op.timestamp > cutoff)
  } catch {
    return []
  }
}
