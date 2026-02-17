'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import { ExpenseListCard, ExpenseSummaryCards, SubmitExpenseModal } from '@/components/enterprise'
import type { ExpenseFormData } from '@/components/enterprise/cards/SubmitExpenseModal'
import { useWallet } from '@/hooks'
import { useExpenses } from '@/hooks/useExpenses'

export default function ExpensesPage() {
  const { isConnected } = useWallet()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filter = useMemo(() => {
    if (filterStatus === 'all') return undefined
    return { status: filterStatus as 'pending' | 'approved' | 'rejected' | 'paid' }
  }, [filterStatus])

  const { addToast } = useToast()
  const { expenses, isLoading, error } = useExpenses({ filter })

  // Get all expenses for summary calculation (without filter)
  const { expenses: allExpenses } = useExpenses()

  const totalPending =
    allExpenses
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + Number(e.amount), 0) / 1e6

  const totalApproved =
    allExpenses
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + Number(e.amount), 0) / 1e6

  const totalPaidMTD =
    allExpenses.filter((e) => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0) /
    1e6

  const handleSubmitExpense = useCallback(
    (data: ExpenseFormData) => {
      addToast({
        type: 'success',
        title: 'Expense Submitted',
        message: `Submitted ${data.category} expense for $${data.amount}`,
      })
      setIsAddModalOpen(false)
    },
    [addToast]
  )

  const handleApprove = useCallback(
    (id: string) => {
      addToast({
        type: 'success',
        title: 'Expense Approved',
        message: `Expense ${id} has been approved`,
      })
    },
    [addToast]
  )

  const handleReject = useCallback(
    (id: string) => {
      addToast({
        type: 'info',
        title: 'Expense Rejected',
        message: `Expense ${id} has been rejected`,
      })
    },
    [addToast]
  )

  const handlePay = useCallback(
    (id: string) => {
      addToast({
        type: 'loading',
        title: 'Processing Payment',
        message: `Paying expense ${id}...`,
        persistent: true,
      })
    },
    [addToast]
  )

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to manage expenses" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading expenses...</p>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Expense Management" description="Track and approve business expenses" />
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
          Submit Expense
        </Button>
      </div>

      <ExpenseSummaryCards
        totalPending={totalPending}
        totalApproved={totalApproved}
        totalPaidMTD={totalPaidMTD}
        totalExpenses={allExpenses.length}
      />

      <ExpenseListCard
        expenses={expenses}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        onApprove={handleApprove}
        onReject={handleReject}
        onPay={handlePay}
      />

      <SubmitExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleSubmitExpense}
      />
    </div>
  )
}
