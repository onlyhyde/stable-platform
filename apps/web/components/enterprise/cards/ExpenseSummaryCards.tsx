'use client'

import { formatUSD } from '@/lib/utils'
import { SummaryStatCard } from '../SummaryStatCard'

interface ExpenseSummaryCardsProps {
  totalPending: number
  totalApproved: number
  totalPaidMTD: number
  totalExpenses: number
}

export function ExpenseSummaryCards({
  totalPending,
  totalApproved,
  totalPaidMTD,
  totalExpenses,
}: ExpenseSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryStatCard
        label="Total Pending"
        value={formatUSD(totalPending)}
        valueClassName="text-yellow-600"
      />
      <SummaryStatCard
        label="Approved (Not Paid)"
        value={formatUSD(totalApproved)}
        valueClassName="text-blue-600"
      />
      <SummaryStatCard
        label="Paid (MTD)"
        value={formatUSD(totalPaidMTD)}
        valueClassName="text-green-600"
      />
      <SummaryStatCard label="Total Expenses" value={totalExpenses} />
    </div>
  )
}
