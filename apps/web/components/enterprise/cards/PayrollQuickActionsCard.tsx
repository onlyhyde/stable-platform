'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'

interface PayrollQuickActionsCardProps {
  onProcessPayments?: () => void
  onExportReport?: () => void
}

export function PayrollQuickActionsCard({
  onProcessPayments,
  onExportReport,
}: PayrollQuickActionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={onProcessPayments}>
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Process All Payments
          </Button>
          <Button variant="secondary" onClick={onExportReport}>
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
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
