'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, ConnectWalletCard, PageHeader, Pagination } from '@/components/common'
import {
  AuditFilterCard,
  AuditLogCard,
  AuditSummaryCards,
  ComplianceInfoCard,
} from '@/components/enterprise'
import { useWallet } from '@/hooks'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import type { AuditLog } from '@/types'

export default function AuditPage() {
  const { isConnected } = useWallet()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')

  const filter = useMemo(() => {
    if (filterAction === 'all') return undefined
    return { action: filterAction }
  }, [filterAction])

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const { logs: auditLogs, isLoading, error } = useAuditLogs({ filter })

  // Client-side search filtering (hook handles action filter)
  const filteredLogs = auditLogs.filter((log) => {
    if (searchQuery === '') return true
    return (
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.txHash?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  /**
   * Export audit logs as CSV
   */
  const handleExportLogs = useCallback(() => {
    if (filteredLogs.length === 0) return

    // CSV headers
    const headers = ['ID', 'Action', 'Actor', 'Target', 'Details', 'Timestamp', 'Transaction Hash']

    // CSV rows
    const rows = filteredLogs.map((log: AuditLog) => [
      log.id,
      log.action,
      log.actor,
      log.target || '',
      `"${log.details.replace(/"/g, '""')}"`, // Escape quotes in CSV
      log.timestamp.toISOString(),
      log.txHash || '',
    ])

    // Create CSV content
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredLogs])

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to view audit logs" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading audit logs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--destructive))' }}>Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Audit Log" description="Complete history of all enterprise actions" />
        <Button variant="secondary" onClick={handleExportLogs} disabled={filteredLogs.length === 0}>
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export Logs
        </Button>
      </div>

      <AuditSummaryCards
        totalActions={auditLogs.length}
        uniqueActors={new Set(auditLogs.map((l) => l.actor)).size}
        onChainPercentage="100%"
        complianceStatus="Compliant"
      />

      <AuditFilterCard
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterAction={filterAction}
        onFilterChange={setFilterAction}
      />

      <AuditLogCard
        logs={filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)}
        onPageChange={setCurrentPage}
      />

      <ComplianceInfoCard />
    </div>
  )
}
