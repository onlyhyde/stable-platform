'use client'

import Link from 'next/link'
import { useWallet, useBalance } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/common'
import { formatTokenAmount, formatAddress } from '@/lib/utils'

export default function DashboardPage() {
  const { address, isConnected, connect } = useWallet()
  const { balance, decimals, symbol } = useBalance({ address, watch: true })

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to StableNet</h1>
        <p className="text-gray-500 mb-6 max-w-md">
          Connect your wallet to access smart account features, send payments, trade tokens, and more.
        </p>
        <Button onClick={() => connect()} size="lg">
          Connect Wallet
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your StableNet account</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-700">
        <CardContent className="py-8">
          <p className="text-primary-100 text-sm font-medium">Total Balance</p>
          <h2 className="text-4xl font-bold text-white mt-2">
            {formatTokenAmount(balance, decimals)} {symbol}
          </h2>
          <p className="text-primary-200 text-sm mt-2">
            {address && formatAddress(address, 6)}
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Send"
          description="Transfer tokens"
          href="/payment/send"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          }
        />
        <QuickActionCard
          title="Receive"
          description="Get paid"
          href="/payment/receive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
        />
        <QuickActionCard
          title="Swap"
          description="Exchange tokens"
          href="/defi/swap"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          }
        />
        <QuickActionCard
          title="Stealth"
          description="Private transfers"
          href="/stealth"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          }
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>No recent transactions</p>
            <Link href="/payment/history" className="text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block">
              View all activity
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface QuickActionCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

function QuickActionCard({ title, description, href, icon }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
