'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { PageHeader, ConnectWalletCard, Button } from '@/components/common'
import {
  ExpenseSummaryCards,
  ExpenseListCard,
  SubmitExpenseModal,
} from '@/components/enterprise'
import type { Expense } from '@/types'

// Mock expenses data
const mockExpenses: Expense[] = [
  {
    id: '1',
    description: 'AWS Cloud Services',
    amount: BigInt('1500000000'),
    token: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    category: 'infrastructure',
    submitter: '0x1234567890123456789012345678901234567890',
    submittedAt: new Date('2024-01-10'),
    status: 'approved',
  },
  {
    id: '2',
    description: 'Team Offsite Event',
    amount: BigInt('3000000000'),
    token: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    category: 'travel',
    submitter: '0x2345678901234567890123456789012345678901',
    submittedAt: new Date('2024-01-12'),
    status: 'pending',
  },
  {
    id: '3',
    description: 'Software Licenses',
    amount: BigInt('500000000'),
    token: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    category: 'software',
    submitter: '0x3456789012345678901234567890123456789012',
    submittedAt: new Date('2024-01-08'),
    status: 'paid',
  },
]

export default function ExpensesPage() {
  const { isConnected } = useWallet()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [expenses] = useState<Expense[]>(mockExpenses)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filteredExpenses = filterStatus === 'all'
    ? expenses
    : expenses.filter(e => e.status === filterStatus)

  const totalPending = expenses
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + Number(e.amount), 0) / 1e6

  const totalApproved = expenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0) / 1e6

  const totalPaidMTD = expenses
    .filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + Number(e.amount), 0) / 1e6

  if (!isConnected) {
    return (
      <ConnectWalletCard message="Please connect your wallet to manage expenses" />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Expense Management"
          description="Track and approve business expenses"
        />
        <Button onClick={() => setIsAddModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Submit Expense
        </Button>
      </div>

      <ExpenseSummaryCards
        totalPending={totalPending}
        totalApproved={totalApproved}
        totalPaidMTD={totalPaidMTD}
        totalExpenses={expenses.length}
      />

      <ExpenseListCard
        expenses={filteredExpenses}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      <SubmitExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}
