'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/common'

export default function PaymentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Payment
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Send and receive payments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/payment/send">
          <Card className="hover:shadow-md transition-all cursor-pointer h-full" hover>
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </div>
              <CardTitle>Send</CardTitle>
              <CardDescription className="mt-2">Transfer tokens to any address</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payment/receive">
          <Card className="hover:shadow-md transition-all cursor-pointer h-full" hover>
            <CardContent className="py-8 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'rgb(var(--success))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <CardTitle>Receive</CardTitle>
              <CardDescription className="mt-2">Share your address or QR code</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payment/history">
          <Card className="hover:shadow-md transition-all cursor-pointer h-full" hover>
            <CardContent className="py-8 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
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
              </div>
              <CardTitle>History</CardTitle>
              <CardDescription className="mt-2">View your transaction history</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
