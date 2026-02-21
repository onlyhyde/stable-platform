'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/common'

export function DefiNavigationCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Link href="/defi/swap">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <CardTitle>Swap</CardTitle>
            <CardDescription className="mt-2">Exchange tokens at the best rates</CardDescription>
          </CardContent>
        </Card>
      </Link>

      <Link href="/defi/pool">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(219 234 254)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(37 99 235)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <CardTitle>Liquidity Pools</CardTitle>
            <CardDescription className="mt-2">Provide liquidity and earn fees</CardDescription>
          </CardContent>
        </Card>
      </Link>

      <Link href="/defi/stake">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(254 243 199)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(217 119 6)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <CardTitle>Staking</CardTitle>
            <CardDescription className="mt-2">Earn rewards by staking tokens</CardDescription>
          </CardContent>
        </Card>
      </Link>

      <Link href="/defi/lend">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(220 252 231)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(22 163 74)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <CardTitle>Lending</CardTitle>
            <CardDescription className="mt-2">Supply and borrow assets</CardDescription>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
