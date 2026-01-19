'use client'

import Link from 'next/link'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/common'

export default function DeFiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DeFi</h1>
        <p className="text-gray-500">Swap tokens and provide liquidity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/defi/swap">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <CardTitle>Swap</CardTitle>
              <CardDescription className="mt-2">Exchange tokens at the best rates</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/defi/pool">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <CardTitle>Liquidity Pools</CardTitle>
              <CardDescription className="mt-2">Provide liquidity and earn fees</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* DeFi Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Total Value Locked</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">24h Volume</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Your Positions</p>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
