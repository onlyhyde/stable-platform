'use client'

import Link from 'next/link'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/common'

export default function EnterprisePage() {
  const { isConnected } = useWallet()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enterprise</h1>
        <p className="text-gray-500">Manage payroll, expenses, and compliance</p>
      </div>

      {/* Enterprise Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/enterprise/payroll">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <CardTitle>Payroll</CardTitle>
              <CardDescription className="mt-2">Manage employee payments and schedules</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/enterprise/expenses">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
              <CardTitle>Expenses</CardTitle>
              <CardDescription className="mt-2">Track and manage business expenses</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/enterprise/audit">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription className="mt-2">View compliance and transaction audit trail</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Enterprise Stats */}
      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Total Payroll (MTD)</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Pending Expenses</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Active Employees</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Compliance Score</p>
              <p className="text-2xl font-bold text-green-600">100%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-medium text-blue-900">Regulatory Compliance</p>
              <p className="text-sm text-blue-700 mt-1">
                All transactions are recorded on-chain for full auditability.
                Role-based access controls ensure proper authorization for all operations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
