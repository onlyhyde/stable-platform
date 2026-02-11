'use client'

import { useState } from 'react'
import { Button, ConnectWalletCard, PageHeader } from '@/components/common'
import {
  AddEmployeeModal,
  PayrollListCard,
  PayrollQuickActionsCard,
  PayrollSummaryCards,
} from '@/components/enterprise'
import { useWallet } from '@/hooks'
import { usePayroll } from '@/hooks/usePayroll'

export default function PayrollPage() {
  const { isConnected } = useWallet()
  const { payrollEntries, summary, isLoading, error } = usePayroll()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to manage payroll" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading payroll...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--destructive))' }}>Error: {error.message}</p>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatNextPayment = (date: Date | null) => {
    if (!date) return 'N/A'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Payroll Management"
          description="Manage employee payments and schedules"
        />
        <Button onClick={() => setIsAddModalOpen(true)}>
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </Button>
      </div>

      <PayrollSummaryCards
        monthlyPayroll={formatCurrency(summary.totalMonthly)}
        activeEmployees={summary.activeEmployees}
        nextPayment={formatNextPayment(summary.nextPaymentDate)}
        ytdPayments={formatCurrency(summary.ytdTotal)}
      />

      <PayrollListCard entries={payrollEntries} />

      <PayrollQuickActionsCard />

      <AddEmployeeModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  )
}
