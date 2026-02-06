'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { formatAddress, formatUSD } from '@/lib/utils'
import type { Expense } from '@/types'
import { EmptyState } from '../EmptyState'

const categoryColors: Record<string, { bg: string; text: string }> = {
  infrastructure: { bg: 'rgb(219 234 254)', text: 'rgb(30 64 175)' },
  travel: { bg: 'rgb(243 232 255)', text: 'rgb(107 33 168)' },
  software: { bg: 'rgb(220 252 231)', text: 'rgb(22 101 52)' },
  marketing: { bg: 'rgb(255 237 213)', text: 'rgb(154 52 18)' },
  other: { bg: 'rgb(var(--secondary))', text: 'rgb(var(--foreground))' },
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

interface ExpenseListCardProps {
  expenses: Expense[]
  filterStatus: string
  onFilterChange: (status: string) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onPay?: (id: string) => void
}

export function ExpenseListCard({
  expenses,
  filterStatus,
  onFilterChange,
  onApprove,
  onReject,
  onPay,
}: ExpenseListCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Expense Reports</CardTitle>
        <select
          value={filterStatus}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm"
          style={{ borderColor: 'rgb(var(--border))' }}
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
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
                  d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
                />
              </svg>
            }
            title="No expenses found"
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
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Submitter</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="py-4">
                      <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {expense.description}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {formatUSD(Number(expense.amount) / 10 ** expense.token.decimals)}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className="text-xs px-2 py-1 rounded-full capitalize"
                        style={{
                          backgroundColor: (
                            categoryColors[expense.category] || categoryColors.other
                          ).bg,
                          color: (categoryColors[expense.category] || categoryColors.other).text,
                        }}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-4">
                      <code className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {formatAddress(expense.submitter)}
                      </code>
                    </td>
                    <td className="py-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {expense.submittedAt.toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full capitalize ${statusColors[expense.status]}`}
                      >
                        {expense.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {expense.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'rgb(var(--success))' }}
                            onClick={() => onApprove?.(expense.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'rgb(var(--destructive))' }}
                            onClick={() => onReject?.(expense.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {expense.status === 'approved' && (
                        <Button variant="secondary" size="sm" onClick={() => onPay?.(expense.id)}>
                          Pay
                        </Button>
                      )}
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
