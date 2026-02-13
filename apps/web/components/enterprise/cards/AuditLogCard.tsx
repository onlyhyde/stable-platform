'use client'

import { useChainId } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { formatAddress, formatRelativeTime, getBlockExplorerUrl } from '@/lib/utils'
import type { AuditLog } from '@/types'
import { EmptyState } from '../EmptyState'

const actionLabels: Record<string, { label: string; bg: string; text: string }> = {
  payroll_processed: { label: 'Payroll Processed', bg: 'rgb(220 252 231)', text: 'rgb(22 101 52)' },
  expense_approved: { label: 'Expense Approved', bg: 'rgb(219 234 254)', text: 'rgb(30 64 175)' },
  expense_rejected: { label: 'Expense Rejected', bg: 'rgb(254 226 226)', text: 'rgb(153 27 27)' },
  expense_paid: { label: 'Expense Paid', bg: 'rgb(209 250 229)', text: 'rgb(6 95 70)' },
  role_granted: { label: 'Role Granted', bg: 'rgb(243 232 255)', text: 'rgb(107 33 168)' },
  role_revoked: { label: 'Role Revoked', bg: 'rgb(255 237 213)', text: 'rgb(154 52 18)' },
  employee_added: { label: 'Employee Added', bg: 'rgb(207 250 254)', text: 'rgb(14 116 144)' },
  employee_removed: {
    label: 'Employee Removed',
    bg: 'rgb(var(--secondary))',
    text: 'rgb(var(--foreground))',
  },
  config_updated: { label: 'Config Updated', bg: 'rgb(254 249 195)', text: 'rgb(133 77 14)' },
}

interface AuditLogCardProps {
  logs: AuditLog[]
}

export function AuditLogCard({ logs }: AuditLogCardProps) {
  const chainId = useChainId()

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
              const actionInfo = actionLabels[log.action] || {
                label: log.action,
                bg: 'rgb(var(--secondary))',
                text: 'rgb(var(--foreground))',
              }

              return (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 transition-colors hover:opacity-80"
                  style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'rgb(var(--secondary))' }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ backgroundColor: actionInfo.bg, color: actionInfo.text }}
                          >
                            {actionInfo.label}
                          </span>
                          <span
                            className="text-sm"
                            style={{ color: 'rgb(var(--muted-foreground))' }}
                          >
                            {formatRelativeTime(log.timestamp.getTime())}
                          </span>
                        </div>
                        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {log.details}
                        </p>
                        <div
                          className="flex gap-4 mt-2 text-sm"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          <span>
                            Actor:{' '}
                            <code style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                              {formatAddress(log.actor)}
                            </code>
                          </span>
                          {log.target && (
                            <span>
                              Target:{' '}
                              <code style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                                {formatAddress(log.target)}
                              </code>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {log.txHash && (
                      <a
                        href={getBlockExplorerUrl(chainId, { txHash: log.txHash })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm flex items-center gap-1 hover:opacity-80"
                        style={{ color: 'rgb(var(--primary))' }}
                      >
                        View Tx
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
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
