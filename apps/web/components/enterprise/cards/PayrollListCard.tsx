'use client'

import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/common'
import { EmptyState } from '../EmptyState'
import { formatAddress, formatUSD } from '@/lib/utils'
import type { PayrollEntry } from '@/types'

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
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Frequency</th>
                  <th className="pb-3 font-medium">Next Payment</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                          {entry.recipient.slice(2, 4).toUpperCase()}
                        </div>
                        <code className="text-sm text-gray-700">
                          {formatAddress(entry.recipient)}
                        </code>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="font-medium text-gray-900">
                        {formatUSD(Number(entry.amount) / 10 ** entry.token.decimals)}
                      </span>
                      <span className="text-gray-500 ml-1">{entry.token.symbol}</span>
                    </td>
                    <td className="py-4 text-gray-500 capitalize">
                      {entry.frequency}
                    </td>
                    <td className="py-4 text-gray-500">
                      {entry.nextPaymentDate.toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        entry.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
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
