'use client'

import { Card, CardContent, Input } from '@/components/common'

interface AuditFilterCardProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filterAction: string
  onFilterChange: (action: string) => void
}

export function AuditFilterCard({
  searchQuery,
  onSearchChange,
  filterAction,
  onFilterChange,
}: AuditFilterCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by details, address, or transaction hash..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              leftElement={
                <svg
                  className="w-5 h-5"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            style={{
              borderColor: 'rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
            }}
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
  )
}
