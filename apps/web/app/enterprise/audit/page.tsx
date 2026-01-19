'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/common'
import { formatAddress, formatRelativeTime } from '@/lib/utils'
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

const actionLabels: Record<string, { label: string; color: string }> = {
  payroll_processed: { label: 'Payroll Processed', color: 'bg-green-100 text-green-800' },
  expense_approved: { label: 'Expense Approved', color: 'bg-blue-100 text-blue-800' },
  expense_rejected: { label: 'Expense Rejected', color: 'bg-red-100 text-red-800' },
  expense_paid: { label: 'Expense Paid', color: 'bg-emerald-100 text-emerald-800' },
  role_granted: { label: 'Role Granted', color: 'bg-purple-100 text-purple-800' },
  role_revoked: { label: 'Role Revoked', color: 'bg-orange-100 text-orange-800' },
  employee_added: { label: 'Employee Added', color: 'bg-cyan-100 text-cyan-800' },
  employee_removed: { label: 'Employee Removed', color: 'bg-gray-100 text-gray-800' },
  config_updated: { label: 'Config Updated', color: 'bg-yellow-100 text-yellow-800' },
}

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to view audit logs</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500">Complete history of all enterprise actions</p>
        </div>
        <Button variant="secondary">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Logs
        </Button>
      </div>

      {/* Compliance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Total Actions (30d)</p>
            <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Unique Actors</p>
            <p className="text-2xl font-bold text-gray-900">
              {new Set(auditLogs.map(l => l.actor)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">On-Chain Records</p>
            <p className="text-2xl font-bold text-green-600">100%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Compliance Status</p>
            <p className="text-2xl font-bold text-green-600">Compliant</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by details, address, or transaction hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg"
              aria-label="Filter by action type"
            >
              <option value="all">All Actions</option>
              <option value="payroll_processed">Payroll Processed</option>
              <option value="expense_approved">Expense Approved</option>
              <option value="expense_rejected">Expense Rejected</option>
              <option value="role_granted">Role Granted</option>
              <option value="employee_added">Employee Added</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <p className="text-gray-500">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const actionInfo = actionLabels[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' }

                return (
                  <div key={log.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${actionInfo.color}`}>
                              {actionInfo.label}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatRelativeTime(log.timestamp.getTime())}
                            </span>
                          </div>
                          <p className="text-gray-900 font-medium">{log.details}</p>
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>
                              Actor: <code className="text-gray-700">{formatAddress(log.actor)}</code>
                            </span>
                            {log.target && (
                              <span>
                                Target: <code className="text-gray-700">{formatAddress(log.target)}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {log.txHash && (
                        <a
                          href={`https://etherscan.io/tx/${log.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
                        >
                          View Tx
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Info */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-medium text-green-900">Immutable Audit Trail</p>
              <p className="text-sm text-green-700 mt-1">
                All actions are recorded on-chain with cryptographic signatures.
                This provides tamper-proof evidence for regulatory compliance and internal audits.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
