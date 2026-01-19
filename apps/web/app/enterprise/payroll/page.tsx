'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Modal } from '@/components/common'
import { formatAddress, formatUSD } from '@/lib/utils'
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to manage payroll</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-500">Manage employee payments and schedules</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </Button>
      </div>

      {/* Payroll Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Monthly Payroll</p>
            <p className="text-2xl font-bold text-gray-900">$8,500.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Active Employees</p>
            <p className="text-2xl font-bold text-gray-900">{payrollEntries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Next Payment</p>
            <p className="text-2xl font-bold text-gray-900">Jan 15</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">YTD Payments</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          {payrollEntries.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-gray-500">No employees added yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Add employees to start managing payroll
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-medium">Employee</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Frequency</th>
                    <th className="pb-3 font-medium">Next Payment</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payrollEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {entry.recipient.slice(2, 4).toUpperCase()}
                          </div>
                          <code className="text-sm text-gray-700">
                            {formatAddress(entry.recipient)}
                          </code>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-medium text-gray-900">
                          {formatUSD(Number(entry.amount) / 10 ** entry.token.decimals)}
                        </span>
                        <span className="text-gray-500 ml-1">{entry.token.symbol}</span>
                      </td>
                      <td className="py-4 text-gray-500 capitalize">
                        {entry.frequency}
                      </td>
                      <td className="py-4 text-gray-500">
                        {entry.nextPaymentDate.toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          entry.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="secondary">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Process All Payments
            </Button>
            <Button variant="secondary">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Employee"
      >
        <div className="space-y-4">
          <Input
            label="Wallet Address"
            placeholder="0x..."
          />
          <Input
            label="Payment Amount (USDC)"
            type="number"
            placeholder="0.00"
          />
          <div>
            <label htmlFor="frequency-select" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Frequency
            </label>
            <select
              id="frequency-select"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button className="flex-1">
              Add Employee
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
