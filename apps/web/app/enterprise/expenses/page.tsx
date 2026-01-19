'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Modal } from '@/components/common'
import { formatAddress, formatUSD } from '@/lib/utils'
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

const categoryColors: Record<string, string> = {
  infrastructure: 'bg-blue-100 text-blue-800',
  travel: 'bg-purple-100 text-purple-800',
  software: 'bg-green-100 text-green-800',
  marketing: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

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

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to manage expenses</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-gray-500">Track and approve business expenses</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Submit Expense
        </Button>
      </div>

      {/* Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Total Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{formatUSD(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Approved (Not Paid)</p>
            <p className="text-2xl font-bold text-blue-600">{formatUSD(totalApproved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Paid (MTD)</p>
            <p className="text-2xl font-bold text-green-600">$500.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expense List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expense Reports</CardTitle>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
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
                  d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
                />
              </svg>
              <p className="text-gray-500">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Submitter</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="py-4">
                        <span className="font-medium text-gray-900">{expense.description}</span>
                      </td>
                      <td className="py-4">
                        <span className="font-medium text-gray-900">
                          {formatUSD(Number(expense.amount) / 10 ** expense.token.decimals)}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${categoryColors[expense.category] || categoryColors.other}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="py-4">
                        <code className="text-sm text-gray-500">
                          {formatAddress(expense.submitter)}
                        </code>
                      </td>
                      <td className="py-4 text-gray-500">
                        {expense.submittedAt.toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColors[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {expense.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="text-green-600">
                              Approve
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
                              Reject
                            </Button>
                          </div>
                        )}
                        {expense.status === 'approved' && (
                          <Button variant="secondary" size="sm">
                            Pay
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Submit Expense"
      >
        <div className="space-y-4">
          <Input
            label="Description"
            placeholder="Brief description of the expense"
          />
          <Input
            label="Amount (USDC)"
            type="number"
            placeholder="0.00"
          />
          <div>
            <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category-select"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="infrastructure">Infrastructure</option>
              <option value="software">Software</option>
              <option value="travel">Travel</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input
            label="Receipt/Documentation URL"
            placeholder="https://..."
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button className="flex-1">
              Submit Expense
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
