'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { formatAddress, formatUSD } from '@/lib/utils'
import type { PayrollEntry } from '@/types'
import { EmptyState } from '../EmptyState'

interface PayrollListCardProps {
  entries: PayrollEntry[]
  onEdit?: (id: string) => void
}

export function PayrollListCard({ entries, onEdit }: PayrollListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Payroll</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            title="No employees added yet"
            description="Add employees to start managing payroll"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-left text-sm border-b"
                  style={{
                    color: 'rgb(var(--muted-foreground))',
                    borderColor: 'rgb(var(--border))',
                  }}
                >
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Frequency</th>
                  <th className="pb-3 font-medium">Next Payment</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                          style={{ backgroundColor: 'rgb(var(--secondary))' }}
                        >
                          {entry.recipient.slice(2, 4).toUpperCase()}
                        </div>
                        <code className="text-sm" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                          {formatAddress(entry.recipient)}
                        </code>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {formatUSD(Number(entry.amount) / 10 ** entry.token.decimals)}
                      </span>
                      <span className="ml-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {entry.token.symbol}
                      </span>
                    </td>
                    <td
                      className="py-4 capitalize"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {entry.frequency}
                    </td>
                    <td className="py-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {entry.nextPaymentDate.toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={
                          entry.status === 'active'
                            ? {
                                backgroundColor: 'rgb(var(--success) / 0.1)',
                                color: 'rgb(var(--success))',
                              }
                            : {
                                backgroundColor: 'rgb(var(--secondary))',
                                color: 'rgb(var(--foreground) / 0.8)',
                              }
                        }
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onEdit?.(entry.id)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
