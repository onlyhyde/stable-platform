'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AuditLog } from '@/types'

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
}

export function useAuditLogs(config: UseAuditLogsConfig = {}): UseAuditLogsReturn {
  const { fetchLogs, filter, autoFetch = true } = config
  const [allLogs, setAllLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!fetchLogs) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchLogs()
      setAllLogs(result)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch audit logs')
      setError(fetchError)
      setAllLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchLogs])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  const logs = useMemo(() => {
    if (!filter) return allLogs

    return allLogs.filter(log => {
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
  }
}
