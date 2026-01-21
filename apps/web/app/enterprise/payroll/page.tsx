'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { PageHeader, ConnectWalletCard, Button } from '@/components/common'
import {
  PayrollSummaryCards,
  PayrollListCard,
  PayrollQuickActionsCard,
  AddEmployeeModal,
} from '@/components/enterprise'
import type { PayrollEntry } from '@/types'

// Mock payroll data
const mockPayroll: PayrollEntry[] = [
  {
    id: '1',
    recipient: '0x1234567890123456789012345678901234567890',
    amount: BigInt('5000000000'),
    token: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    frequency: 'monthly',
    nextPaymentDate: new Date('2024-02-01'),
    status: 'active',
  },
  {
    id: '2',
    recipient: '0x2345678901234567890123456789012345678901',
    amount: BigInt('3500000000'),
    token: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    frequency: 'biweekly',
    nextPaymentDate: new Date('2024-01-15'),
    status: 'active',
  },
]

export default function PayrollPage() {
  const { isConnected } = useWallet()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [payrollEntries] = useState<PayrollEntry[]>(mockPayroll)

  if (!isConnected) {
    return (
      <ConnectWalletCard message="Please connect your wallet to manage payroll" />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Payroll Management"
          description="Manage employee payments and schedules"
        />
        <Button onClick={() => setIsAddModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </Button>
      </div>

      <PayrollSummaryCards
        monthlyPayroll="$8,500.00"
        activeEmployees={payrollEntries.length}
        nextPayment="Jan 15"
        ytdPayments="$0.00"
      />

      <PayrollListCard entries={payrollEntries} />

      <PayrollQuickActionsCard />

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}
