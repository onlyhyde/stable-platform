'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { PageHeader, ConnectWalletCard, Button } from '@/components/common'
import {
  AuditSummaryCards,
  AuditFilterCard,
  AuditLogCard,
  ComplianceInfoCard,
} from '@/components/enterprise'
import type { AuditLog } from '@/types'

// Mock audit log data
const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    action: 'payroll_processed',
    actor: '0x1234567890123456789012345678901234567890',
    target: '0x2345678901234567890123456789012345678901',
    details: 'Processed monthly payroll payment of $5,000 USDC',
    timestamp: new Date(Date.now() - 3600000),
    txHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  },
  {
    id: '2',
    action: 'expense_approved',
    actor: '0x3456789012345678901234567890123456789012',
    target: '0x4567890123456789012345678901234567890123',
    details: 'Approved expense report for AWS Cloud Services ($1,500)',
    timestamp: new Date(Date.now() - 7200000),
    txHash: '0xbcde2345678901bcdef02345678901bcdef02345678901bcdef02345678901bc',
  },
  {
    id: '3',
    action: 'role_granted',
    actor: '0x5678901234567890123456789012345678901234',
    target: '0x6789012345678901234567890123456789012345',
    details: 'Granted PAYROLL_ADMIN role to address',
    timestamp: new Date(Date.now() - 86400000),
    txHash: '0xcdef3456789012cdef13456789012cdef13456789012cdef13456789012cdef1',
  },
  {
    id: '4',
    action: 'expense_rejected',
    actor: '0x7890123456789012345678901234567890123456',
    target: '0x8901234567890123456789012345678901234567',
    details: 'Rejected expense report: Missing documentation',
    timestamp: new Date(Date.now() - 172800000),
    txHash: '0xdef04567890123def024567890123def024567890123def024567890123def02',
  },
  {
    id: '5',
    action: 'employee_added',
    actor: '0x9012345678901234567890123456789012345678',
    target: '0x0123456789012345678901234567890123456789',
    details: 'Added new employee to payroll system',
    timestamp: new Date(Date.now() - 259200000),
    txHash: '0xef015678901234ef0135678901234ef0135678901234ef0135678901234ef013',
  },
]

export default function AuditPage() {
  const { isConnected } = useWallet()
  const [auditLogs] = useState<AuditLog[]>(mockAuditLogs)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = searchQuery === '' ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.txHash?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesAction = filterAction === 'all' || log.action === filterAction

    return matchesSearch && matchesAction
  })

  if (!isConnected) {
    return (
      <ConnectWalletCard message="Please connect your wallet to view audit logs" />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Audit Log"
          description="Complete history of all enterprise actions"
        />
        <Button variant="secondary">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Logs
        </Button>
      </div>

      <AuditSummaryCards
        totalActions={auditLogs.length}
        uniqueActors={new Set(auditLogs.map(l => l.actor)).size}
        onChainPercentage="100%"
        complianceStatus="Compliant"
      />

      <AuditFilterCard
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterAction={filterAction}
        onFilterChange={setFilterAction}
      />

      <AuditLogCard logs={filteredLogs} />

      <ComplianceInfoCard />
    </div>
  )
}
