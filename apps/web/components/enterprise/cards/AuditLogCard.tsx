'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { EmptyState } from '../EmptyState'
import { formatAddress, formatRelativeTime } from '@/lib/utils'
import type { AuditLog } from '@/types'

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

interface AuditLogCardProps {
  logs: AuditLog[]
}

export function AuditLogCard({ logs }: AuditLogCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-16 h-16"
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
            }
            title="No audit logs found"
          />
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
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
  )
}
