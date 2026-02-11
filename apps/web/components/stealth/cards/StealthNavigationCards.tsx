'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/common'

export function StealthNavigationCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Link href="/stealth/send">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(243 232 255)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(147 51 234)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
            </div>
            <CardTitle>Private Send</CardTitle>
            <CardDescription className="mt-2">
              Send tokens to a stealth meta-address
            </CardDescription>
          </CardContent>
        </Card>
      </Link>

      <Link href="/stealth/receive">
        <Card className="hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(224 231 255)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'rgb(79 70 229)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <CardTitle>Private Receive</CardTitle>
            <CardDescription className="mt-2">
              Generate your stealth address and scan for incoming
            </CardDescription>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
