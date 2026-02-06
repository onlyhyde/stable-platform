'use client'

import { SummaryStatCard } from '../SummaryStatCard'

interface PayrollSummaryCardsProps {
  monthlyPayroll: string
  activeEmployees: number
  nextPayment: string
  ytdPayments: string
}

export function PayrollSummaryCards({
  monthlyPayroll,
  activeEmployees,
  nextPayment,
  ytdPayments,
}: PayrollSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryStatCard label="Monthly Payroll" value={monthlyPayroll} />
      <SummaryStatCard label="Active Employees" value={activeEmployees} />
      <SummaryStatCard label="Next Payment" value={nextPayment} />
      <SummaryStatCard label="YTD Payments" value={ytdPayments} />
    </div>
  )
}
