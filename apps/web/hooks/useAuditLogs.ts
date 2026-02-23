'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuditLog } from '@/types'

const STORAGE_KEY = 'stablenet:audit-logs'

interface AuditLogFilter {
  action?: string
  actor?: string
  fromDate?: Date
  toDate?: Date
}

interface UseAuditLogsConfig {
  fetchLogs?: () => Promise<AuditLog[]>
  filter?: AuditLogFilter
  autoFetch?: boolean
}

interface UseAuditLogsReturn {
  logs: AuditLog[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  addLog: (log: AuditLog) => void
}

function serializeLogs(logs: AuditLog[]): string {
  return JSON.stringify(
    logs.map((l) => ({
      ...l,
      timestamp: l.timestamp.toISOString(),
    }))
  )
}

function deserializeLogs(json: string): AuditLog[] {
  const raw = JSON.parse(json) as Array<Record<string, unknown>>
  return raw.map((l) => ({
    ...(l as unknown as AuditLog),
    timestamp: new Date(l.timestamp as string),
  })) as AuditLog[]
}

function loadFromStorage(): AuditLog[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return deserializeLogs(stored)
  } catch {
    return []
  }
}

function saveToStorage(logs: AuditLog[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, serializeLogs(logs))
  } catch {
    // Storage full or unavailable
  }
}

export function useAuditLogs(config: UseAuditLogsConfig = {}): UseAuditLogsReturn {
  const { fetchLogs, filter, autoFetch = true } = config
  const [allLogs, setAllLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++fetchIdRef.current

    // Use external fetch if provided (DI override)
    if (fetchLogs) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchLogs()
        if (id !== fetchIdRef.current) return
        setAllLogs(result)
      } catch (err) {
        if (id !== fetchIdRef.current) return
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch audit logs')
        setError(fetchError)
        setAllLogs([])
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // Default: load from localStorage
    const logs = loadFromStorage()
    if (id !== fetchIdRef.current) return
    setAllLogs(logs)
    setIsLoading(false)
  }, [fetchLogs])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const addLog = useCallback((log: AuditLog) => {
    setAllLogs((prev) => {
      const next = [...prev, log]
      saveToStorage(next)
      return next
    })
  }, [])

  const logs = useMemo(() => {
    if (!filter) return allLogs

    return allLogs.filter((log) => {
      if (filter.action && log.action !== filter.action) return false
      if (filter.actor && log.actor !== filter.actor) return false
      if (filter.fromDate && log.timestamp < filter.fromDate) return false
      if (filter.toDate && log.timestamp > filter.toDate) return false
      return true
    })
  }, [allLogs, filter])

  return {
    logs,
    isLoading,
    error,
    refresh,
    addLog,
  }
}
