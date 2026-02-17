'use client'

import { useCallback, useState } from 'react'
import { Button, ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import {
  AddEmployeeModal,
  PayrollListCard,
  PayrollQuickActionsCard,
  PayrollSummaryCards,
} from '@/components/enterprise'
import type { EmployeeFormData } from '@/components/enterprise/cards/AddEmployeeModal'
import { useWallet } from '@/hooks'
import { usePayroll } from '@/hooks/usePayroll'

export default function PayrollPage() {
  const { isConnected } = useWallet()
  const { payrollEntries, summary, isLoading, error } = usePayroll()
  const { addToast } = useToast()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const handleAddEmployee = useCallback(
    (data: EmployeeFormData) => {
      addToast({
        type: 'success',
        title: 'Employee Added',
        message: `Added ${data.walletAddress.slice(0, 8)}... with ${data.frequency} payments of $${data.amount}`,
      })
      setIsAddModalOpen(false)
    },
    [addToast]
  )

  const handleProcessPayments = useCallback(() => {
    if (payrollEntries.length === 0) {
      addToast({
        type: 'info',
        title: 'No Payments',
        message: 'No active payroll entries to process',
      })
      return
    }
    const activeCount = payrollEntries.filter((e) => e.status === 'active').length
    addToast({
      type: 'loading',
      title: 'Processing Payments',
      message: `Processing ${activeCount} payroll payment(s)...`,
      persistent: true,
    })
  }, [payrollEntries, addToast])

  const handleExportReport = useCallback(() => {
    if (payrollEntries.length === 0) {
      addToast({ type: 'info', title: 'No Data', message: 'No payroll data to export' })
      return
    }

    const headers = ['Recipient', 'Amount', 'Token', 'Frequency', 'Status', 'Next Payment']
    const rows = payrollEntries.map((entry) => [
      entry.recipient,
      (Number(entry.amount) / 10 ** entry.token.decimals).toString(),
      entry.token.symbol,
      entry.frequency,
      entry.status,
      entry.nextPaymentDate.toISOString(),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `payroll-report-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addToast({
      type: 'success',
      title: 'Report Exported',
      message: 'Payroll report downloaded as CSV',
    })
  }, [payrollEntries, addToast])

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

      <PayrollListCard
        entries={payrollEntries}
        onEdit={(id) => {
          addToast({ type: 'info', title: 'Edit Employee', message: `Editing payroll entry ${id}` })
        }}
      />

      <PayrollQuickActionsCard
        onProcessPayments={handleProcessPayments}
        onExportReport={handleExportReport}
      />

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddEmployee}
      />
    </div>
  )
}
